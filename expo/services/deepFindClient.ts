import { configureRevenueCat } from "@/services/revenueCat";

export type DeepFindSource = {
  provider: "youtube";
  providerSourceId: string;
  handle: string | null;
  displayName: string;
  description: string;
  thumbnailUrl: string | null;
};

export type DeepFindResult =
  | { state: "ready"; sources: DeepFindSource[]; remaining: number; resetAt: string }
  | { state: "status"; remaining: number; resetAt: string }
  | { state: "premium_required" | "disabled" | "allowance_exhausted" | "quota_exhausted" | "unavailable" | "invalid_request"; message: string; remaining?: number; resetAt?: string };

const sourceIdPattern = /^UC[A-Za-z0-9_-]{22}$/;

/** No query or installation identity is retained by Frame after the request. */
export async function requestDeepFind(query?: string): Promise<DeepFindResult> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const apikey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !apikey) return { state: "unavailable", message: "Deep Find is not configured in this build." };
  let installationToken: string;
  try { installationToken = await configureRevenueCat(); }
  catch { return { state: "unavailable", message: "Premium could not be checked on this device." }; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${url}/functions/v1/deep-find`, {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify(query === undefined ? { action: "status", installationToken } : { query, installationToken }),
      signal: controller.signal,
    });
    const value = await response.json() as unknown;
    if (!isRecord(value) || typeof value.state !== "string") throw new Error("invalid response");
    if (value.state === "ready" || value.state === "status") {
      if (!Number.isInteger(value.remaining) || typeof value.resetAt !== "string") throw new Error("invalid allowance");
      if (value.state === "status") return { state: "status", remaining: value.remaining as number, resetAt: value.resetAt };
      if (!Array.isArray(value.sources) || value.sources.length > 3 || !value.sources.every(isSource)) throw new Error("invalid sources");
      return { state: "ready", sources: value.sources, remaining: value.remaining as number, resetAt: value.resetAt };
    }
    if (["premium_required", "disabled", "allowance_exhausted", "quota_exhausted", "unavailable", "invalid_request"].includes(value.state) && typeof value.message === "string") {
      return { state: value.state as Exclude<DeepFindResult["state"], "ready" | "status">, message: value.message,
        ...(typeof value.remaining === "number" ? { remaining: value.remaining } : {}),
        ...(typeof value.resetAt === "string" ? { resetAt: value.resetAt } : {}) };
    }
    throw new Error("unknown response");
  } catch {
    return { state: "unavailable", message: "Deep Find could not finish. If you started a search, check your allowance before retrying." };
  } finally { clearTimeout(timeout); }
}

function isSource(value: unknown): value is DeepFindSource {
  return isRecord(value) && value.provider === "youtube"
    && typeof value.providerSourceId === "string" && sourceIdPattern.test(value.providerSourceId)
    && typeof value.displayName === "string" && value.displayName.length > 0
    && typeof value.description === "string"
    && (value.handle === null || typeof value.handle === "string")
    && (value.thumbnailUrl === null || typeof value.thumbnailUrl === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
