import { describe, expect, test } from "bun:test";
import { defaultSessionName, normalizeSessionTarget, sessionAdditionSummary, sessionRemainingRuntime, sessionBudgetSummary, nextSessionStep, normalizeSessionIds, positionAfterEdit, sessionPosition, sessionRuntime } from "./sessionFlow";
import type { VideoQueue, Video } from "../types";

const ids = ["video000001", "video000002", "video000003"];
const queue: VideoQueue = { id: "session", name: "Evening", orderedVideoIds: ids, updatedAt: 10, currentIndex: 1 };
const video = (id: string, durationSeconds: number): Video => ({ id, title: id, channelId: "", channelTitle: "", thumbnailUrl: "", publishedAt: "", durationSeconds });

describe("finite Session position and estimates", () => {
  test("keeps larger time-based plans ordered with a storage safety bound", () => {
    expect(normalizeSessionIds([ids[1], ids[1], ids[0], ids[2], "video000004"])).toEqual([ids[1], ids[0], ids[2], "video000004"]);
    expect(normalizeSessionIds(Array.from({ length: 12 }, (_, i) => `video${i}`))).toHaveLength(12);
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

test("default session names avoid collisions after deletion and renaming", () => {
  expect(defaultSessionName([])).toBe("Session 1");
  expect(defaultSessionName([{ name: "Session 1" }, { name: "Session 3" }, { name: "Evening" }])).toBe("Session 2");
  expect(defaultSessionName([{ name: " Session 1 " }, { name: "Session 2" }])).toBe("Session 3");
});

test("planning target reports overruns and unknown durations without inventing a fit", () => {
  expect(sessionBudgetSummary({ seconds: 1800, unknown: 0 }, 30)).toContain("exactly");
  expect(sessionBudgetSummary({ seconds: 1900, unknown: 0 }, 30)).toContain("2 min over");
  expect(sessionBudgetSummary({ seconds: 900, unknown: 1 }, 30)).toContain("can’t confirm");
  expect(sessionBudgetSummary({ seconds: 900, unknown: 0 }, 30)).toContain("15 min remaining");
});


test("candidate budgets handle exact fits, overruns, sub-minute slack and unknown evidence", () => {
  expect(sessionAdditionSummary({ seconds: 1200, unknown: 0 }, 600, 30)).toContain("exactly");
  expect(sessionAdditionSummary({ seconds: 1200, unknown: 0 }, 700, 30)).toContain("2 min over");
  expect(sessionAdditionSummary({ seconds: 1000, unknown: 0 }, 600, 30)).toContain("3 min");
  expect(sessionAdditionSummary({ seconds: 1190, unknown: 0 }, 600, 30)).toContain("less than 1 min");
  expect(sessionAdditionSummary({ seconds: 1200, unknown: 1 }, 600, 30)).toContain("unknown");
  expect(sessionAdditionSummary({ seconds: 1200, unknown: 0 }, 0, 30)).toContain("unknown");
  expect(sessionBudgetSummary({ seconds: 1799, unknown: 0 }, 30)).toContain("Less than 1 min");
  for (const invalid of [undefined, 0, -1, Infinity, "30", 31.5, 1441]) expect(normalizeSessionTarget(invalid)).toBeNull();
  expect(normalizeSessionTarget(30)).toBe(30);
  expect(normalizeSessionTarget(31)).toBe(31);
  expect(normalizeSessionTarget(1440)).toBe(1440);
  expect(normalizeSessionIds(Array.from({ length: 501 }, (_, i) => `video${i}`))).toHaveLength(500);
});

test("remaining session runtime uses only this session's current progress, clamped to known duration", () => {
  const videos = ids.map((id) => video(id, 600));
  const resume = { videoId: ids[1], timestampSeconds: 120, sessionId: queue.id, updatedAt: 1 };
  expect(sessionRemainingRuntime(queue, videos, [resume])).toEqual({ seconds: 1080, unknown: 0 });
  expect(sessionRemainingRuntime(queue, videos, [{ ...resume, sessionId: "other" }])).toEqual({ seconds: 1200, unknown: 0 });
  expect(sessionRemainingRuntime(queue, videos, [{ ...resume, timestampSeconds: 900 }])).toEqual({ seconds: 600, unknown: 0 });
  expect(sessionRemainingRuntime(queue, videos, [{ ...resume, timestampSeconds: NaN }])).toEqual({ seconds: 1200, unknown: 0 });
  expect(sessionRemainingRuntime(queue, [], [resume])).toEqual({ seconds: 0, unknown: 2 });
  expect(sessionRemainingRuntime({ ...queue, currentIndex: 3 }, videos, [resume])).toEqual({ seconds: 0, unknown: 0 });
});
