import { describe, expect, test } from "bun:test";
import { OWNER_PIN_COOLDOWN_MS, OwnerAuthorizationSession } from "./ownerAuthorization";

describe("Owner authorization visit", () => {
  test("authorizes one visit and relocks explicitly", () => {
    const session = new OwnerAuthorizationSession();
    expect(session.isAuthorized()).toBeFalse();
    expect(session.attempt(true, 100)).toEqual({ status: "authorized" });
    expect(session.isAuthorized()).toBeTrue();
    session.relock();
    expect(session.isAuthorized()).toBeFalse();
  });

  test("allows a protected visit when no PIN exists", () => {
    const session = new OwnerAuthorizationSession();
    session.authorizeWithoutPin();
    expect(session.isAuthorized()).toBeTrue();
  });

  test("starts a cooldown after five incorrect entries and allows a later retry", () => {
    const session = new OwnerAuthorizationSession();
    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect(session.attempt(false, 1_000)).toEqual({ status: "incorrect", remainingAttempts: 5 - attempt });
    }
    expect(session.attempt(false, 1_000)).toEqual({ status: "cooldown", retryAt: 1_000 + OWNER_PIN_COOLDOWN_MS });
    expect(session.attempt(true, 2_000)).toEqual({ status: "cooldown", retryAt: 1_000 + OWNER_PIN_COOLDOWN_MS });
    expect(session.attempt(true, 1_000 + OWNER_PIN_COOLDOWN_MS)).toEqual({ status: "authorized" });
  });
});
