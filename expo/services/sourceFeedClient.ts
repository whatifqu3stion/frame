import { SOURCE_FEED_CANDIDATES_PER_SOURCE, SOURCE_FEED_MAX_SOURCES } from "@/constants/productConfig";
import type { CachedTodayCandidate } from "@/models/today";

export const SOURCE_FEED_REQUEST_TIMEOUT_MS = 10_000;

type SourceFeedState = "fresh" | "stale" | "empty" | "unavailable";
type SourceFeedFreshness = "fresh" | "stale" | "empty";

type SourceFeedSource = {
  fetchedAt?: string | null;
  provider: "youtube";
  providerSourceId: string;
  handle: string | null;
  displayName: string;
  thumbnailUrl: string | null;
};

type SourceFeedItem = {
  provider: "youtube";
  providerMediaId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isLivestream: boolean;
  isUpcomingPremiere: boolean;
  madeForKids: boolean | null;
  fetchedAt: string;
};

type SourceFeedEntry = { source: SourceFeedSource; freshness: SourceFeedFreshness; items: SourceFeedItem[] };
export type SourceFeedResponse = {
  state: SourceFeedState;
  freshness?: "fresh" | "stale";
  feeds: SourceFeedEntry[];
  unavailableSourceIds: string[];
  fetchedAt: string | null;
  message?: string;
};

export type SourceFeedClientResult =
  | { status: "success"; response: SourceFeedResponse; candidates: CachedTodayCandidate[] }
  | { status: "missing_configuration" | "invalid_request" | "unauthorized" | "http_unavailable" | "network_error" | "invalid_response" };

type SourceFeedClientOptions = { supabaseUrl?: string; publishableKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number };

export function createSourceFeedClient(options: SourceFeedClientOptions) {
  const endpoint = buildEndpoint(options.supabaseUrl);
  const key = options.publishableKey?.trim() ?? "";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  return {
    async getCachedFeeds(providerSourceIds: readonly string[]): Promise<SourceFeedClientResult> {
      const ids = [...new Set(providerSourceIds)];
      if (!endpoint || !key) return { status: "missing_configuration" };
      if (ids.length === 0 || ids.length > SOURCE_FEED_MAX_SOURCES || ids.some((id) => !/^UC[A-Za-z0-9_-]{22}$/.test(id))) return { status: "invalid_request" };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? SOURCE_FEED_REQUEST_TIMEOUT_MS);
      try {
        let response: Response | null = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            response = await fetchImpl(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: key, "x-frame-metadata": "1" },
              body: JSON.stringify({ providerSourceIds: ids, limitPerSource: SOURCE_FEED_CANDIDATES_PER_SOURCE }),
              signal: controller.signal,
            });
            break;
          } catch {
            if (attempt === 1 || controller.signal.aborted) return { status: "network_error" };
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        if (!response) return { status: "network_error" };
        if (response.status === 401) return { status: "unauthorized" };
        if (response.status === 400 || response.status === 413) return { status: "invalid_request" };
        if (!response.ok) return { status: "http_unavailable" };
        let body: unknown;
        try { body = await response.json(); } catch { return { status: "invalid_response" }; }
        if (!isSourceFeedResponse(body, ids)) return { status: "invalid_response" };
        return { status: "success", response: body, candidates: mapCandidates(body) };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function mapCandidates(response: SourceFeedResponse): CachedTodayCandidate[] {
  return response.feeds.flatMap((feed) => feed.items.map((item) => ({
    id: item.providerMediaId,
    title: item.title,
    channelId: feed.source.providerSourceId,
    channelTitle: feed.source.displayName,
    thumbnailUrl: item.thumbnailUrl ?? "",
    publishedAt: item.publishedAt ?? "",
    durationSeconds: item.durationSeconds ?? 0,
    description: item.description,
    madeForKids: item.madeForKids,
    sourceId: feed.source.providerSourceId,
    sourceTitle: feed.source.displayName,
    isLivestream: item.isLivestream,
    isUpcomingPremiere: item.isUpcomingPremiere,
    fetchedAt: feed.source.fetchedAt ? Math.min(Date.parse(item.fetchedAt), Date.parse(feed.source.fetchedAt)) : Date.parse(item.fetchedAt),
  })));
}

export function isSourceFeedResponse(value: unknown, requestedIds: readonly string[]): value is SourceFeedResponse {
  if (!isRecordWithKeys(value, ["state", "freshness", "feeds", "unavailableSourceIds", "fetchedAt", "message"])) return false;
  if (!(["fresh", "stale", "empty", "unavailable"] as const).includes(value.state as SourceFeedState)) return false;
  if (!Array.isArray(value.feeds) || value.feeds.length > requestedIds.length || !Array.isArray(value.unavailableSourceIds)) return false;
  if (value.fetchedAt !== null && !isIso(value.fetchedAt)) return false;
  if (value.message !== undefined && typeof value.message !== "string") return false;
  const requested = new Set(requestedIds);
  const seen = new Set<string>();
  for (const entry of value.feeds) {
    if (!isFeedEntry(entry) || !requested.has(entry.source.providerSourceId) || seen.has(entry.source.providerSourceId)) return false;
    seen.add(entry.source.providerSourceId);
  }
  return value.unavailableSourceIds.every((id: unknown) => typeof id === "string" && requested.has(id as string));
}

function isFeedEntry(value: unknown): value is SourceFeedEntry {
  if (!isRecordWithKeys(value, ["source", "freshness", "items"]) || !isSource(value.source)) return false;
  if (!(["fresh", "stale", "empty"] as const).includes(value.freshness as SourceFeedFreshness)) return false;
  return Array.isArray(value.items) && value.items.length <= SOURCE_FEED_CANDIDATES_PER_SOURCE && value.items.every(isItem);
}
function isSource(value: unknown): value is SourceFeedSource {
  return isRecordWithKeys(value, ["provider", "providerSourceId", "handle", "displayName", "thumbnailUrl", "fetchedAt"])
    && (value.fetchedAt === undefined || value.fetchedAt === null || isIso(value.fetchedAt))
    && value.provider === "youtube" && typeof value.providerSourceId === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(value.providerSourceId)
    && typeof value.displayName === "string" && value.displayName.length > 0 && value.displayName.length <= 160
    && (value.handle === null || typeof value.handle === "string") && isNullableHttps(value.thumbnailUrl);
}
function isItem(value: unknown): value is SourceFeedItem {
  return isRecordWithKeys(value, ["provider", "providerMediaId", "title", "description", "thumbnailUrl", "publishedAt", "durationSeconds", "isLivestream", "isUpcomingPremiere", "madeForKids", "fetchedAt"])
    && value.provider === "youtube" && typeof value.providerMediaId === "string" && /^[A-Za-z0-9_-]{11}$/.test(value.providerMediaId)
    && typeof value.title === "string" && value.title.length > 0 && value.title.length <= 500 && typeof value.description === "string"
    && isNullableHttps(value.thumbnailUrl) && (value.publishedAt === null || isIso(value.publishedAt))
    && (value.durationSeconds === null || (Number.isInteger(value.durationSeconds) && (value.durationSeconds as number) >= 0 && (value.durationSeconds as number) <= 31_536_000))
    && typeof value.isLivestream === "boolean" && typeof value.isUpcomingPremiere === "boolean"
    && (value.madeForKids === null || typeof value.madeForKids === "boolean") && isIso(value.fetchedAt);
}
function buildEndpoint(value: string | undefined): string | null {
  const base = value?.trim().replace(/\/+$/, "") ?? "";
  if (!base) return null;
  try { const url = new URL(`${base}/functions/v1/source-feed`); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; }
}
function isIso(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function isNullableHttps(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 2_048) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
function isRecordWithKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
}

