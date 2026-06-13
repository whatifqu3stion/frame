import type { Channel, Video } from "@/types";
import { SAMPLE_CHANNELS, SAMPLE_TOPIC_VIDEOS, SAMPLE_VIDEOS } from "@/constants/sampleData";

const API_BASE = "https://www.googleapis.com/youtube/v3";

function parseISO8601Duration(input: string): number {
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(input ?? "");
  if (!match) return 0;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  return h * 3600 + m * 60 + s;
}

type SearchListItem = {
  id: { videoId?: string; channelId?: string };
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    description: string;
    thumbnails: { medium?: { url: string }; high?: { url: string } };
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("[youtube] request failed", res.status, text.slice(0, 200));
    throw new Error("YouTube API request failed");
  }
  return (await res.json()) as T;
}

function pickThumb(item: SearchListItem): string {
  return item.snippet.thumbnails.high?.url ?? item.snippet.thumbnails.medium?.url ?? "";
}

export async function searchVideos(query: string, apiKey: string | null): Promise<Video[]> {
  if (!apiKey) {
    const lower = query.trim().toLowerCase();
    if (!lower) return SAMPLE_VIDEOS;
    return SAMPLE_VIDEOS.filter(
      (v) => v.title.toLowerCase().includes(lower) || v.channelTitle.toLowerCase().includes(lower),
    );
  }
  try {
    const searchUrl = `${API_BASE}/search?part=snippet&type=video&maxResults=24&q=${encodeURIComponent(query)}&key=${apiKey}`;
    const search = await fetchJson<{ items: SearchListItem[] }>(searchUrl);
    const ids = search.items.map((i) => i.id.videoId).filter(Boolean).join(",");
    if (!ids) return [];
    const detailsUrl = `${API_BASE}/videos?part=contentDetails,snippet&id=${ids}&key=${apiKey}`;
    const details = await fetchJson<{
      items: { id: string; contentDetails: { duration: string }; snippet: SearchListItem["snippet"] }[];
    }>(detailsUrl);
    return details.items.map<Video>((d) => ({
      id: d.id,
      title: d.snippet.title,
      channelId: d.snippet.channelId,
      channelTitle: d.snippet.channelTitle,
      thumbnailUrl: d.snippet.thumbnails.high?.url ?? d.snippet.thumbnails.medium?.url ?? "",
      publishedAt: d.snippet.publishedAt,
      durationSeconds: parseISO8601Duration(d.contentDetails.duration),
      description: d.snippet.description,
    }));
  } catch (err) {
    console.warn("[youtube] search failed, falling back to sample", err);
    return SAMPLE_VIDEOS;
  }
}

export async function getTopicVideos(topicId: string, apiKey: string | null): Promise<Video[]> {
  if (!apiKey) {
    const ids = SAMPLE_TOPIC_VIDEOS[topicId] ?? [];
    return SAMPLE_VIDEOS.filter((v) => ids.includes(v.id));
  }
  return searchVideos(topicId, apiKey);
}

export async function getChannelVideos(channelId: string, apiKey: string | null): Promise<Video[]> {
  if (!apiKey) {
    return SAMPLE_VIDEOS.filter((v) => v.channelId === channelId);
  }
  try {
    const url = `${API_BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=24&key=${apiKey}`;
    const res = await fetchJson<{ items: SearchListItem[] }>(url);
    return res.items
      .filter((i) => i.id.videoId)
      .map<Video>((i) => ({
        id: i.id.videoId as string,
        title: i.snippet.title,
        channelId: i.snippet.channelId,
        channelTitle: i.snippet.channelTitle,
        thumbnailUrl: pickThumb(i),
        publishedAt: i.snippet.publishedAt,
        durationSeconds: 0,
        description: i.snippet.description,
      }));
  } catch (err) {
    console.warn("[youtube] channel videos failed", err);
    return SAMPLE_VIDEOS.filter((v) => v.channelId === channelId);
  }
}

export async function getChannel(channelId: string, apiKey: string | null): Promise<Channel | null> {
  const sample = SAMPLE_CHANNELS.find((c) => c.id === channelId);
  if (!apiKey) return sample ?? null;
  try {
    const url = `${API_BASE}/channels?part=snippet&id=${channelId}&key=${apiKey}`;
    const res = await fetchJson<{
      items: { id: string; snippet: { title: string; description: string; thumbnails: { high?: { url: string } } } }[];
    }>(url);
    const item = res.items[0];
    if (!item) return sample ?? null;
    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.high?.url ?? "",
    };
  } catch (err) {
    console.warn("[youtube] channel failed", err);
    return sample ?? null;
  }
}

/** Extracts a YouTube video id from a raw URL or returns null. */
export function extractYouTubeId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  // Bare 11-char id
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.max(0, now - d.getTime());
    const day = 86400000;
    if (diff < day) return "Today";
    if (diff < day * 2) return "Yesterday";
    if (diff < day * 30) return `${Math.floor(diff / day)} days ago`;
    if (diff < day * 365) return `${Math.floor(diff / (day * 30))} months ago`;
    return `${Math.floor(diff / (day * 365))} years ago`;
  } catch {
    return "";
  }
}
