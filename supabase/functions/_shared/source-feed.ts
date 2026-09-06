export const SOURCE_FEED_MAX_SOURCES = 25;
export const SOURCE_FEED_MAX_ITEMS_PER_SOURCE = 20;

export interface CachedSourceFeedItem {
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
}

export interface CachedSourceFeedSource {
  provider: "youtube";
  providerSourceId: string;
  handle: string | null;
  displayName: string;
  thumbnailUrl: string | null;
}

export interface CachedSourceFeedRecord {
  source: CachedSourceFeedSource;
  sourceStatus: "active" | "unavailable" | "deleted";
  lastSuccessAt: string | null;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  items: readonly CachedSourceFeedItem[];
}

export interface SourceFeedRepository {
  readCachedSourceFeeds(providerSourceIds: readonly string[], limitPerSource: number): Promise<readonly CachedSourceFeedRecord[]>;
}

export type SourceFeedEntry = {
  source: CachedSourceFeedSource;
  freshness: "fresh" | "stale" | "empty";
  items: readonly CachedSourceFeedItem[];
};

export type SourceFeedResponse =
  | {
    state: "fresh" | "stale" | "empty";
    freshness: "fresh" | "stale";
    feeds: readonly SourceFeedEntry[];
    unavailableSourceIds: readonly string[];
    fetchedAt: string | null;
    message?: string;
  }
  | {
    state: "unavailable";
    feeds: readonly [];
    unavailableSourceIds: readonly string[];
    fetchedAt: null;
    message: string;
  };

type ParsedInput = { providerSourceIds: string[]; limitPerSource: number };

/** Reads multiple sanitized, bounded feeds entirely from Frame's shared cache. */
export async function executeSourceFeed(
  input: unknown,
  repository: SourceFeedRepository,
  now: Date = new Date(),
): Promise<{ status: number; cacheControl: string; body: SourceFeedResponse }> {
  const parsed = parseInput(input);
  if (!parsed) {
    return response(400, "no-store", {
      state: "unavailable",
      feeds: [],
      unavailableSourceIds: [],
      fetchedAt: null,
      message: "A bounded list of registered YouTube source ids is required.",
    });
  }

  let cached: readonly CachedSourceFeedRecord[];
  try {
    cached = await repository.readCachedSourceFeeds(parsed.providerSourceIds, parsed.limitPerSource);
  } catch {
    return response(503, "no-store", {
      state: "unavailable",
      feeds: [],
      unavailableSourceIds: [],
      fetchedAt: null,
      message: "Cached source feeds are temporarily unavailable.",
    });
  }

  const requested = new Set(parsed.providerSourceIds);
  const validRecords = cached.filter((record) => requested.has(record.source.providerSourceId));
  const bySourceId = new Map(validRecords.map((record) => [record.source.providerSourceId, record]));
  const unavailableSourceIds = parsed.providerSourceIds.filter((id) => {
    const record = bySourceId.get(id);
    return !record || record.sourceStatus !== "active";
  });
  const feeds: SourceFeedEntry[] = [];

  for (const providerSourceId of parsed.providerSourceIds) {
    const record = bySourceId.get(providerSourceId);
    if (!record || record.sourceStatus !== "active") continue;
    const items = record.items.slice(0, parsed.limitPerSource);
    feeds.push({
      source: record.source,
      freshness: items.length === 0 ? "empty" : isFresh(record, now) ? "fresh" : "stale",
      items,
    });
  }

  if (feeds.length === 0) {
    return response(200, "private, max-age=60", {
      state: "unavailable",
      feeds: [],
      unavailableSourceIds,
      fetchedAt: null,
      message: "No available cached feed exists for these sources.",
    });
  }

  const items = feeds.flatMap((feed) => feed.items);
  const fetchedAt = newestFetchedAt(items);
  const hasStale = feeds.some((feed) => feed.freshness === "stale");
  const state: "fresh" | "stale" | "empty" = items.length === 0 ? "empty" : hasStale ? "stale" : "fresh";
  return response(200, state === "fresh" ? "private, max-age=300" : "private, max-age=60", {
    state,
    freshness: hasStale ? "stale" : "fresh",
    feeds,
    unavailableSourceIds,
    fetchedAt,
    ...(state === "empty" ? { message: "No cached videos are available for these sources yet." } : {}),
  });
}

function parseInput(input: unknown): ParsedInput | null {
  if (!isRecord(input)) return null;
  const keys = Object.keys(input);
  if (keys.some((key) => key !== "providerSourceIds" && key !== "providerSourceId" && key !== "limitPerSource")) return null;
  const rawIds = Array.isArray(input.providerSourceIds)
    ? input.providerSourceIds
    : typeof input.providerSourceId === "string"
      ? [input.providerSourceId]
      : null;
  if (!rawIds || rawIds.length === 0 || rawIds.length > SOURCE_FEED_MAX_SOURCES) return null;
  if (rawIds.some((value) => typeof value !== "string" || !/^UC[A-Za-z0-9_-]{22}$/.test(value))) return null;
  const providerSourceIds = [...new Set(rawIds as string[])];
  if (providerSourceIds.length !== rawIds.length) return null;
  const limitPerSource = input.limitPerSource === undefined ? SOURCE_FEED_MAX_ITEMS_PER_SOURCE : input.limitPerSource;
  if (!Number.isInteger(limitPerSource) || (limitPerSource as number) < 1 || (limitPerSource as number) > SOURCE_FEED_MAX_ITEMS_PER_SOURCE) return null;
  return { providerSourceIds, limitPerSource: limitPerSource as number };
}

function isFresh(record: CachedSourceFeedRecord, now: Date): boolean {
  const nextAttemptTime = record.nextAttemptAt ? Date.parse(record.nextAttemptAt) : Number.NaN;
  return Boolean(record.lastSuccessAt)
    && !record.lastErrorCode
    && Number.isFinite(nextAttemptTime)
    && nextAttemptTime > now.getTime();
}

function newestFetchedAt(items: readonly CachedSourceFeedItem[]): string | null {
  return items.reduce<string | null>((newest, item) => {
    if (!newest || Date.parse(item.fetchedAt) > Date.parse(newest)) return item.fetchedAt;
    return newest;
  }, null);
}

function response(
  status: number,
  cacheControl: string,
  body: SourceFeedResponse,
): { status: number; cacheControl: string; body: SourceFeedResponse } {
  return { status, cacheControl, body };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
