type Env = {
  YOUTUBE_API_KEY?: string;
};

type ApiStatus = "success" | "empty" | "partial" | "offline" | "unauthorized" | "quota" | "unavailable" | "failed";

type YouTubeThumbnail = { url?: string };
type YouTubeSnippet = {
  title?: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  liveBroadcastContent?: string;
  thumbnails?: { default?: YouTubeThumbnail; medium?: YouTubeThumbnail; high?: YouTubeThumbnail };
};
type SearchItem = { id?: { videoId?: string }; snippet?: YouTubeSnippet };
type VideoItem = {
  id?: string;
  snippet?: YouTubeSnippet;
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean; privacyStatus?: string };
};
type ChannelItem = {
  id?: string;
  snippet?: YouTubeSnippet;
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};
type PlaylistItem = { contentDetails?: { videoId?: string } };

const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HANDLE = /^[A-Za-z0-9_.-]{1,100}$/;
const requestBuckets = new Map<string, { startedAt: number; count: number }>();

function json(statusCode: number, status: ApiStatus, data?: unknown, message?: string): Response {
  return Response.json(
    { status, ...(data !== undefined ? { data } : {}), ...(message ? { message } : {}) },
    { status: statusCode, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}

function decodeText(value: string | undefined): string {
  const input = value ?? "";
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", "#39": "'" };
  return input.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|#39);/gi, (entity, code: string) => {
    if (code.toLowerCase().startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

function durationSeconds(value: string | undefined): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "");
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function thumbnail(snippet: YouTubeSnippet | undefined): string {
  return snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url ?? "";
}

function channelFromItem(item: ChannelItem): Record<string, unknown> | null {
  if (!item.id || !CHANNEL_ID.test(item.id) || !item.snippet?.title) return null;
  return {
    id: item.id,
    title: decodeText(item.snippet.title),
    description: decodeText(item.snippet.description),
    thumbnailUrl: thumbnail(item.snippet),
  };
}

function videoFromItem(item: VideoItem): Record<string, unknown> | null {
  const snippet = item.snippet;
  if (!item.id || !VIDEO_ID.test(item.id) || !snippet?.title || !snippet.channelId) return null;
  if (item.status?.embeddable !== true || item.status?.privacyStatus !== "public") return null;
  if (snippet.liveBroadcastContent && snippet.liveBroadcastContent !== "none") return null;
  return {
    id: item.id,
    title: decodeText(snippet.title),
    channelId: snippet.channelId,
    channelTitle: decodeText(snippet.channelTitle),
    thumbnailUrl: thumbnail(snippet),
    publishedAt: snippet.publishedAt ?? "",
    durationSeconds: durationSeconds(item.contentDetails?.duration),
    description: decodeText(snippet.description),
  };
}

async function youtubeJson<T>(path: string, env: Env): Promise<T> {
  if (!env.YOUTUBE_API_KEY) throw new Error("YOUTUBE_NOT_CONFIGURED");
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${YOUTUBE_BASE}${path}${separator}key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 403 && /quota|dailyLimitExceeded/i.test(body)) throw new Error("YOUTUBE_QUOTA");
    if (response.status === 404) throw new Error("YOUTUBE_NOT_FOUND");
    throw new Error(`YOUTUBE_${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchChannel(channelId: string, env: Env): Promise<Record<string, unknown> | null> {
  const result = await youtubeJson<{ items?: ChannelItem[] }>(
    `/channels?part=snippet,contentDetails&id=${encodeURIComponent(channelId)}`,
    env,
  );
  return result.items?.[0] ? channelFromItem(result.items[0]) : null;
}

async function fetchVideos(ids: string[], env: Env): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];
  const result = await youtubeJson<{ items?: VideoItem[] }>(
    `/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(ids.slice(0, 24).join(","))}`,
    env,
  );
  return (result.items ?? []).map(videoFromItem).filter((item): item is Record<string, unknown> => item !== null);
}

function rateLimit(request: Request): Response | null {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    requestBuckets.set(ip, { startedAt: now, count: 1 });
    return null;
  }
  bucket.count += 1;
  if (bucket.count > 60) return json(429, "quota", undefined, "Too many requests. Wait a moment and try again.");
  return null;
}

function mapError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "YOUTUBE_NOT_CONFIGURED") return json(503, "unavailable", undefined, "YouTube discovery is not configured yet.");
  if (message === "YOUTUBE_QUOTA") return json(429, "quota", undefined, "YouTube's request limit has been reached. Try again later.");
  if (message === "YOUTUBE_NOT_FOUND") return json(404, "empty", [], "That YouTube item was not found.");
  console.warn("[youtube] request failed", message);
  return json(502, "failed", undefined, "YouTube couldn't complete this request. Try again.");
}

async function handleSearch(url: URL, env: Env): Promise<Response> {
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!query) return json(400, "failed", undefined, "A search term is required.");
  const search = await youtubeJson<{ items?: SearchItem[] }>(
    `/search?part=snippet&type=video&maxResults=18&safeSearch=moderate&q=${encodeURIComponent(query)}`,
    env,
  );
  const ids = (search.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id && VIDEO_ID.test(id)));
  const videos = await fetchVideos(ids, env);
  return videos.length > 0 ? json(200, "success", videos) : json(200, "empty", [], "No verified, playable videos were found.");
}

async function handleChannel(channelId: string, env: Env): Promise<Response> {
  if (!CHANNEL_ID.test(channelId)) return json(400, "failed", undefined, "A valid YouTube channel id is required.");
  const channel = await fetchChannel(channelId, env);
  return channel ? json(200, "success", channel) : json(404, "empty", null, "That channel was not found.");
}

async function handleChannelVideos(channelId: string, env: Env): Promise<Response> {
  if (!CHANNEL_ID.test(channelId)) return json(400, "failed", undefined, "A valid YouTube channel id is required.");
  const channelResult = await youtubeJson<{ items?: ChannelItem[] }>(
    `/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`,
    env,
  );
  const uploads = channelResult.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return json(404, "empty", [], "That channel has no public uploads playlist.");
  const playlist = await youtubeJson<{ items?: PlaylistItem[] }>(
    `/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=24`,
    env,
  );
  const ids = (playlist.items ?? []).map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id && VIDEO_ID.test(id)));
  const videos = await fetchVideos(ids, env);
  return videos.length > 0 ? json(200, "success", videos) : json(200, "empty", [], "No verified, playable recent uploads were found.");
}

async function handleResolve(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { kind?: string; value?: string } | null;
  const kind = body?.kind;
  const value = body?.value?.trim() ?? "";
  let channelId = "";

  if (kind === "channelId" && CHANNEL_ID.test(value)) {
    channelId = value;
  } else if (kind === "handle" && HANDLE.test(value)) {
    const result = await youtubeJson<{ items?: ChannelItem[] }>(
      `/channels?part=snippet&forHandle=${encodeURIComponent(`@${value}`)}`,
      env,
    );
    channelId = result.items?.[0]?.id ?? "";
  } else if (kind === "video" && VIDEO_ID.test(value)) {
    const result = await youtubeJson<{ items?: VideoItem[] }>(
      `/videos?part=snippet,status&id=${encodeURIComponent(value)}`,
      env,
    );
    const item = result.items?.[0];
    if (item?.status?.embeddable !== true || item.status.privacyStatus !== "public") {
      return json(404, "empty", null, "That video is not publicly playable in Frame.");
    }
    channelId = item.snippet?.channelId ?? "";
  } else {
    return json(400, "failed", undefined, "A valid YouTube channel or video link is required.");
  }

  if (!CHANNEL_ID.test(channelId)) return json(404, "empty", null, "The creator for that link could not be found.");
  const channel = await fetchChannel(channelId, env);
  return channel ? json(200, "success", channel) : json(404, "empty", null, "That creator could not be found.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    if (url.pathname === "/ping" && request.method === "GET") {
      return json(200, "success", { now: new Date().toISOString() });
    }

    const quotaFailure = rateLimit(request);
    if (quotaFailure) return quotaFailure;

    try {
      if (url.pathname === "/youtube/search" && request.method === "GET") return await handleSearch(url, env);
      if (url.pathname === "/youtube/resolve" && request.method === "POST") return await handleResolve(request, env);
      const videosMatch = /^\/youtube\/channels\/(UC[A-Za-z0-9_-]{22})\/videos$/.exec(url.pathname);
      if (videosMatch?.[1] && request.method === "GET") return await handleChannelVideos(videosMatch[1], env);
      const channelMatch = /^\/youtube\/channels\/(UC[A-Za-z0-9_-]{22})$/.exec(url.pathname);
      if (channelMatch?.[1] && request.method === "GET") return await handleChannel(channelMatch[1], env);
      return json(404, "failed", undefined, "Route not found.");
    } catch (error) {
      return mapError(error);
    }
  },
};
