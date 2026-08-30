import type { FollowedSourceIdentity } from "@/repositories/followedSourceRepository";

export const SOURCE_LEASE_REQUEST_TIMEOUT_MS = 10_000;
export const SOURCE_LEASE_REQUEST_LIMIT = 25;

export type SourceLeaseAction = "sync" | "release";
export type SourceLeaseResultStatus =
  | "synced"
  | "released"
  | "unknown_source"
  | "disabled"
  | "invalid_request"
  | "temporarily_unavailable";

export type SourceLeaseRequestItem = FollowedSourceIdentity & {
  leaseToken: string;
};

export type SourceLeaseResult = FollowedSourceIdentity & {
  status: SourceLeaseResultStatus;
};

export type SourceLeaseClientResult =
  | { status: "success"; results: SourceLeaseResult[] }
  | { status: "missing_configuration" | "invalid_request" | "unavailable" | "network_error" | "invalid_response" };

export type SourceLeaseClient = {
  reconcile(action: SourceLeaseAction, sources: readonly SourceLeaseRequestItem[]): Promise<SourceLeaseClientResult>;
};

type SourceLeaseClientOptions = {
  supabaseUrl?: string;
  publishableKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const resultStatuses = new Set<SourceLeaseResultStatus>([
  "synced",
  "released",
  "unknown_source",
  "disabled",
  "invalid_request",
  "temporarily_unavailable",
]);

/** Creates the tightly bounded anonymous client for the development-only lease endpoint. */
export function createSourceLeaseClient(options: SourceLeaseClientOptions): SourceLeaseClient {
  const endpoint = buildEndpoint(options.supabaseUrl);
  const publishableKey = options.publishableKey?.trim() ?? "";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? SOURCE_LEASE_REQUEST_TIMEOUT_MS;

  return {
    async reconcile(action: SourceLeaseAction, sources: readonly SourceLeaseRequestItem[]): Promise<SourceLeaseClientResult> {
      if (!endpoint || !publishableKey) return { status: "missing_configuration" };
      if (sources.length === 0 || sources.length > SOURCE_LEASE_REQUEST_LIMIT || !sources.every(isRequestItem)) {
        return { status: "invalid_request" };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: publishableKey },
            body: JSON.stringify({ action, sources }),
            signal: controller.signal,
          });
        } catch {
          return { status: "network_error" };
        }

        if (response.status === 400 || response.status === 413) return { status: "invalid_request" };
        if (!response.ok) return { status: "unavailable" };

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return { status: "invalid_response" };
        }
        if (!isResponse(body, sources)) return { status: "invalid_response" };
        return { status: "success", results: body.results };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function isResponse(value: unknown, requested: readonly SourceLeaseRequestItem[]): value is { results: SourceLeaseResult[] } {
  if (!isRecord(value) || !Object.keys(value).every((key) => key === "results" || key === "message") || !Array.isArray(value.results)) return false;
  if (value.results.length !== requested.length) return false;
  return value.results.every((result: unknown, index: number) => {
    if (!isRecord(result) || Object.keys(result).sort().join(",") !== "provider,providerSourceId,status") return false;
    const expected = requested[index];
    return result.provider === expected?.provider
      && result.providerSourceId === expected.providerSourceId
      && typeof result.status === "string"
      && resultStatuses.has(result.status as SourceLeaseResultStatus);
  });
}

function isRequestItem(value: SourceLeaseRequestItem): boolean {
  return value.provider === "youtube"
    && value.providerSourceId.length > 0
    && value.providerSourceId.length <= 255
    && /^[0-9a-f]{64}$/.test(value.leaseToken);
}

function buildEndpoint(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\/+$/, "") ?? "";
  if (!normalized) return null;
  try {
    const url = new URL(`${normalized}/functions/v1/source-leases`);
    const isLocalHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !isLocalHttp) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

