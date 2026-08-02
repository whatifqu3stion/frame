import type { Channel, ServiceFailureKind, ServiceResult, Video } from "@/types";

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL?.replace(/\/$/, "") ?? "";

type BackendEnvelope<T> = {
  status: "success" | "empty" | "partial" | ServiceFailureKind;
  data?: T;
  message?: string;
};

function failure<T>(status: ServiceFailureKind, message: string): ServiceResult<T> {
  return { status, message };
}

async function requestBackend<T>(path: string, init?: RequestInit): Promise<ServiceResult<T>> {
  if (!FUNCTIONS_URL) {
    return failure("unavailable", "Frame's YouTube service is not configured for this build.");
  }

  try {
    const response = await fetch(`${FUNCTIONS_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const envelope = (await response.json().catch(() => null)) as BackendEnvelope<T> | null;
    if (!envelope) return failure("failed", "YouTube returned an unreadable response.");

    if (envelope.status === "success" && envelope.data !== undefined) {
      return { status: "success", data: envelope.data };
    }
    if (envelope.status === "empty" && envelope.data !== undefined) {
      return { status: "empty", data: envelope.data, message: envelope.message };
    }
    if (envelope.status === "partial" && envelope.data !== undefined) {
      return { status: "partial", data: envelope.data, message: envelope.message ?? "Some results could not be loaded." };
    }
    if (["offline", "unauthorized", "quota", "unavailable", "failed"].includes(envelope.status)) {
      return failure(envelope.status as ServiceFailureKind, envelope.message ?? "YouTube is unavailable right now.");
    }
    return failure("failed", "YouTube returned an unexpected response.");
  } catch (error) {
    console.warn("[youtube] backend request failed", error instanceof Error ? error.message : "unknown error");
    return failure("offline", "Frame couldn't reach YouTube. Check your connection and try again.");
  }
}

/** Searches verified, embeddable YouTube videos. */
export async function searchVideos(query: string): Promise<ServiceResult<Video[]>> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "empty", data: [], message: "Enter something to search for." };
  return requestBackend<Video[]>(`/youtube/search?q=${encodeURIComponent(trimmed)}`);
}

/** Loads a finite topic collection from the protected YouTube service. */
export async function getTopicVideos(topic: string): Promise<ServiceResult<Video[]>> {
  return searchVideos(topic);
}

/** Loads recent verified uploads for one stable YouTube channel id. */
export async function getChannelVideos(channelId: string): Promise<ServiceResult<Video[]>> {
  return requestBackend<Video[]>(`/youtube/channels/${encodeURIComponent(channelId)}/videos`);
}

/** Loads one real YouTube channel by its stable id. */
export async function getChannel(channelId: string): Promise<ServiceResult<Channel>> {
  return requestBackend<Channel>(`/youtube/channels/${encodeURIComponent(channelId)}`);
}

export type ParsedLink =
  | { kind: "channelId"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "video"; value: string }
  | { kind: "unknown"; value: string };

/** Classifies a pasted YouTube link as a channel id, @handle, or video. */
export function parseYouTubeLink(input: string): ParsedLink {
  const text = input.trim();
  if (!text) return { kind: "unknown", value: "" };

  const channelId = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})(?:[/?#]|$)/i.exec(text);
  if (channelId?.[1]) return { kind: "channelId", value: channelId[1] };
  if (/^UC[A-Za-z0-9_-]{22}$/.test(text)) return { kind: "channelId", value: text };

  const handle = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([A-Za-z0-9_.-]+)(?:[/?#]|$)/i.exec(text);
  if (handle?.[1]) return { kind: "handle", value: handle[1] };
  if (/^@[A-Za-z0-9_.-]+$/.test(text)) return { kind: "handle", value: text.slice(1) };

  const legacy = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c|user)\/([A-Za-z0-9_.-]+)(?:[/?#]|$)/i.exec(text);
  if (legacy?.[1]) return { kind: "handle", value: legacy[1] };

  const videoId = extractYouTubeId(text);
  if (videoId) return { kind: "video", value: videoId };
  return { kind: "unknown", value: text };
}

/** Resolves a link to a verified stable channel; placeholders are never returned. */
export async function resolveChannelFromLink(parsed: ParsedLink): Promise<ServiceResult<Channel>> {
  if (parsed.kind === "unknown") {
    return { status: "failed", message: "That doesn't look like a YouTube channel or video link." };
  }
  return requestBackend<Channel>("/youtube/resolve", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
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
