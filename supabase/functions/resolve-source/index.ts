import { createClient } from "@supabase/supabase-js";
import {
  executeSourceResolution,
  type CachedResolution,
  type ProviderChannel,
  type ProviderResult,
  type ProviderVideo,
  type SanitizedSource,
  type SanitizedVideo,
  type SourceResolutionRepository,
  type YouTubeResolutionProvider,
} from "../_shared/source-resolution.ts";
import { getSupabaseSecretKey, hasValidPublishableKey, readBoundedJsonBody } from "../_shared/edge-security.ts";

const corsHeaders: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const maxRequestBytes = 1024;
const providerTimeoutMs = 8000;

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { outcome: "invalid_request", message: "Use POST." });
  if (!hasValidPublishableKey(request, Deno.env.get)) {
    return jsonResponse(401, { outcome: "invalid_request", message: "A valid client API key is required." });
  }

  const body = await readBoundedJsonBody(request, maxRequestBytes);
  if (!body.ok) return jsonResponse(body.status, { outcome: "invalid_request", message: body.message });

  const repository = createRepository();
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!repository || !apiKey) {
    return jsonResponse(503, { outcome: "temporarily_unavailable", message: "Source verification is temporarily unavailable." });
  }

  const result = await executeSourceResolution(body.value, repository, createYouTubeProvider(apiKey));
  return jsonResponse(200, result);
});

function createRepository(): SourceResolutionRepository | null {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = getSupabaseSecretKey(Deno.env.get);
  if (!url || !secretKey) return null;
  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async findFresh(input, now): Promise<CachedResolution | null> {
      const sourceColumns = "provider,provider_source_id,handle,display_name,description,thumbnail_url,metadata_fetched_at";
      if (input.kind === "video") {
        const { data: media, error: mediaError } = await client
          .from("media_items")
          .select("source_id,provider,provider_media_id,title,description,thumbnail_url,published_at,duration_seconds,is_livestream,is_upcoming_premiere,made_for_kids,metadata_fetched_at")
          .eq("provider", "youtube")
          .eq("provider_media_id", input.value)
          .eq("status", "active")
          .gt("metadata_expires_at", now.toISOString())
          .maybeSingle();
        if (mediaError) throw new Error("media cache unavailable");
        if (!isRecord(media) || typeof media.source_id !== "string") return null;
        const { data: source, error: sourceError } = await client
          .from("sources")
          .select(sourceColumns)
          .eq("id", media.source_id)
          .eq("status", "active")
          .gt("metadata_expires_at", now.toISOString())
          .maybeSingle();
        if (sourceError) throw new Error("source cache unavailable");
        const mappedSource = mapSourceRow(source);
        const mappedVideo = mapVideoRow(media);
        const timestamp = oldestFetchTime([source, media], now);
        return mappedSource && mappedVideo && timestamp ? { source: mappedSource, video: mappedVideo, metadataFetchedAt: timestamp } : null;
      }

      let query = client
        .from("sources")
        .select(sourceColumns)
        .eq("provider", "youtube")
        .eq("status", "active")
        .gt("metadata_expires_at", now.toISOString());
      query = input.kind === "channelId"
        ? query.eq("provider_source_id", input.value)
        : query.eq("handle", `@${input.value.toLowerCase()}`);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error("source cache unavailable");
      const source = mapSourceRow(data);
      const timestamp = oldestFetchTime([data], now);
      return source && timestamp ? { source, metadataFetchedAt: timestamp } : null;
    },

    async reserve(installationToken, providerCallCount) {
      const { data, error } = await client.rpc("reserve_source_resolution_quota", {
        p_installation_token: installationToken,
        p_provider_call_count: providerCallCount,
      });
      if (error || !Array.isArray(data) || !isRecord(data[0])) throw new Error("quota reservation unavailable");
      const outcome = data[0].outcome;
      return outcome === "reserved" || outcome === "allowance_exhausted" || outcome === "quota_exhausted" || outcome === "temporarily_unavailable"
        ? outcome
        : "temporarily_unavailable";
    },

    async upsertSource(source, fetchedAt, expiresAt): Promise<SanitizedSource> {
      const { data, error } = await client
        .from("sources")
        .upsert({
          provider: "youtube",
          provider_source_id: source.providerSourceId,
          handle: source.handle,
          display_name: source.displayName,
          description: source.description,
          thumbnail_url: source.thumbnailUrl,
          status: "active",
          metadata_fetched_at: fetchedAt.toISOString(),
          metadata_expires_at: expiresAt.toISOString(),
        }, { onConflict: "provider,provider_source_id" })
        .select("provider,provider_source_id,handle,display_name,description,thumbnail_url")
        .single();
      if (error) throw new Error("source registration unavailable");
      const mapped = mapSourceRow(data);
      if (!mapped) throw new Error("source registration invalid");
      return mapped;
    },

    async upsertVideo(video, providerSourceId, fetchedAt, expiresAt): Promise<SanitizedVideo> {
      const { data: source, error: sourceError } = await client
        .from("sources")
        .select("id")
        .eq("provider", "youtube")
        .eq("provider_source_id", providerSourceId)
        .single();
      if (sourceError || !isRecord(source) || typeof source.id !== "string") throw new Error("source identity unavailable");
      const { data, error } = await client
        .from("media_items")
        .upsert({
          provider: "youtube",
          provider_media_id: video.providerMediaId,
          source_id: source.id,
          title: video.title,
          description: video.description,
          thumbnail_url: video.thumbnailUrl,
          published_at: video.publishedAt,
          duration_seconds: video.durationSeconds,
          is_livestream: video.isLivestream,
          is_upcoming_premiere: video.isUpcomingPremiere,
          made_for_kids: video.madeForKids,
          status: "active",
          metadata_fetched_at: fetchedAt.toISOString(),
          metadata_expires_at: expiresAt.toISOString(),
        }, { onConflict: "provider,provider_media_id" })
        .select("provider,provider_media_id,title,description,thumbnail_url,published_at,duration_seconds,is_livestream,is_upcoming_premiere,made_for_kids")
        .single();
      if (error) throw new Error("video registration unavailable");
      const mapped = mapVideoRow(data);
      if (!mapped) throw new Error("video registration invalid");
      return mapped;
    },

    async markDefinitiveNotFound(input): Promise<void> {
      if (input.kind === "video") {
        const { error } = await client.from("media_items").update({ status: "unavailable" })
          .eq("provider", "youtube").eq("provider_media_id", input.value);
        if (error) throw new Error("media status unavailable");
        return;
      }
      if (input.kind === "handle") return;
      const { error } = await client.from("sources").update({ status: "unavailable" })
        .eq("provider", "youtube").eq("provider_source_id", input.value);
      if (error) throw new Error("source status unavailable");
    },
  };
}

function oldestFetchTime(rows: readonly unknown[], now: Date): string | null {
  const dates = rows.map((row) => isRecord(row) && typeof row.metadata_fetched_at === "string" ? Date.parse(row.metadata_fetched_at) : NaN);
  if (dates.some((date) => !Number.isFinite(date) || date > now.getTime() || now.getTime() - date >= 30 * 86_400_000)) return null;
  return new Date(Math.min(...dates)).toISOString();
}

function createYouTubeProvider(apiKey: string): YouTubeResolutionProvider {
  return {
    async getChannel(kind, value): Promise<ProviderResult<ProviderChannel>> {
      const parameters: Readonly<Record<string, string>> = kind === "channelId"
        ? { part: "snippet", id: value }
        : { part: "snippet", forHandle: `@${value}` };
      const response = await youtubeRequest("channels", parameters, apiKey);
      if (response.outcome !== "success") return response;
      const item = firstItem(response.data);
      if (!item) return { outcome: "not_found" };
      const snippet = recordValue(item, "snippet");
      const id = stringValue(item, "id");
      const title = snippet ? stringValue(snippet, "title") : null;
      if (!id || !/^UC[A-Za-z0-9_-]{22}$/.test(id) || !title) return { outcome: "temporarily_unavailable" };
      const customUrl = snippet ? stringValue(snippet, "customUrl") : null;
      return {
        outcome: "success",
        data: {
          provider: "youtube",
          providerSourceId: id,
          handle: customUrl?.startsWith("@") ? `@${customUrl.slice(1).toLowerCase()}` : null,
          displayName: title,
          description: snippet ? stringValue(snippet, "description") ?? "" : "",
          thumbnailUrl: thumbnailFrom(snippet),
        },
      };
    },

    async getVideo(videoId): Promise<ProviderResult<ProviderVideo>> {
      const response = await youtubeRequest("videos", { part: "snippet,contentDetails,status", id: videoId }, apiKey);
      if (response.outcome !== "success") return response;
      const item = firstItem(response.data);
      if (!item) return { outcome: "not_found" };
      const snippet = recordValue(item, "snippet");
      const details = recordValue(item, "contentDetails");
      const status = recordValue(item, "status");
      const id = stringValue(item, "id");
      const channelId = snippet ? stringValue(snippet, "channelId") : null;
      const title = snippet ? stringValue(snippet, "title") : null;
      if (!id || !channelId || !title) return { outcome: "temporarily_unavailable" };
      const liveState = snippet ? stringValue(snippet, "liveBroadcastContent") : null;
      return {
        outcome: "success",
        data: {
          provider: "youtube",
          providerMediaId: id,
          providerSourceId: channelId,
          title,
          description: snippet ? stringValue(snippet, "description") ?? "" : "",
          thumbnailUrl: thumbnailFrom(snippet),
          publishedAt: snippet ? stringValue(snippet, "publishedAt") : null,
          durationSeconds: parseYouTubeDuration(details ? stringValue(details, "duration") : null),
          isLivestream: liveState === "live",
          isUpcomingPremiere: liveState === "upcoming",
          madeForKids: status && typeof status.madeForKids === "boolean" ? status.madeForKids : null,
        },
      };
    },
  };
}

async function youtubeRequest(
  resource: "channels" | "videos",
  parameters: Readonly<Record<string, string>>,
  apiKey: string,
): Promise<ProviderResult<Record<string, unknown>>> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  url.searchParams.set("key", apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (response.status === 404) return { outcome: "not_found" };
    if (!response.ok) return { outcome: "temporarily_unavailable" };
    const data = await response.json() as unknown;
    return isRecord(data) ? { outcome: "success", data } : { outcome: "temporarily_unavailable" };
  } catch (error) {
    return { outcome: error instanceof DOMException && error.name === "AbortError" ? "temporarily_unavailable" : "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}

function mapSourceRow(value: unknown): SanitizedSource | null {
  if (!isRecord(value)) return null;
  const providerSourceId = stringValue(value, "provider_source_id");
  const displayName = stringValue(value, "display_name");
  if (value.provider !== "youtube" || !providerSourceId || !displayName) return null;
  return {
    provider: "youtube",
    providerSourceId,
    handle: optionalString(value.handle),
    displayName,
    description: optionalString(value.description) ?? "",
    thumbnailUrl: optionalString(value.thumbnail_url),
  };
}

function mapVideoRow(value: unknown): SanitizedVideo | null {
  if (!isRecord(value)) return null;
  const providerMediaId = stringValue(value, "provider_media_id");
  const title = stringValue(value, "title");
  if (value.provider !== "youtube" || !providerMediaId || !title) return null;
  return {
    provider: "youtube",
    providerMediaId,
    title,
    description: optionalString(value.description) ?? "",
    thumbnailUrl: optionalString(value.thumbnail_url),
    publishedAt: optionalString(value.published_at),
    durationSeconds: typeof value.duration_seconds === "number" ? value.duration_seconds : null,
    isLivestream: value.is_livestream === true,
    isUpcomingPremiere: value.is_upcoming_premiere === true,
    madeForKids: typeof value.made_for_kids === "boolean" ? value.made_for_kids : null,
  };
}

function parseYouTubeDuration(value: string | null): number | null {
  if (!value) return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function firstItem(value: Record<string, unknown>): Record<string, unknown> | null {
  return Array.isArray(value.items) && isRecord(value.items[0]) ? value.items[0] : null;
}

function thumbnailFrom(snippet: Record<string, unknown> | null): string | null {
  const thumbnails = snippet ? recordValue(snippet, "thumbnails") : null;
  if (!thumbnails) return null;
  for (const quality of ["maxres", "standard", "high", "medium", "default"] as const) {
    const candidate = recordValue(thumbnails, quality);
    const url = candidate ? stringValue(candidate, "url") : null;
    if (url?.startsWith("https://")) return url;
  }
  return null;
}

function recordValue(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return isRecord(value[key]) ? value[key] : null;
}
function stringValue(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === "string" ? value[key] : null;
}
function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Accept-Encoding",
    },
  });
}
