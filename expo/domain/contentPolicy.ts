import { isMetadataCurrent } from "./metadataRetention";

/** Deliberate product boundary, not a claim to infer a video's style or quality. */
export const MIN_VIDEO_DURATION_SECONDS = 4 * 60;
export const SHORT_FORM_MESSAGE = "Frame includes videos of four minutes or longer. Short-form videos aren’t available here.";
export const UNVERIFIED_DURATION_MESSAGE = "Frame needs a verified duration of at least four minutes before this video can play. Check its details when connected.";
export type DurationDecision = "allowed" | "short" | "unverified";
export function durationDecision(duration: unknown): DurationDecision {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return "unverified";
  return duration >= MIN_VIDEO_DURATION_SECONDS ? "allowed" : "short";
}
export function isLongFormVideo(video: { durationSeconds?: number | null } | null | undefined): boolean {
  return durationDecision(video?.durationSeconds) === "allowed";
}
export function assertLongFormVideo(video: { durationSeconds?: number | null } | null | undefined): void {
  const decision = durationDecision(video?.durationSeconds);
  if (decision !== "allowed") throw new Error(decision === "short" ? SHORT_FORM_MESSAGE : UNVERIFIED_DURATION_MESSAGE);
}
export function isShortsLink(input: string): boolean {
  try {
    const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return ["youtube.com", "m.youtube.com"].includes(host) && decodeURIComponent(url.pathname).toLowerCase().split("/").filter(Boolean)[0] === "shorts";
  } catch { return false; }
}

type DurationEvidence = { id: string; durationSeconds: number; fetchedAt?: number | null };
/** Callers supply local/provider evidence only, never route parameters. Newer evidence wins. */
export function playbackDurationDecision(id: string, evidence: readonly (DurationEvidence | null | undefined)[], now: number): DurationDecision {
  const current = evidence.filter((video): video is DurationEvidence => Boolean(video && video.id === id && isMetadataCurrent(video.fetchedAt, now)))
    .sort((a, b) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0));
  return durationDecision(current[0]?.durationSeconds);
}
