import type { ResumePosition, Video, VideoQueue } from "../types";
import { PRODUCT_LIMITS } from "../constants/productConfig";

/** Bounded storage safety limit; session duration, not item count, controls viewing. */
export function normalizeSessionIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 128))].slice(0, PRODUCT_LIMITS.sessionDraftMaxItems);
}

/** A finished cursor stays finished until the viewer explicitly begins again. */
export function sessionPosition(queue: VideoQueue): number {
  return Number.isInteger(queue.currentIndex) ? Math.max(0, Math.min(queue.currentIndex, queue.orderedVideoIds.length)) : 0;
}

/** Keep the current video selected across edits; removal chooses the next available slot. */
export function positionAfterEdit(queue: VideoQueue, nextIds: readonly string[]): number {
  const current = queue.orderedVideoIds[sessionPosition(queue)];
  if (!current && sessionPosition(queue) === queue.orderedVideoIds.length) return nextIds.length;
  const newIndex = current ? nextIds.indexOf(current) : -1;
  return newIndex >= 0 ? newIndex : Math.min(sessionPosition(queue), nextIds.length);
}

/** Estimates only known duration; unknown videos are never counted as zero-minute plans. */
export function sessionRuntime(ids: readonly string[], videos: readonly Video[], fromIndex: number = 0): { seconds: number; unknown: number } {
  const map = new Map(videos.map((video) => [video.id, video.durationSeconds]));
  return ids.slice(fromIndex).reduce((total, id) => {
    const duration = map.get(id);
    return duration && Number.isFinite(duration) && duration > 0
      ? { ...total, seconds: total.seconds + duration }
      : { ...total, unknown: total.unknown + 1 };
  }, { seconds: 0, unknown: 0 });
}

/** The next step is offered, never played automatically. */
export function nextSessionStep(ids: readonly string[], index: number): number {
  return Math.min(ids.length, Math.max(0, index + 1));
}


/** Shared editable fallback for quick creation and the full builder. */
export function defaultSessionName(sessions: readonly Pick<VideoQueue, "name">[]): string {
  const names = new Set(sessions.map((session) => session.name.trim()));
  let number = 1;
  while (names.has(`Session ${number}`)) number += 1;
  return `Session ${number}`;
}

/** A runtime estimate; the actual playback clock controls when the session pauses. */
export function sessionBudgetSummary(runtime: { seconds: number; unknown: number }, minutes: number): string {
  const difference = minutes * 60 - runtime.seconds;
  if (difference < 0) return `${Math.ceil(-difference / 60)} min over your target${runtime.unknown ? ", with more time unaccounted for" : ""}. Frame will pause at your duration and offer to finish the current video.`;
  if (runtime.unknown) return "Some durations are unavailable, so Frame can’t confirm this plan fits your target.";
  return difference === 0 ? "This plan fits your target exactly, before breaks." : difference < 60 ? "Less than 1 min remaining in your target, before breaks." : `${Math.floor(difference / 60)} min remaining in your target, before breaks.`;
}


export const SESSION_TARGET_MINUTES = [15, 30, 60, 90] as const;
export function normalizeSessionTarget(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1440 ? value : null;
}

/** Subtract progress only from the current item and only when recorded in this session. */
export function sessionRemainingRuntime(queue: VideoQueue, videos: readonly Video[], resumes: readonly ResumePosition[]): { seconds: number; unknown: number } {
  const position = sessionPosition(queue);
  const remaining = sessionRuntime(queue.orderedVideoIds, videos, position);
  const currentId = queue.orderedVideoIds[position];
  const duration = videos.find((video) => video.id === currentId)?.durationSeconds;
  const resume = resumes.find((item) => item.videoId === currentId && item.sessionId === queue.id);
  if (!duration || !Number.isFinite(duration) || duration <= 0 || !resume || !Number.isFinite(resume.timestampSeconds)) return remaining;
  return { ...remaining, seconds: remaining.seconds - Math.max(0, Math.min(duration, resume.timestampSeconds)) };
}

/** A planning estimate: videos may extend beyond the chosen session duration. */
export function sessionAdditionSummary(runtime: { seconds: number; unknown: number }, candidateSeconds: number, minutes: number): string {
  if (!Number.isFinite(candidateSeconds) || candidateSeconds <= 0 || runtime.unknown) return "Fit unknown until durations are verified.";
  const left = minutes * 60 - runtime.seconds - candidateSeconds;
  if (left < 0) return `Would put the plan ${Math.ceil(-left / 60)} min over target`;
  if (left === 0) return "Would fit the target exactly";
  if (left < 60) return "Would leave less than 1 min";
  return `Would leave ${Math.floor(left / 60)} min`;
}
