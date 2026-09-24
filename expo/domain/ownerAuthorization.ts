export const OWNER_PIN_MAX_FAILURES = 5;
export const OWNER_PIN_COOLDOWN_MS = 30_000;
export const OWNER_AUTHORIZATION_MS = 120_000;

export type ManagedProtectedAction = "createManaged" | "deleteManaged" | "changeAllowance" | "disableAllowance" | "addTimeToday" | "playbackControls" | "contentAccess";

/** Managed settings always pass through the Owner gate; a missing PIN authorizes only the current visit. */
export function requiresOwnerAuthorizationForManagedAction(_action: ManagedProtectedAction): true {
  return true;
}

export function requiresPinForOwnerEntry(fromRole: "owner" | "standard" | "managed", hasPin: boolean): boolean {
  return fromRole !== "owner" && hasPin;
}

/** Rejects stale protected callbacks both before and after the PIN prompt. */
export async function authorizeForCurrentProfile(
  expectedProfileId: string,
  getCurrentProfileId: () => string,
  isSwitching: () => boolean,
  request: () => Promise<boolean>,
): Promise<boolean> {
  if (isSwitching() || expectedProfileId !== getCurrentProfileId()) return false;
  const authorized = await request();
  return authorized && !isSwitching() && expectedProfileId === getCurrentProfileId();
}

export type OwnerAuthorizationAttempt =
  | { status: "authorized" }
  | { status: "incorrect"; remainingAttempts: number }
  | { status: "cooldown"; retryAt: number };

/** Keeps one visit-level Owner authorization and a non-persistent brute-force cooldown. */
export class OwnerAuthorizationSession {
  private authorizedUntil = 0;
  private failedAttempts = 0;
  private cooldownUntil = 0;

  isAuthorized(now: number = Date.now()): boolean {
    return this.authorizedUntil > now;
  }

  getCooldownUntil(): number {
    return this.cooldownUntil;
  }

  attempt(isCorrect: boolean, now: number = Date.now()): OwnerAuthorizationAttempt {
    if (this.cooldownUntil > now) return { status: "cooldown", retryAt: this.cooldownUntil };
    if (isCorrect) {
      this.authorizedUntil = now + OWNER_AUTHORIZATION_MS;
      this.failedAttempts = 0;
      this.cooldownUntil = 0;
      return { status: "authorized" };
    }
    this.failedAttempts += 1;
    if (this.failedAttempts >= OWNER_PIN_MAX_FAILURES) {
      this.failedAttempts = 0;
      this.cooldownUntil = now + OWNER_PIN_COOLDOWN_MS;
      return { status: "cooldown", retryAt: this.cooldownUntil };
    }
    return { status: "incorrect", remainingAttempts: OWNER_PIN_MAX_FAILURES - this.failedAttempts };
  }

  /** Current verifier must be entered for credential changes, even during an authorized visit. */
  async verifyCurrentPin(pin: string, verify: (candidate: string) => Promise<boolean>, now: number = Date.now()): Promise<boolean> {
    if (this.cooldownUntil > now) return false;
    const matches = await verify(pin);
    return this.attempt(matches, now).status === "authorized";
  }

  authorizeWithoutPin(): void {
    this.authorizedUntil = Date.now() + OWNER_AUTHORIZATION_MS;
  }

  relock(): void {
    this.authorizedUntil = 0;
  }
}
