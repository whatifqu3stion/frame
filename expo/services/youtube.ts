import { APP_ENV, FEATURE_FLAGS } from "@/constants/config";
import { parseSourceInput, type ParsedSourceInput } from "@/domain/sourceInput";
import { unavailableSearchResult } from "@/services/searchPolicy";
import { installationIdentityStore } from "@/storage/installationIdentityStorage";
import type { Channel, ResolvedSource, ResolvedVideo, ServiceFailureKind, ServiceResult, SourceResolution, Video } from "@/types";

import { createCachedContentService } from "@/services/cachedContent";
import { sourceFeedClient } from "@/services/sourceFeedClientInstance";

export const cachedContentService = createCachedContentService(sourceFeedClient);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type VideoChapter = {
  title: string;
  startSeconds: number;
};

function failure<T>(status: ServiceFailureKind, message: string): ServiceResult<T> {
  return { status, message };
}

/** Legacy UI boundary. Round 1 disables live search centrally and never calls the backend. */
export async function searchVideos(query: string): Promise<ServiceResult<Video[]>> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "empty", data: [], message: "Enter something to search for." };
  return unavailableSearchResult();
}

/** Legacy topic boundary. Production discovery remains truthfully unavailable in Round 1. */
export async function getTopicVideos(topic: string): Promise<ServiceResult<Video[]>> {
  if (!FEATURE_FLAGS.youtubeDiscovery) return unavailableSearchResult();
  return searchVideos(topic);
}

/** Loads recent verified uploads for one stable YouTube channel id. */
export async function getChannelVideos(channelId: string): Promise<ServiceResult<Video[]>> {
  try {
    const shelf = await cachedContentService.getChannelShelf(channelId);
    return { status: shelf.videos.length ? "success" : "empty", data: shelf.videos };
  } catch { return failure("unavailable", "Cached uploads are unavailable. Try again later."); }
}

/** Disabled legacy enrichment boundary. Cached/local details remain usable without provider polling. */
export async function getVideo(videoId: string): Promise<ServiceResult<Video | null>> {
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return { status: "failed", message: "A valid YouTube video id is required." };
  }
  return failure("unavailable", "Additional metadata is unavailable. Playback uses the details already saved in Frame.");
}

/** Loads one real YouTube channel by its stable id. */
export async function getChannel(channelId: string): Promise<ServiceResult<Channel>> {
  try { return { status: "success", data: (await cachedContentService.getChannelShelf(channelId)).channel }; }
  catch { return failure("unavailable", "Cached source details are unavailable."); }
}

export type ParsedLink = ParsedSourceInput;

type SourceResolutionEnvelope = {
  outcome: "success" | "invalid_request" | "not_found" | "allowance_exhausted" | "quota_exhausted" | "temporarily_unavailable" | "network_error";
  source?: unknown;
  video?: unknown;
  provenance?: unknown;
  message?: unknown;
};

/** Backward-compatible name for Frame's strict manual-source parser. */
export const parseYouTubeLink = parseSourceInput;

/** Resolves and registers one shared source through Frame's bounded Supabase boundary. */
export async function resolveSourceFromInput(input: string): Promise<ServiceResult<SourceResolution>> {
  const parsed = parseYouTubeLink(input);
  if (parsed.kind === "unknown") {
    return { status: "invalid_request", message: "Use a channel ID, @handle, channel URL, or individual YouTube video URL." };
  }
  const supabaseUrl = APP_ENV === "development" ? process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") : undefined;
  const publishableKey = APP_ENV === "development"
    ? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    : undefined;
  if (!supabaseUrl || !publishableKey) {
    return { status: "temporarily_unavailable", message: "Source verification is not configured for this build." };
  }

  try {
    const installationToken = await installationIdentityStore.getOrCreate();
    const response = await fetch(`${supabaseUrl}/functions/v1/resolve-source`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", apikey: publishableKey },
      body: JSON.stringify({ ...parsed, installationToken }),
    });
    const envelope = await response.json().catch(() => null) as SourceResolutionEnvelope | null;
    if (!envelope || !isResolutionOutcome(envelope.outcome)) {
      return { status: "temporarily_unavailable", message: "Source verification returned an unreadable response." };
    }
    if (envelope.outcome !== "success") {
      return { status: envelope.outcome, message: typeof envelope.message === "string" ? envelope.message : sourceResolutionMessage(envelope.outcome) };
    }
    const source = parseResolvedSource(envelope.source);
    const video = envelope.video === undefined ? undefined : parseResolvedVideo(envelope.video);
    if (!source || (envelope.video !== undefined && !video) || (envelope.provenance !== "cache" && envelope.provenance !== "provider")) {
      return { status: "temporarily_unavailable", message: "Source verification returned incomplete metadata." };
    }
    return { status: "success", data: { source, ...(video ? { video } : {}), provenance: envelope.provenance } };
  } catch {
    return { status: "network_error", message: "Frame is offline. Check your connection and try again." };
  }
}

/** Extracts a YouTube video id from a raw URL or returns null. */
export function extractYouTubeId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/,
    /youtu\.be\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Parses creator-provided timestamp lines into navigable chapters.
 * Chapters are shown only when they follow YouTube's familiar structure: three or more
 * ascending entries beginning at 0:00, with no title or timestamp invented by Frame.
 */
export function parseVideoChapters(description: string | undefined, durationSeconds = 0): VideoChapter[] {
  const rows = (description ?? "").split(/\r?\n/);
  const chapters: VideoChapter[] = [];
  const seenStarts = new Set<number>();
  const linePattern = /^\s*(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)(?:\s*[-–—|:]\s*|\s+)(.+?)\s*$/;

  for (const row of rows) {
    const match = linePattern.exec(row);
    if (!match) continue;
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const startSeconds = hours * 3600 + minutes * 60 + seconds;
    const title = match[4]?.trim().replace(/\s+/g, " ") ?? "";
    if (!title || title.length > 120 || seenStarts.has(startSeconds)) continue;
    if (durationSeconds > 0 && startSeconds >= durationSeconds) continue;
    const previousStart = chapters[chapters.length - 1]?.startSeconds;
    if (previousStart !== undefined && startSeconds <= previousStart) return [];
    seenStarts.add(startSeconds);
    chapters.push({ title, startSeconds });
  }

  const ordered = chapters.slice(0, 24);
  if (ordered.length < 3 || ordered[0]?.startSeconds !== 0) return [];
  return ordered;
}

function parseResolvedSource(value: unknown): ResolvedSource | null {
  if (!isRecord(value) || value.provider !== "youtube" || typeof value.providerSourceId !== "string" || !/^UC[A-Za-z0-9_-]{22}$/.test(value.providerSourceId)) return null;
  if (typeof value.displayName !== "string" || typeof value.description !== "string") return null;
  if (value.handle !== null && typeof value.handle !== "string") return null;
  if (value.thumbnailUrl !== null && typeof value.thumbnailUrl !== "string") return null;
  return {
    provider: "youtube",
    providerSourceId: value.providerSourceId,
    handle: value.handle,
    displayName: value.displayName,
    description: value.description,
    thumbnailUrl: value.thumbnailUrl,
  };
}

function parseResolvedVideo(value: unknown): ResolvedVideo | null {
  if (!isRecord(value) || value.provider !== "youtube" || typeof value.providerMediaId !== "string" || !VIDEO_ID_PATTERN.test(value.providerMediaId)) return null;
  if (typeof value.title !== "string" || typeof value.description !== "string") return null;
  if (value.thumbnailUrl !== null && typeof value.thumbnailUrl !== "string") return null;
  if (value.publishedAt !== null && typeof value.publishedAt !== "string") return null;
  if (value.durationSeconds !== null && (typeof value.durationSeconds !== "number" || !Number.isInteger(value.durationSeconds))) return null;
  if (typeof value.isLivestream !== "boolean" || typeof value.isUpcomingPremiere !== "boolean") return null;
  if (value.madeForKids !== null && typeof value.madeForKids !== "boolean") return null;
  return {
    provider: "youtube",
    providerMediaId: value.providerMediaId,
    title: value.title,
    description: value.description,
    thumbnailUrl: value.thumbnailUrl,
    publishedAt: value.publishedAt,
    durationSeconds: value.durationSeconds,
    isLivestream: value.isLivestream,
    isUpcomingPremiere: value.isUpcomingPremiere,
    madeForKids: value.madeForKids,
  };
}

export function resolutionVideoToVideo(resolution: SourceResolution): Video | null {
  const video = resolution.video;
  if (!video) return null;
  return {
    id: video.providerMediaId,
    title: video.title,
    channelId: resolution.source.providerSourceId,
    channelTitle: resolution.source.displayName,
    thumbnailUrl: video.thumbnailUrl ?? `https://i.ytimg.com/vi/${video.providerMediaId}/hqdefault.jpg`,
    publishedAt: video.publishedAt ?? "",
    durationSeconds: video.durationSeconds ?? 0,
    description: video.description,
    madeForKids: video.madeForKids,
  };
}

function isResolutionOutcome(value: unknown): value is SourceResolutionEnvelope["outcome"] {
  return typeof value === "string" && ["success", "invalid_request", "not_found", "allowance_exhausted", "quota_exhausted", "temporarily_unavailable", "network_error"].includes(value);
}

function sourceResolutionMessage(outcome: Exclude<SourceResolutionEnvelope["outcome"], "success">): string {
  switch (outcome) {
    case "invalid_request": return "Use a supported YouTube source or individual video link.";
    case "not_found": return "No supported source was found for that link.";
    case "allowance_exhausted": return "This device has reached today’s source-verification allowance.";
    case "quota_exhausted": return "Frame’s shared YouTube allowance is reserved for the rest of today.";
    case "temporarily_unavailable": return "Source verification is temporarily unavailable.";
    case "network_error": return "Frame could not reach YouTube. Check your connection and try again.";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    if (!iso.trim()) return "";
    const date = new Date(iso);
    const time = date.getTime();
    if (!Number.isFinite(time)) return "";
    const diff = Math.max(0, Date.now() - time);
    const day = 86_400_000;
    if (diff < day) return "Today";
    if (diff < day * 2) return "Yesterday";
    if (diff < day * 30) return `${Math.floor(diff / day)} days ago`;
    if (diff < day * 365) return `${Math.floor(diff / (day * 30))} months ago`;
    return `${Math.floor(diff / (day * 365))} years ago`;
  } catch {
    return "";
  }
}
