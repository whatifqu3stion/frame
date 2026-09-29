import { describe, expect, test } from "bun:test";
import { demoCheckoutReducer, onboardingDestination, onboardingSelection } from "./onboarding";
import { defaultTodaySourceRule } from "./today";
import { METADATA_MAX_AGE_MS } from "./metadataRetention";
import type { TodaySnapshotItem } from "../models/today";

const now = new Date("2026-09-29T16:00:00Z").getTime();
function item(id: string, extra: Partial<TodaySnapshotItem> = {}): TodaySnapshotItem {
  return { id, profileId: "owner", periodKey: "2026-09-29", position: 0, disposition: "pending", dispositionAt: null, snoozedUntil: null, sourceId: "source", sourceTitle: "Source", channelId: "source", channelTitle: "Source", title: id, thumbnailUrl: "", publishedAt: "2026-09-28T00:00:00Z", durationSeconds: 180, fetchedAt: now - 1000, isLivestream: false, isUpcomingPremiere: false, ...extra };
}
describe("onboarding first value and demo checkout", () => {
  test("ends in content when sources exist, and a useful starting point otherwise", () => {
    expect(onboardingDestination(2, false)).toBe("/(tabs)");
    expect(onboardingDestination(0, false)).toBe("/(tabs)/sources");
    expect(onboardingDestination(0, true)).toBe("/(tabs)/settings");
    expect(onboardingDestination(2, true)).toBe("/(tabs)/settings");
    expect(onboardingDestination(2, false, 1)).toBe("/(tabs)/saved");
    expect(onboardingDestination(2, true, 1)).toBe("/(tabs)/settings");
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
  test("previewing a selected plan creates only temporary demo state", () => {
    const selected = demoCheckoutReducer({ plan: "annual", completed: false }, { type: "select", plan: "monthly" });
    expect(demoCheckoutReducer(selected, { type: "preview" })).toEqual({ plan: "monthly", completed: true });
    expect(demoCheckoutReducer({ plan: "monthly", completed: true }, { type: "reset" })).toEqual({ plan: "monthly", completed: false });
    expect(demoCheckoutReducer({ plan: "monthly", completed: true }, { type: "select", plan: "annual" })).toEqual({ plan: "annual", completed: false });
  });
});
