export const OWNER_PIN_MAX_FAILURES = 5;
export const OWNER_PIN_COOLDOWN_MS = 30_000;

export type ManagedProtectedAction = "createManaged" | "deleteManaged" | "changeAllowance" | "disableAllowance" | "addTimeToday";

/** Managed settings always pass through the Owner gate; a missing PIN authorizes only the current visit. */
export function requiresOwnerAuthorizationForManagedAction(_action: ManagedProtectedAction): true {
  return true;
}

export function requiresPinForOwnerEntry(fromRole: "owner" | "standard" | "managed", hasPin: boolean): boolean {
  return fromRole === "managed" && hasPin;
}

export type OwnerAuthorizationAttempt =
  | { status: "authorized" }
  | { status: "incorrect"; remainingAttempts: number }
  | { status: "cooldown"; retryAt: number };

/** Keeps one visit-level Owner authorization and a non-persistent brute-force cooldown. */
export class OwnerAuthorizationSession {
  private authorized = false;
  private failedAttempts = 0;
  private cooldownUntil = 0;

  isAuthorized(): boolean {
    return this.authorized;
  }

  getCooldownUntil(): number {
    return this.cooldownUntil;
  }

  attempt(isCorrect: boolean, now: number = Date.now()): OwnerAuthorizationAttempt {
    if (this.cooldownUntil > now) return { status: "cooldown", retryAt: this.cooldownUntil };
    if (isCorrect) {
      this.authorized = true;
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

  authorizeWithoutPin(): void {
    this.authorized = true;
  }

  relock(): void {
    this.authorized = false;
  }
}
