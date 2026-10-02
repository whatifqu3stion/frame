import { describe, expect, test } from "bun:test";
import { createPlayerAttempt, playerLifecycle, type PlayerConditions } from "./playerLifecycle";

const eligible: PlayerConditions = { resumeReady: true, contentAllowed: true, allowanceAllowed: true, focused: true, active: true, ended: false, failed: false, ready: false };

describe("player loading and restrictions", () => {
  test("starts loading only after both authorization checks resolve and permit playback", () => {
    for (const contentAllowed of [false, true]) for (const allowanceAllowed of [false, true]) {
      const result = playerLifecycle({ ...eligible, contentAllowed, allowanceAllowed });
      expect(result.mount).toBe(contentAllowed && allowanceAllowed);
      expect(result.loading).toBe(contentAllowed && allowanceAllowed);
    }
  });
  test("does not time out ready, ended, failed, departed, or unresolved players", () => {
    for (const change of [{ ready: true }, { ended: true }, { failed: true }, { focused: false }, { active: false }, { resumeReady: false }]) {
      expect(playerLifecycle({ ...eligible, ...change }).loading).toBe(false);
    }
  });
  test("revoking eligibility stops a load; approval permits a fresh load", () => {
    expect(playerLifecycle(eligible).loading).toBe(true);
    expect(playerLifecycle({ ...eligible, contentAllowed: false }).loading).toBe(false);
    expect(playerLifecycle(eligible).loading).toBe(true);
  });
});

describe("explicit replay intent", () => {
  test("normal load and retry never request autoplay", () => {
    const attempt = createPlayerAttempt();
    expect(attempt.consumeReplay(0)).toBe(false);
    expect(attempt.consumeReplay(attempt.cancel())).toBe(false);
  });
  test("a replay waits for its own ready event and plays only once", () => {
    const attempt = createPlayerAttempt();
    const previous = attempt.cancel();
    const replay = attempt.restart();
    expect(attempt.isCurrent(previous)).toBe(false);
    expect(attempt.consumeReplay(previous)).toBe(false);
    expect(attempt.consumeReplay(replay)).toBe(true);
    expect(attempt.consumeReplay(replay)).toBe(false);
  });
  test("leaving, backgrounding, blocking, or failing cancels pending replay", () => {
    const attempt = createPlayerAttempt();
    const replay = attempt.restart();
    const next = attempt.cancel();
    expect(attempt.isCurrent(replay)).toBe(false);
    expect(attempt.consumeReplay(replay)).toBe(false);
    expect(attempt.consumeReplay(next)).toBe(false);
  });
  test("a departed async restart cannot act after its persistence finishes", () => {
    const attempt = createPlayerAttempt();
    const pendingWrite = attempt.cancel();
    attempt.cancel();
    expect(attempt.isCurrent(pendingWrite)).toBe(false);
  });
});
