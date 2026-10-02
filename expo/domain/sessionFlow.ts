import type { Video, VideoQueue } from "../types";
import { PRODUCT_LIMITS } from "../constants/productConfig";

/** Keeps one-to-three unique IDs in the order selected. */
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
