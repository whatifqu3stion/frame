import { expect, test } from "bun:test";
import { createSessionClock, emptySessionRun, sessionAllowsVideo, sessionCanFinish, sessionTimeRemaining } from "./sessionTimer";

test("session usage counts playback only across pause, buffering, background and restart", () => {
  let now = 0;
  let clock = createSessionClock(emptySessionRun(), () => now);
  now = 10000;
  expect(clock.snapshot().consumedSeconds).toBe(0);
  clock.playing(true, "one"); now += 1250;
  expect(clock.snapshot().consumedSeconds).toBe(1.25);
  clock.playing(false); now += 60000;
  expect(clock.snapshot().consumedSeconds).toBe(1.25);
  clock = createSessionClock(clock.snapshot(), () => now);
  clock.playing(true, "two"); now += 2500; clock.playing(false);
  expect(clock.snapshot().consumedSeconds).toBe(3.75);
  expect(clock.snapshot().lastVideoId).toBe("two");
  expect(sessionTimeRemaining(clock.snapshot(), 1)).toBe(56.25);
});

test("expiry permits one explicit finish of the video that was playing, then ends", () => {
  let now = 0;
  const clock = createSessionClock(emptySessionRun(), () => now);
  clock.playing(true, "current"); now = 60000; clock.playing(false);
  expect(sessionAllowsVideo(clock.snapshot(), 1, "current")).toBeFalse();
  expect(sessionCanFinish(clock.snapshot(), 1, "current")).toBeTrue();
  expect(sessionCanFinish(clock.snapshot(), 1, "different")).toBeFalse();
  clock.finish("different"); expect(clock.snapshot().finishVideoId).toBeNull();
  clock.finish("current");
  expect(sessionAllowsVideo(clock.snapshot(), 1, "current")).toBeTrue();
  expect(sessionAllowsVideo(clock.snapshot(), 1, "next")).toBeFalse();
  clock.finish("next"); expect(clock.snapshot().finishVideoId).toBe("current");
  clock.playing(true, "current"); now += 20000;
  clock.end();
  expect(sessionAllowsVideo(clock.snapshot(), 1, "current")).toBeFalse();
  expect(sessionCanFinish(clock.snapshot(), 1, "current")).toBeFalse();
  clock.playing(true, "next"); now += 20000;
  expect(clock.snapshot().consumedSeconds).toBe(80);
});

test("seeking does not consume time and a new run has its own allowance", () => {
  let now = 1000;
  const clock = createSessionClock(emptySessionRun(), () => now);
  clock.playing(true, "one"); // No media position is accepted by this clock.
  now += 5000;
  expect(sessionTimeRemaining(clock.snapshot(), 1)).toBe(55);
  expect(sessionCanFinish(clock.snapshot(), 1, "one")).toBeFalse();
  expect(sessionTimeRemaining({ ...emptySessionRun(), runId: 1 }, 1)).toBe(60);
});
