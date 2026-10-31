import { isLongFormVideo, isShortsLink, SHORT_FORM_MESSAGE } from "@/domain/contentPolicy";
import { byokYouTube } from "./byok";
import { validRecoveredVideo } from "@/domain/videoRecovery";
import { FEATURE_FLAGS } from "@/constants/config";
import { parseSourceInput, type ParsedSourceInput } from "@/domain/sourceInput";
import { unavailableSearchResult } from "@/services/searchPolicy";
import type { Channel, ServiceFailureKind, ServiceResult, SourceResolution, Video } from "@/types";

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

/** General video search is intentionally disabled. Scoped channel search lives in byokYouTube. */
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
    return { status: "failed", message: "A valid video ID is required." };
  }
  return failure("unavailable", "Additional metadata is unavailable. Playback uses the details already saved in Frame.");
}

/** Loads one real YouTube channel by its stable id. */
export async function getChannel(channelId: string): Promise<ServiceResult<Channel>> {
  try { return { status: "success", data: (await cachedContentService.getChannelShelf(channelId)).channel }; }
  catch { return failure("unavailable", "Cached source details are unavailable."); }
}

export type ParsedLink = ParsedSourceInput;

/** Backward-compatible name for Frame's strict manual-source parser. */
export const parseYouTubeLink = parseSourceInput;

/** Resolves one source directly with the device's YouTube key; following remains explicit. */
export async function resolveSourceFromInput(input: string, signal?: AbortSignal): Promise<ServiceResult<SourceResolution>> {
  if (isShortsLink(input)) return failure("invalid_request", SHORT_FORM_MESSAGE);
  const parsed = parseYouTubeLink(input);
  if (parsed.kind === "unknown") {
    return { status: "invalid_request", message: "Use a channel ID, @handle, channel URL, or individual supported video URL." };
  }
  return byokYouTube.resolve(input, signal);
}

/** Extracts a YouTube video id from a raw URL or returns null. */
export function extractYouTubeId(input: string): string | null {
  const text = input.trim();
  if (isShortsLink(text)) return null;
  if (!text) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/,
    /youtu\.be\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/,
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

export function resolutionVideoToVideo(resolution: SourceResolution): Video | null {
  const video = resolution.video;
  if (!video || !isLongFormVideo(video)) return null;
  return {
    id: video.providerMediaId,
    fetchedAt: resolution.fetchedAt ?? null,
    title: video.title,
    channelId: resolution.source.providerSourceId,
    channelTitle: resolution.source.displayName,
    thumbnailUrl: video.thumbnailUrl ?? "",
    publishedAt: video.publishedAt ?? "",
    durationSeconds: video.durationSeconds ?? 0,
    description: video.description,
    madeForKids: video.madeForKids,
  };
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


/** Explicit bounded resolution; does not follow a source or grant playback approval. */
export async function resolveVideoDetails(id: string, signal?: AbortSignal): Promise<ServiceResult<Video | null>> {
  if (!VIDEO_ID_PATTERN.test(id)) return failure("invalid_request", "This video link is invalid.");
  const result = await resolveSourceFromInput(`https://www.youtube.com/watch?v=${id}`, signal);
  if (result.status === "empty" || result.status === "partial") return failure("unavailable", result.message || "Current video details are unavailable.");
  if (result.status !== "success") return { status: result.status, message: result.message };
  const video = resolutionVideoToVideo(result.data);
  return validRecoveredVideo(id, video, Date.now()) ? { status: "success", data: video }
    : failure("unavailable", "Current details aren’t available for this video. Your saved link is kept.");
}
