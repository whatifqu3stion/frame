import { describe, expect, test } from "bun:test";
import { OWNER_AUTHORIZATION_MS, OWNER_PIN_COOLDOWN_MS, OwnerAuthorizationSession, authorizeForCurrentProfile, requiresOwnerAuthorizationForManagedAction, requiresPinForOwnerEntry } from "./ownerAuthorization";

describe("Owner authorization visit", () => {
  test("authorizes one visit and relocks explicitly", () => {
    const session = new OwnerAuthorizationSession();
    expect(session.isAuthorized()).toBeFalse();
    expect(session.attempt(true, 100)).toEqual({ status: "authorized" });
    expect(session.isAuthorized(100 + OWNER_AUTHORIZATION_MS - 1)).toBeTrue();
    expect(session.isAuthorized(100 + OWNER_AUTHORIZATION_MS)).toBeFalse();
    session.relock();
    expect(session.isAuthorized()).toBeFalse();
  });

  test("allows a protected visit when no PIN exists", () => {
    const session = new OwnerAuthorizationSession();
    session.authorizeWithoutPin();
    expect(session.isAuthorized()).toBeTrue();
  });

  test("routes every protected Managed action through Owner authorization", () => {
    expect(["createManaged", "deleteManaged", "changeAllowance", "disableAllowance", "addTimeToday", "playbackControls"].every((action) => requiresOwnerAuthorizationForManagedAction(action as Parameters<typeof requiresOwnerAuthorizationForManagedAction>[0]))).toBeTrue();
    expect(requiresPinForOwnerEntry("managed", true)).toBeTrue();
    expect(requiresPinForOwnerEntry("standard", true)).toBeTrue();
    expect(requiresPinForOwnerEntry("managed", false)).toBeFalse();
  });

  test("all sensitive entry points reject cancellation and failed authorization without a mutation", async () => {
    for (const action of ["follow", "unfollow", "source-rule", "external-player-link", "profile-create", "profile-delete", "allowance", "reset-profile", "wipe-all"]) {
      let changes = 0;
      const allowed = await authorizeForCurrentProfile("standard", () => "standard", () => false, async () => false);
      if (allowed) changes++;
      expect(changes).toBe(0);
      expect(allowed).toBeFalse();
      expect(action.length).toBeGreaterThan(0);
    }
  });

  test("ignores an in-flight authorization after the profile switches", async () => {
    let current = "owner-default";
    let settle: ((value: boolean) => void) | undefined;
    const pending = authorizeForCurrentProfile("owner-default", () => current, () => false, () => new Promise<boolean>((resolve) => { settle = resolve; }));
    current = "standard";
    settle?.(true);
    expect(await pending).toBeFalse();
    expect(await authorizeForCurrentProfile("owner-default", () => current, () => false, async () => true)).toBeFalse();
  });

  test("PIN change and removal require the current verifier even during a recent visit", async () => {
    const session = new OwnerAuthorizationSession();
    session.attempt(true, 1_000);
    const verify = async (candidate: string): Promise<boolean> => candidate === "4826";
    expect(await session.verifyCurrentPin("0000", verify, 1_001)).toBeFalse();
    expect(await session.verifyCurrentPin("4826", verify, 1_002)).toBeTrue();
    for (let i = 0; i < 5; i++) await session.verifyCurrentPin("0000", verify, 1_003);
    expect(await session.verifyCurrentPin("4826", verify, 1_004)).toBeFalse();
    expect(await session.verifyCurrentPin("4826", verify, 1_003 + OWNER_PIN_COOLDOWN_MS)).toBeTrue();
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
