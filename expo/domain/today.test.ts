import { describe, expect, test } from "bun:test";
import { getTodayPeriod, performTodayAction, selectTodayItems, visibleTodayItems } from "./today";
import type { CachedTodayCandidate, TodaySnapshotItem, TodaySourceRule } from "../models/today";

const profileId = "owner-default";
const sourceA = "UCabcdefghijklmnopqrstuv";
const sourceB = "UCabcdefghijklmnopqrstu2";
const now = new Date(2026, 8, 6, 12).getTime();

function candidate(id: string, sourceId: string, publishedOffset: number = 0): CachedTodayCandidate {
  return { id, title: `Video ${id}`, channelId: sourceId, channelTitle: sourceId === sourceA ? "Alpha" : "Beta", sourceId, sourceTitle: sourceId === sourceA ? "Alpha" : "Beta", thumbnailUrl: `https://example.com/${id}.jpg`, publishedAt: new Date(now - publishedOffset).toISOString(), durationSeconds: 600, description: "", madeForKids: false, isLivestream: false, isUpcomingPremiere: false, fetchedAt: now };
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

test("Today gives every eligible source one turn before second videos", () => {
  const sources = Array.from({ length: 12 }, (_, i) => `source-${i}`);
  const videos = sources.flatMap((source, i) => [candidate(`a${i}`, source, i * 10000), candidate(`b${i}`, source, i * 10000 + 1)]);
  const result = selectTodayItems(input(videos, { followedSourceIds: new Set(sources) }));
  expect(result).toHaveLength(12);
  expect(new Set(result.map((item) => item.sourceId)).size).toBe(12);
});

test("less recently shown sources get a turn ahead of frequent publishers", () => {
  const sources = Array.from({ length: 13 }, (_, i) => `source-${i}`);
  const videos = sources.map((source, i) => candidate(`new${i}`, source, i * 10000));
  const recent = videos.slice(0, 12).map((item) => history({ ...item, id: `old-${item.id}` }, "dismissed"));
  const result = selectTodayItems(input(videos, { followedSourceIds: new Set(sources), history: recent }));
  expect(result[0].sourceId).toBe(sources[12]);
  expect(result.map((item) => item.id)).toEqual(selectTodayItems(input([...videos].reverse(), { followedSourceIds: new Set(sources), history: recent })).map((item) => item.id));
});

test("library-only sources are excluded from new and visible snapshots without affecting follows", () => {
  const rules = new Map([[sourceA, { profileId, sourceId: sourceA, minimumDurationSeconds: 0, hideLivestreams: true, hideUpcomingPremieres: true, todayContributionLimit: 2, mutedUntil: Number.MAX_SAFE_INTEGER, updatedAt: now }]]);
  const videos = [candidate("a", sourceA), candidate("b", sourceB)];
  expect(selectTodayItems(input(videos, { rules })).map((item) => item.id)).toEqual(["b"]);
  const existing = selectTodayItems(input(videos));
  expect(visibleTodayItems(existing, new Set([sourceA, sourceB]), rules, now).map((item) => item.id)).toEqual(["b"]);
});

test("short-form cannot enter Today or reappear from legacy snapshots, snoozes, or permissive rules", () => {
  const short = { ...candidate("short", sourceA), durationSeconds: 239 };
  const unknown = { ...candidate("unknown", sourceB), durationSeconds: 0 };
  const long = { ...candidate("long", sourceB), durationSeconds: 240 };
  const snoozed = history(short, "snoozed", now - 1);
  const result = selectTodayItems(input([short, unknown, long], { history: [snoozed] }));
  expect(result.map((item) => item.id)).toEqual(["long"]);
  expect(visibleTodayItems([history(short, "pending"), history(unknown, "pending")], new Set([sourceA, sourceB]), new Map(), now)).toEqual([]);
});


test("favorites break equal-wait ties, but never leapfrog an older waiting source", () => {
  const videos = [candidate("a", sourceA, 1000), candidate("b", sourceB, 0)];
  const favorite: TodaySourceRule = { profileId, sourceId: sourceA, favorite: true, minimumDurationSeconds: 240, hideLivestreams: true, hideUpcomingPremieres: true, todayContributionLimit: 2, mutedUntil: null, updatedAt: now };
  const rules = new Map([[sourceA, favorite]]);
  expect(selectTodayItems(input(videos, { rules }))[0].sourceId).toBe(sourceA);
  const recent = history(candidate("old-a", sourceA), "dismissed");
  expect(selectTodayItems(input(videos, { rules, history: [recent] }))[0].sourceId).toBe(sourceB);
  expect(selectTodayItems(input(videos, { rules: new Map([[sourceA, { ...favorite, mutedUntil: Number.MAX_SAFE_INTEGER }]]) })).map((item) => item.sourceId)).toEqual([sourceB]);
});

test("even many prolific favorites cannot starve quieter sources over successive days", () => {
  const sources = Array.from({ length: 25 }, (_, i) => `fair-${i}`);
  const rules = new Map(sources.slice(0, 20).map((sourceId) => [sourceId, { profileId, sourceId, favorite: true, minimumDurationSeconds: 240, hideLivestreams: true, hideUpcomingPremieres: true, todayContributionLimit: 2, mutedUntil: null, updatedAt: now }]));
  const historyItems: TodaySnapshotItem[] = [];
  const appeared = new Set<string>();
  for (let day = 0; day < 3; day++) {
    const time = now + day * 86_400_000;
    const videos = sources.flatMap((sourceId, i) => Array.from({ length: i < 20 ? 10 : 1 }, (_, index) => candidate(`${day}-${i}-${index}`, sourceId)));
    const selected = selectTodayItems(input(videos, { now: time, period: getTodayPeriod(time), rules, followedSourceIds: new Set(sources), history: historyItems }));
    expect(selected).toHaveLength(12);
    expect(new Set(selected.map((item) => item.sourceId)).size).toBe(12);
    selected.forEach((item) => appeared.add(item.sourceId)); historyItems.push(...selected);
  }
  expect(appeared.size).toBe(25);
});

test("personal selection size reserves snoozes, shares sources fairly and cannot exceed twelve", () => {
  const sources = Array.from({ length: 15 }, (_, i) => `source-${i}`);
  const videos = sources.flatMap((source, i) => [candidate(`video-${i}-a`, source), candidate(`video-${i}-b`, source)]);
  const overdue = { ...history(videos[0], "snoozed"), snoozedUntil: now - 1000 };
  for (const maxItems of [1, 3, 6, 9, 12, 50]) {
    const result = selectTodayItems(input(videos, { maxItems, followedSourceIds: new Set(sources), history: [overdue] }));
    expect(result).toHaveLength(Math.min(maxItems, 12));
    expect(result[0].id).toBe(overdue.id);
    expect(new Set(result.map((item) => item.sourceId)).size).toBe(result.length);
  }
});
