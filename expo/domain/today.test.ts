import { describe, expect, test } from "bun:test";
import { getTodayPeriod, performTodayAction, selectTodayItems, visibleTodayItems } from "./today";
import type { CachedTodayCandidate, TodaySnapshotItem, TodaySourceRule } from "../models/today";

const profileId = "owner-default";
const sourceA = "UCabcdefghijklmnopqrstuv";
const sourceB = "UCabcdefghijklmnopqrstu2";
const now = new Date(2026, 8, 6, 12).getTime();

function candidate(id: string, sourceId: string, publishedOffset: number = 0): CachedTodayCandidate {
  return { id, title: `Video ${id}`, channelId: sourceId, channelTitle: sourceId === sourceA ? "Alpha" : "Beta", sourceId, sourceTitle: sourceId === sourceA ? "Alpha" : "Beta", thumbnailUrl: `https://example.com/${id}.jpg`, publishedAt: new Date(now - publishedOffset).toISOString(), durationSeconds: 120, description: "", madeForKids: false, isLivestream: false, isUpcomingPremiere: false, fetchedAt: now };
}
function history(item: CachedTodayCandidate, disposition: TodaySnapshotItem["disposition"], snoozedUntil: number | null = null): TodaySnapshotItem {
  return { ...item, profileId, periodKey: "2026-09-05", position: 0, disposition, dispositionAt: now - 1_000, snoozedUntil };
}
function input(candidates: CachedTodayCandidate[], overrides: Partial<Parameters<typeof selectTodayItems>[0]> = {}) {
  return { profileId, period: getTodayPeriod(now), now, candidates, followedSourceIds: new Set([sourceA, sourceB]), rules: new Map<string, TodaySourceRule>(), savedMediaIds: new Set<string>(), sessionMediaIds: new Set<string>(), resumeMediaIds: new Set<string>(), history: [], ...overrides };
}

describe("finite Today selection", () => {
  test("uses a local 4 a.m. period boundary", () => {
    expect(getTodayPeriod(new Date(2026, 8, 6, 3, 59).getTime()).key).toBe("2026-09-05");
    expect(getTodayPeriod(new Date(2026, 8, 6, 4, 0).getTime()).key).toBe("2026-09-06");
  });

  test("is deterministic and enforces overall and per-source limits", () => {
    const candidates = Array.from({ length: 20 }, (_, index) => candidate(`video${String(index).padStart(6, "0")}`, index < 10 ? sourceA : sourceB, index * 1_000));
    const first = selectTodayItems(input(candidates));
    const second = selectTodayItems(input([...candidates].reverse()));
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(first).toHaveLength(4);
    expect(first.filter((item) => item.sourceId === sourceA)).toHaveLength(2);
    expect(first.filter((item) => item.sourceId === sourceB)).toHaveLength(2);
    expect(first.map((item) => item.position)).toEqual([0, 1, 2, 3]);
  });

  test("caps the overall snapshot at twelve across many sources", () => {
    const sources = Array.from({ length: 7 }, (_, index) => `source-${index}`);
    const candidates = sources.flatMap((sourceId, sourceIndex) => Array.from({ length: 3 }, (_, itemIndex) => candidate(`m${sourceIndex}${itemIndex}00000000`, sourceId, (sourceIndex * 3 + itemIndex) * 1_000)));
    const result = selectTodayItems(input(candidates, { followedSourceIds: new Set(sources) }));
    expect(result).toHaveLength(12);
    expect(Math.max(...sources.map((sourceId) => result.filter((item) => item.sourceId === sourceId).length))).toBe(2);
  });

  test("applies source rules and inactive-source filtering locally", () => {
    const short = { ...candidate("short000001", sourceA), durationSeconds: 20 };
    const live = { ...candidate("live0000001", sourceA), isLivestream: true };
    const upcoming = { ...candidate("premiere001", sourceA), isUpcomingPremiere: true };
    const mutedRule: TodaySourceRule = { profileId, sourceId: sourceB, minimumDurationSeconds: 0, hideLivestreams: true, hideUpcomingPremieres: true, todayContributionLimit: 2, mutedUntil: now + 10_000, updatedAt: now };
    const alphaRule: TodaySourceRule = { ...mutedRule, sourceId: sourceA, minimumDurationSeconds: 60, mutedUntil: null };
    const result = selectTodayItems(input([short, live, upcoming, candidate("valid000001", sourceA), candidate("muted000001", sourceB)], { rules: new Map([[sourceA, alphaRule], [sourceB, mutedRule]]) }));
    expect(result.map((item) => item.id)).toEqual(["valid000001"]);
  });

  test("excludes watched, dismissed, saved, session, and partially watched media", () => {
    const items = ["watch000001", "dismiss0001", "saved000001", "sessn000001", "resume00001", "open0000001"].map((id) => candidate(id, sourceA));
    const result = selectTodayItems(input(items, { history: [history(items[0], "watched"), history(items[1], "dismissed")], savedMediaIds: new Set([items[2].id]), sessionMediaIds: new Set([items[3].id]), resumeMediaIds: new Set([items[4].id]) }));
    expect(result.map((item) => item.id)).toEqual(["open0000001"]);
  });

  test("prioritizes overdue snoozes, keeps future returns hidden, and preserves profile visibility", () => {
    const overdue = history(candidate("snooze00001", sourceA), "snoozed", now - 1_000);
    const future = history(candidate("future000001", sourceB), "snoozed", now + 60_000);
    const selected = selectTodayItems(input([candidate("newone00001", sourceB)], { history: [future, overdue] }));
    expect(selected[0].id).toBe("snooze00001");
    expect(selected.some((item) => item.id === "future000001")).toBeTrue();
    expect(visibleTodayItems(selected, new Set([sourceA, sourceB]), new Map(), now).map((item) => item.id)).not.toContain("future000001");
    expect(visibleTodayItems(selected, new Set([sourceA, sourceB]), new Map(), now + 60_001).map((item) => item.id)).toContain("future000001");
    expect(visibleTodayItems(selected, new Set([sourceB]), new Map(), now + 60_001).map((item) => item.id)).not.toContain("snooze00001");
  });

  test("successful actions mark handled while failed actions stay visible", async () => {
    let marks = 0;
    expect(await performTodayAction(async () => true, async () => { marks += 1; return true; })).toBeTrue();
    expect(await performTodayAction(async () => false, async () => { marks += 1; return true; })).toBeFalse();
    expect(marks).toBe(1);
  });
});
