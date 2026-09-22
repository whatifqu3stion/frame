import { describe, expect, test } from "bun:test";
import { nextSessionStep, normalizeSessionIds, positionAfterEdit, sessionPosition, sessionRuntime } from "./sessionFlow";
import type { VideoQueue, Video } from "../types";

const ids = ["video000001", "video000002", "video000003"];
const queue: VideoQueue = { id: "session", name: "Evening", orderedVideoIds: ids, updatedAt: 10, currentIndex: 1 };
const video = (id: string, durationSeconds: number): Video => ({ id, title: id, channelId: "", channelTitle: "", thumbnailUrl: "", publishedAt: "", durationSeconds });

describe("finite Session position and estimates", () => {
  test("limits a draft to three unique items while preserving order", () => {
    expect(normalizeSessionIds([ids[1], ids[1], ids[0], ids[2], "video000004"])).toEqual([ids[1], ids[0], ids[2]]);
    expect(normalizeSessionIds(["", "legacy-id"])).toEqual(["legacy-id"]);
  });
  test("keeps the current item through reorder and chooses the next slot after removal", () => {
    expect(positionAfterEdit(queue, [ids[1], ids[0], ids[2]])).toBe(0);
    expect(positionAfterEdit(queue, [ids[0], ids[2]])).toBe(1);
    expect(positionAfterEdit(queue, [])).toBe(0);
    expect(queue.orderedVideoIds).toEqual(ids);
  });
  test("finished remains finished through edit, with explicit restart", () => {
    const finished = { ...queue, currentIndex: ids.length };
    expect(sessionPosition(finished)).toBe(3);
    expect(positionAfterEdit(finished, ids.slice(0, 2))).toBe(2);
    expect(sessionPosition({ ...queue, currentIndex: 999 })).toBe(3);
    expect(nextSessionStep(ids, 2)).toBe(3);
    expect(nextSessionStep(ids, 3)).toBe(3);
  });
  test("does not pretend missing or invalid durations are known", () => {
    expect(sessionRuntime(ids, [video(ids[0], 90), video(ids[1], 0)], 0)).toEqual({ seconds: 90, unknown: 2 });
    expect(sessionRuntime(ids, [video(ids[0], 90), video(ids[1], 120)], 1)).toEqual({ seconds: 120, unknown: 1 });
    expect(sessionRuntime(ids, [], 3)).toEqual({ seconds: 0, unknown: 0 });
  });
});
