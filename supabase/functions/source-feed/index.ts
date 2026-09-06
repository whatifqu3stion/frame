import { createClient } from "@supabase/supabase-js";
import {
  executeSourceFeed,
  SOURCE_FEED_MAX_ITEMS_PER_SOURCE,
  type CachedSourceFeedItem,
  type CachedSourceFeedRecord,
  type CachedSourceFeedSource,
  type SourceFeedRepository,
} from "../_shared/source-feed.ts";
import { getSupabaseSecretKey, hasValidPublishableKey, readBoundedJsonBody } from "../_shared/edge-security.ts";

const corsHeaders: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const maxRequestBytes = 2_048;

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, "no-store", { state: "unavailable", feeds: [], unavailableSourceIds: [], fetchedAt: null, message: "Use POST." });
  if (!hasValidPublishableKey(request, Deno.env.get)) {
    return jsonResponse(401, "no-store", { state: "unavailable", feeds: [], unavailableSourceIds: [], fetchedAt: null, message: "A valid client API key is required." });
  }
  const body = await readBoundedJsonBody(request, maxRequestBytes);
  if (!body.ok) return jsonResponse(body.status, "no-store", { state: "unavailable", feeds: [], unavailableSourceIds: [], fetchedAt: null, message: body.message });

  const repository = createRepository();
  if (!repository) return jsonResponse(503, "no-store", { state: "unavailable", feeds: [], unavailableSourceIds: [], fetchedAt: null, message: "Cached source feeds are unavailable." });
  const result = await executeSourceFeed(body.value, repository);
  return jsonResponse(result.status, result.cacheControl, result.body);
});

function createRepository(): SourceFeedRepository | null {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = getSupabaseSecretKey(Deno.env.get);
  if (!url || !secretKey) return null;
  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async readCachedSourceFeeds(providerSourceIds, limitPerSource): Promise<readonly CachedSourceFeedRecord[]> {
      const { data: sourceRows, error: sourceError } = await client
        .from("sources")
        .select("id,provider,provider_source_id,handle,display_name,thumbnail_url,status")
        .eq("provider", "youtube")
        .in("provider_source_id", [...providerSourceIds]);
      if (sourceError) throw new Error("source cache unavailable");

      const sources = Array.isArray(sourceRows)
        ? sourceRows.flatMap((row: unknown) => {
          const source = mapSource(row);
          return source && isRecord(row) && typeof row.id === "string" ? [{ row, source, id: row.id }] : [];
        })
        : [];
      if (sources.length === 0) return [];
      const sourceIds = sources.map((entry) => entry.id);

      const [{ data: syncRows, error: syncError }, { data: mediaRows, error: mediaError }] = await Promise.all([
        client
          .from("source_sync_state")
          .select("source_id,last_success_at,next_attempt_at,last_error_code")
          .in("source_id", sourceIds),
        client.rpc("read_cached_source_feed_items", {
          p_provider_source_ids: [...providerSourceIds],
          p_limit_per_source: Math.min(limitPerSource, SOURCE_FEED_MAX_ITEMS_PER_SOURCE),
        }),
      ]);
      if (syncError) throw new Error("source freshness unavailable");
      if (mediaError) throw new Error("media cache unavailable");

      const syncBySourceId = new Map<string, Record<string, unknown>>();
      if (Array.isArray(syncRows)) {
        for (const row of syncRows) if (isRecord(row) && typeof row.source_id === "string") syncBySourceId.set(row.source_id, row);
      }
      const itemsBySourceId = new Map<string, CachedSourceFeedItem[]>();
      if (Array.isArray(mediaRows)) {
        for (const row of mediaRows) {
          if (!isRecord(row) || typeof row.source_id !== "string") continue;
          const item = mapItem(row);
          if (!item) continue;
          const items = itemsBySourceId.get(row.source_id) ?? [];
          items.push(item);
          itemsBySourceId.set(row.source_id, items);
        }
      }

      return sources.map(({ row, source, id }) => {
        const sync = syncBySourceId.get(id);
        return {
          source,
          sourceStatus: row.status === "active" || row.status === "unavailable" || row.status === "deleted" ? row.status : "unavailable",
          lastSuccessAt: optionalIsoDate(sync?.last_success_at),
          nextAttemptAt: optionalIsoDate(sync?.next_attempt_at),
          lastErrorCode: boundedText(sync?.last_error_code, 64),
          items: itemsBySourceId.get(id) ?? [],
        };
      });
    },
  };
}

function mapSource(value: unknown): CachedSourceFeedSource | null {
  if (!isRecord(value) || value.provider !== "youtube") return null;
  const providerSourceId = boundedText(value.provider_source_id, 64);
  const displayName = boundedText(value.display_name, 160);
  if (!providerSourceId || !/^UC[A-Za-z0-9_-]{22}$/.test(providerSourceId) || !displayName) return null;
  return {
    provider: "youtube",
    providerSourceId,
    handle: boundedText(value.handle, 64),
    displayName,
    thumbnailUrl: safeHttpsUrl(value.thumbnail_url),
  };
}

function mapItem(value: unknown): CachedSourceFeedItem | null {
  if (!isRecord(value) || value.provider !== "youtube") return null;
  const providerMediaId = boundedText(value.provider_media_id, 32);
  const title = boundedText(value.title, 500);
  const fetchedAt = optionalIsoDate(value.metadata_fetched_at);
  if (!providerMediaId || !/^[A-Za-z0-9_-]{11}$/.test(providerMediaId) || !title || !fetchedAt) return null;
  const durationSeconds = typeof value.duration_seconds === "number" && Number.isInteger(value.duration_seconds) && value.duration_seconds >= 0 && value.duration_seconds <= 31_536_000
    ? value.duration_seconds
    : null;
  return {
    provider: "youtube",
    providerMediaId,
    title,
    description: boundedText(value.description, 5_000) ?? "",
    thumbnailUrl: safeHttpsUrl(value.thumbnail_url),
    publishedAt: optionalIsoDate(value.published_at),
    durationSeconds,
    isLivestream: value.is_livestream === true,
    isUpcomingPremiere: value.is_upcoming_premiere === true,
    madeForKids: typeof value.made_for_kids === "boolean" ? value.made_for_kids : null,
    fetchedAt,
  };
}

function boundedText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximumLength ? normalized : null;
}
function optionalIsoDate(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}
function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function jsonResponse(status: number, cacheControl: string, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Accept-Encoding",
    },
  });
}
