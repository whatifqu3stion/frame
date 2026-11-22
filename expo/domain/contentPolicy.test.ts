import { expect, test } from "bun:test";
import { durationDecision, assertLongFormVideo, isShortsLink, playbackDurationDecision } from "./contentPolicy";
import { parseSourceInput } from "./sourceInput";
import { playerLifecycle } from "./playerLifecycle";
import { METADATA_MAX_AGE_MS } from "./metadataRetention";

const now = 1_800_000_000_000;
const video = { id: "abcdefghijk", durationSeconds: 600, fetchedAt: now - 1000 };
test("four-minute boundary rejects short-form and unknown duration and accepts exactly four minutes", () => {
  for (const duration of [1, 60, 180, 239, 239.99]) expect(durationDecision(duration)).toBe("short");
  for (const duration of [0, -1, NaN, Infinity, undefined, null, "600"]) expect(durationDecision(duration)).toBe("unverified");
  for (const duration of [240, 600, 3600]) expect(durationDecision(duration)).toBe("allowed");
  expect(() => assertLongFormVideo({ durationSeconds: 239 })).toThrow("four minutes");
  expect(() => assertLongFormVideo(null)).toThrow("verified duration");
});
test("explicit Shorts links are rejected including mobile and encoded paths", () => {
  for (const input of ["https://youtube.com/shorts/abcdefghijk", "m.youtube.com/shorts/abcdefghijk?x=1", "https://www.youtube.com/%73horts/abcdefghijk", "https://youtube.com/SHORTS/abcdefghijk"]) {
    expect(isShortsLink(input)).toBeTrue();
    expect(parseSourceInput(input).kind).toBe("unknown");
  }
  expect(parseSourceInput("https://youtu.be/abcdefghijk")).toEqual({ kind: "video", value: "abcdefghijk" });
});
test("playback requires current identity-matched evidence and the newest evidence wins", () => {
  expect(playbackDurationDecision(video.id, [], now)).toBe("unverified");
  expect(playbackDurationDecision(video.id, [{ ...video, id: "other" }], now)).toBe("unverified");
  expect(playbackDurationDecision(video.id, [{ ...video, fetchedAt: now - METADATA_MAX_AGE_MS }], now)).toBe("unverified");
  expect(playbackDurationDecision(video.id, [{ ...video, fetchedAt: now + 1 }], now)).toBe("unverified");
  expect(playbackDurationDecision(video.id, [video], now)).toBe("allowed");
  expect(playbackDurationDecision(video.id, [video, { ...video, durationSeconds: 60, fetchedAt: now }], now)).toBe("short");
  expect(playbackDurationDecision(video.id, [video, { ...video, durationSeconds: 0, fetchedAt: now }], now)).toBe("unverified");
});
test("owner approval and available viewing time never mount a player without duration clearance", () => {
  for (const duration of [0, 180, 239, 240]) {
    const allowed = playbackDurationDecision(video.id, [{ ...video, durationSeconds: duration }], now) === "allowed";
    expect(playerLifecycle({ contentAllowed: allowed, allowanceAllowed: true, resumeReady: true, focused: true, active: true, ended: false, failed: false, ready: true }).mount).toBe(duration === 240);
  }
});
