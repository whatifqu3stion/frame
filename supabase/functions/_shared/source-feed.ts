export const SOURCE_FEED_MAX_ITEMS = 20;

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
  readCachedSourceFeed(providerSourceId: string, limit: number): Promise<CachedSourceFeedRecord | null>;
}

export type SourceFeedResponse =
  | {
    state: "fresh" | "stale";
    freshness: "fresh" | "stale";
    source: CachedSourceFeedSource;
    items: readonly CachedSourceFeedItem[];
    fetchedAt: string;
  }
  | {
    state: "empty" | "unavailable";
    items: readonly [];
    message: string;
  };

/** Reads a sanitized bounded feed entirely from Frame's shared cache. */
export async function executeSourceFeed(
  input: unknown,
  repository: SourceFeedRepository,
  now: Date = new Date(),
): Promise<{ status: number; cacheControl: string; body: SourceFeedResponse }> {
  const providerSourceId = parseInput(input);
  if (!providerSourceId) {
    return response(400, "no-store", {
      state: "unavailable",
      items: [],
      message: "A valid registered YouTube source id is required.",
    });
  }

  let cached: CachedSourceFeedRecord | null;
  try {
    cached = await repository.readCachedSourceFeed(providerSourceId, SOURCE_FEED_MAX_ITEMS);
  } catch {
    return response(503, "no-store", {
      state: "unavailable",
      items: [],
      message: "This source feed is temporarily unavailable.",
    });
  }

  if (!cached || cached.sourceStatus !== "active") {
    return response(200, "private, max-age=60", {
      state: "unavailable",
      items: [],
      message: "No available cached feed exists for this source.",
    });
  }
  if (cached.items.length === 0) {
    return response(200, "private, max-age=60", {
      state: "empty",
      items: [],
      message: "No cached videos are available for this source yet.",
    });
  }

  const items = cached.items.slice(0, SOURCE_FEED_MAX_ITEMS);
  const fetchedAt = newestFetchedAt(items);
  const nextAttemptTime = cached.nextAttemptAt ? Date.parse(cached.nextAttemptAt) : Number.NaN;
  const freshness: "fresh" | "stale" = cached.lastSuccessAt
    && !cached.lastErrorCode
    && Number.isFinite(nextAttemptTime)
    && nextAttemptTime > now.getTime()
    ? "fresh"
    : "stale";
  return response(200, freshness === "fresh" ? "private, max-age=300" : "private, max-age=60", {
    state: freshness,
    freshness,
    source: cached.source,
    items,
    fetchedAt,
  });
}

function parseInput(input: unknown): string | null {
  if (!isRecord(input) || Object.keys(input).length !== 1 || typeof input.providerSourceId !== "string") return null;
  return /^UC[A-Za-z0-9_-]{22}$/.test(input.providerSourceId) ? input.providerSourceId : null;
}

function newestFetchedAt(items: readonly CachedSourceFeedItem[]): string {
  return items.reduce((newest: string, item: CachedSourceFeedItem) => {
    return Date.parse(item.fetchedAt) > Date.parse(newest) ? item.fetchedAt : newest;
  }, items[0]?.fetchedAt ?? new Date(0).toISOString());
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
