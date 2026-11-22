import { describe, expect, test } from "bun:test";
import type { TodaySnapshotItem } from "../models/today";
import { todayFeedbackReducer, todayFeedbackRoute } from "./todayFeedback";

const dismissedVideo: TodaySnapshotItem = {
  id: "video-a", title: "First video", channelId: "source", channelTitle: "Source",
  sourceId: "source", sourceTitle: "Source", thumbnailUrl: "", publishedAt: "",
  durationSeconds: 60, fetchedAt: 1, isLivestream: false, isUpcomingPremiere: false,
  profileId: "owner", periodKey: "2026-10-01", position: 0, disposition: "pending",
  dispositionAt: null, snoozedUntil: null,
};

describe("Today result feedback", () => {
  test("a save timeout can dismiss only the confirmation that scheduled it", () => {
    const saved = todayFeedbackReducer(null, { type: "saved", profileId: "owner", videoId: "video-b" })!;
    const repeatedSave = todayFeedbackReducer(saved, { type: "saved", profileId: "owner", videoId: "video-b" });
    const undo = todayFeedbackReducer(saved, { type: "dismissed", item: dismissedVideo });
    const expiry = { type: "expireCollection" as const, notice: saved };
    expect(todayFeedbackReducer(saved, expiry)).toBeNull();
    expect(todayFeedbackReducer(repeatedSave, expiry)).toBe(repeatedSave);
    expect(todayFeedbackReducer(undo, expiry)).toBe(undo);
  });

  test("saving B after dismissing A replaces A's Undo with the Saved action", () => {
    const dismissed = todayFeedbackReducer(null, { type: "dismissed", item: dismissedVideo });
    expect(dismissed?.action).toBe("undoDismiss");
    const saved = todayFeedbackReducer(dismissed, { type: "saved", profileId: "owner", videoId: "video-b" });
    expect(saved).toEqual({ profileId: "owner", message: "Video saved", action: "viewSaved", target: { videoId: "video-b" } });
    expect(todayFeedbackRoute(saved!)).toBe("/(tabs)/saved");
  });

  test("adding to or creating a session opens the exact resulting session", () => {
    let state = todayFeedbackReducer(null, { type: "dismissed", item: dismissedVideo });
    for (const sessionId of ["existing-session-b", "newly-created-session-c"]) {
      state = todayFeedbackReducer(state, { type: "session", profileId: "owner", sessionId, name: "A slow Sunday" });
      expect(state?.action).toBe("openSession");
      expect(state?.message).toBe("Added to A slow Sunday");
      expect(todayFeedbackRoute(state!)).toEqual({ pathname: "/session/[id]", params: { id: sessionId } });
      expect(state?.target).toEqual({ sessionId });
    }
  });

  test("snoozing another item cannot retain an earlier dismissal action", () => {
    const dismissed = todayFeedbackReducer(null, { type: "dismissed", item: dismissedVideo });
    const snoozed = todayFeedbackReducer(dismissed, { type: "snoozed", profileId: "owner", videoId: "video-b", until: 1_800_000_000_000 });
    expect(snoozed?.action).toBeNull();
    expect(snoozed?.target).toEqual({ videoId: "video-b" });
    expect(todayFeedbackRoute(snoozed!)).toBeNull();
  });

  test("clearing a message removes its target while dismissal preserves restoration details", () => {
    const item = { ...dismissedVideo, disposition: "snoozed" as const, snoozedUntil: 1000 };
    const dismissed = todayFeedbackReducer(null, { type: "dismissed", item });
    expect(dismissed?.target).toEqual({ item, previous: "snoozed", snoozedUntil: 1000 });
    expect(todayFeedbackReducer(dismissed, { type: "clear" })).toBeNull();
  });
});
