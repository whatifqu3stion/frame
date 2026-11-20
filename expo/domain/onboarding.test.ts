import { describe, expect, test } from "bun:test";
import { resolvedOnboardingFilm, interestPickWatchItem, onboardingDestination, onboardingNextAction, onboardingSelection } from "./onboarding";
import type { SourceResolution, WeeklyPickSourceSuggestion } from "../types";
import { defaultTodaySourceRule } from "./today";
import { METADATA_MAX_AGE_MS } from "./metadataRetention";
import type { TodaySnapshotItem } from "../models/today";

const now = new Date("2026-09-29T16:00:00Z").getTime();
function item(id: string, extra: Partial<TodaySnapshotItem> = {}): TodaySnapshotItem {
  return { id, profileId: "owner", periodKey: "2026-09-29", position: 0, disposition: "pending", dispositionAt: null, snoozedUntil: null, sourceId: "source", sourceTitle: "Source", channelId: "source", channelTitle: "Source", title: id, thumbnailUrl: "", publishedAt: "2026-09-28T00:00:00Z", durationSeconds: 600, fetchedAt: now - 1000, isLivestream: false, isUpcomingPremiere: false, ...extra };
}
describe("onboarding first value", () => {
  test("next actions name their destination and allow setup without optional choices", () => {
    expect(onboardingNextAction("welcome", 0, false)).toEqual({ label: "See how Frame works", finish: false, target: "contrast" });
    expect(onboardingNextAction("keys", 0, false)).toEqual({ label: "Continue", finish: false, target: "study" });
    expect(onboardingNextAction("keys", 0, false, "source")).toEqual({ label: "Back to your source", finish: false, target: "source" });
    expect(onboardingNextAction("keys", 0, false, "your-frame")).toEqual({ label: "Back to my picks", finish: false, target: "your-frame" });
    expect(onboardingNextAction("study", 0, false).target).toBe("intentions");
    expect(onboardingNextAction("intentions", 0, false).target).toBe("recall");
    expect(onboardingNextAction("recall", 0, false).target).toBe("welcome");
    expect(onboardingNextAction("contrast", 0, false).target).toBe("source");
    expect(onboardingNextAction("source", 0, false).target).toBe("bespoke");
    expect(onboardingNextAction("bespoke", 0, false)).toEqual({ label: "See my discoveries", finish: false, target: "your-frame" });
    expect(onboardingNextAction("source", 0, false, null, true)).toEqual({ label: "Finish for now", finish: true });
    expect(onboardingNextAction("source", 1, false, null, true)).toEqual({ label: "See my selection", finish: false, target: "your-frame" });
    expect(onboardingNextAction("source", 0, true, null, true)).toEqual({ label: "Preview selection", finish: false, target: "your-frame" });
    expect(onboardingNextAction("your-frame", 0, false)).toEqual({ label: "Open Today", finish: true });
    expect(onboardingNextAction("your-frame", 1, false)).toEqual({ label: "Open Today", finish: true });
    expect(onboardingNextAction("your-frame", 1, true)).toEqual({ label: "Open Today", finish: true });
  });
  test("interest picks use verified long-form metadata without claiming Today membership", () => {
    const pick: WeeklyPickSourceSuggestion = { provider: "youtube", providerSourceId: "creator", displayName: "An artist", description: "", thumbnailUrl: null, handle: null, fetchedAt: now, interestId: "design", publicationPeriod: { start: "2026-09-28", end: "2026-10-04" }, recommendationReason: null, featuredMedia: { provider: "youtube", providerMediaId: "abcdefghijk", title: "A studio visit", description: "", thumbnailUrl: null, durationSeconds: 560, publishedAt: null, isLivestream: false, isUpcomingPremiere: false } };
    expect(interestPickWatchItem(pick, "owner", now)).toMatchObject({ profileId: "owner", id: "abcdefghijk", sourceId: "creator" });
    expect(interestPickWatchItem(pick, "owner", now)).not.toHaveProperty("periodKey");
    expect(interestPickWatchItem({ ...pick, fetchedAt: now - METADATA_MAX_AGE_MS }, "owner", now)).toBeNull();
    expect(interestPickWatchItem({ ...pick, featuredMedia: { ...pick.featuredMedia!, durationSeconds: 60 } }, "owner", now)).toBeNull();
  });
  test("a pasted film can open from its verified source preview before following", () => {
    const resolved: SourceResolution = {
      source: { provider: "youtube", providerSourceId: "creator", handle: null, displayName: "Studio", description: "", thumbnailUrl: null },
      video: { provider: "youtube", providerMediaId: "abcdefghijk", title: "A studio visit", description: "", thumbnailUrl: null, publishedAt: null,
        durationSeconds: 560, madeForKids: true, isLivestream: false, isUpcomingPremiere: false },
      fetchedAt: now, provenance: "provider",
    };
    const film = resolvedOnboardingFilm(resolved, "owner", now);
    expect(film).toMatchObject({ id: "abcdefghijk", sourceId: "creator", profileId: "owner", madeForKids: true });
    expect(film).not.toHaveProperty("periodKey");
    expect(resolvedOnboardingFilm({ ...resolved, fetchedAt: now - METADATA_MAX_AGE_MS }, "owner", now)).toBeNull();
    for (const change of [{ durationSeconds: 20 }, { isUpcomingPremiere: true }, { isLivestream: true }]) {
      expect(resolvedOnboardingFilm({ ...resolved, video: { ...resolved.video!, ...change } }, "owner", now)).toBeNull();
    }
    expect(resolvedOnboardingFilm({ ...resolved, video: undefined }, "owner", now)).toBeNull();
  });
  test("completing or replaying setup lands on Today and scopes discovery to its viewer", () => {
    expect(onboardingDestination("owner", false)).toBe("/(tabs)");
    expect(onboardingDestination("owner", true)).toEqual({ pathname: "/(tabs)", params: { picksFor: "owner" } });
  });
  test("keeps a just-saved card visible without bringing back previously handled videos", () => {
    const result = onboardingSelection([item("pending"), item("saved-now", { disposition: "saved", position: 1 }), item("saved-before", { disposition: "saved" }), item("dismissed", { disposition: "dismissed" })], "owner", new Set(["source"]), new Map(), now, new Set(["saved-now"]));
    expect(result.map((video) => video.id)).toEqual(["pending", "saved-now"]);
  });
  test("never reveals another profile, an unfollowed source, or expired metadata", () => {
    const result = onboardingSelection([item("other-profile", { profileId: "child" }), item("unfollowed", { sourceId: "other" }), item("expired", { disposition: "saved", fetchedAt: now - METADATA_MAX_AGE_MS })], "owner", new Set(["source"]), new Map(), now, new Set(["expired"]));
    expect(result).toEqual([]);
    const muted = { ...defaultTodaySourceRule("owner", "source"), mutedUntil: now + 1000 };
    expect(onboardingSelection([item("muted", { disposition: "saved" })], "owner", new Set(["source"]), new Map([["source", muted]]), now, new Set(["muted"]))).toEqual([]);
  });
  test("does not duplicate a saved card in the reveal", () => {
    const video = item("one");
    expect(onboardingSelection([video], "owner", new Set(["source"]), new Map(), now, new Set(["one"]))).toEqual([video]);
  });
});
