import { boundedRequest } from "./boundedRequest";
import type { KeyProvider, ProviderKeyStore } from "../storage/providerKeys";

export type ProviderErrorKind = "missing_key" | "access" | "quota" | "network" | "invalid_response" | "cancelled" | "storage";
export class ProviderError extends Error {
  constructor(public readonly kind: ProviderErrorKind) {
    super({ storage: "Secure key storage is unavailable. Use the iPhone or Android app, or try again after unlocking your device.", missing_key: "Add your provider key in Settings → Your API keys.", access: "The provider rejected access. Check the key, API restrictions, and whether the API is enabled.", quota: "Your provider quota or rate limit was reached. Check your provider account before trying again.", network: "The provider could not be reached. Check your connection and try again.", invalid_response: "The provider returned incomplete data. Try again later.", cancelled: "The request was cancelled. Try again when you are ready." }[kind]);
    this.name = "ProviderError";
  }
}

type YouTubeResource = "channels" | "videos" | "playlistItems" | "search";
export type ProviderTransport = ReturnType<typeof createProviderTransport>;

/** Only fixed HTTPS endpoints; keys are headers, never URLs, request bodies, or errors. */
export function createProviderTransport(keys: ProviderKeyStore, fetchImpl: typeof fetch = globalThis.fetch) {
  async function request(provider: KeyProvider, url: string, body?: unknown, signal?: AbortSignal, candidateKey?: string): Promise<unknown> {
    const revision = keys.revision();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    const unsubscribe = keys.subscribe(cancel);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    try {
      const key = candidateKey ?? await keys.read(provider).catch(() => { throw new ProviderError("storage"); });
      if (!key) throw new ProviderError("missing_key");
      if (keys.revision() !== revision || controller.signal.aborted) throw new ProviderError("cancelled");
      return await boundedRequest(async (requestSignal) => {
        const response = await fetchImpl(url, {
          method: body === undefined ? "GET" : "POST", signal: requestSignal,
          redirect: "error", credentials: "omit", cache: "no-store",
          headers: { Accept: "application/json", "x-goog-api-key": key, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        // Raw provider errors may echo credentials or request content. Never surface them.
        if (!response.ok) {
          if (response.status === 429) throw new ProviderError("quota");
          if (response.status === 403) {
            const errorBody = await response.json().catch(() => null) as { error?: { errors?: { reason?: string }[] } } | null;
            if (errorBody?.error?.errors?.some((error) => ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(error.reason ?? ""))) throw new ProviderError("quota");
          }
          if ([400, 401, 403].includes(response.status)) throw new ProviderError("access");
          throw new ProviderError("network");
        }
        const result: unknown = await response.json();
        if (keys.revision() !== revision || requestSignal.aborted) throw new ProviderError("cancelled");
        return result;
      }, body === undefined ? 12_000 : 30_000, controller.signal);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(controller.signal.aborted ? "cancelled" : "network");
    } finally { unsubscribe(); signal?.removeEventListener("abort", cancel); }
  }
  return {
    youtube(resource: YouTubeResource, params: Record<string, string>, signal?: AbortSignal, candidateKey?: string) {
      if (!["channels", "videos", "playlistItems", "search"].includes(resource) || "key" in params) throw new ProviderError("invalid_response");
      if (resource === "search") {
        const allowed = new Set(["part", "type", "q", "channelId", "maxResults", "pageToken", "order", "safeSearch", "videoDuration", "publishedAfter"]);
        const scoped = params.type === "channel" || (params.type === "video" && /^UC[A-Za-z0-9_-]{22}$/.test(params.channelId ?? ""));
        if (params.videoDuration === "short") throw new ProviderError("invalid_response");
        if (!scoped || !params.q?.trim() || params.q.length > 120 || Object.keys(params).some((key) => !allowed.has(key)) || params.maxResults !== "20") throw new ProviderError("invalid_response");
      }
      return request("youtube", `https://www.googleapis.com/youtube/v3/${resource}?${new URLSearchParams(params)}`, undefined, signal, candidateKey);
    },
    gemini(model: string, body: unknown, signal?: AbortSignal) {
      if (!/^gemini-[a-z0-9.-]{1,64}$/.test(model)) throw new ProviderError("invalid_response");
      return request("gemini", `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, body, signal);
    },
    validateGemini(candidateKey: string, signal?: AbortSignal) {
      return request("gemini", "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", undefined, signal, candidateKey);
    },
  };
}
