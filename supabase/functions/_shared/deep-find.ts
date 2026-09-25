import { sanitizeSource, type SanitizedSource } from "./source-resolution.ts";

export const DEEP_FIND_MAX_RESULTS = 3;
const identityPattern = /^[0-9a-f]{64}$/;
const channelPattern = /^UC[A-Za-z0-9_-]{22}$/;

export type DeepFindResponse =
  | { state: "ready"; sources: SanitizedSource[]; remaining: number; resetAt: string }
  | { state: "status"; remaining: number; resetAt: string }
  | { state: "invalid_request" | "premium_required" | "disabled" | "allowance_exhausted" | "quota_exhausted" | "unavailable"; message: string; remaining?: number; resetAt?: string };

export type DeepFindReservation = {
  outcome: "reserved" | "disabled" | "allowance_exhausted" | "quota_exhausted";
  remaining: number;
  resetAt: string;
  reservationId: string | null;
};

export type DeepFindDependencies = {
  verifyPremium(identity: string): Promise<boolean>;
  getRemaining(identity: string): Promise<{ remaining: number; resetAt: string; enabled: boolean }>;
  reserve(identity: string): Promise<DeepFindReservation>;
  release(identity: string, reservationId: string): Promise<void>;
  translate(query: string): Promise<string>;
  searchChannels(query: string): Promise<readonly string[]>;
  verifyChannels(ids: readonly string[]): Promise<readonly SanitizedSource[]>;
  cacheSources(sources: readonly SanitizedSource[]): Promise<void>;
};

/** Raw Interactions REST responses place text in the final model_output step. */
export function geminiChannelQuery(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.steps)) throw new Error("invalid translation");
  const output = [...value.steps].reverse().find((step) => isRecord(step) && step.type === "model_output");
  if (!isRecord(output) || !Array.isArray(output.content)) throw new Error("invalid translation");
  const texts = output.content.filter((part) => isRecord(part) && part.type === "text" && typeof part.text === "string");
  if (texts.length !== 1) throw new Error("invalid translation");
  const parsed: unknown = JSON.parse(texts[0].text);
  if (!isRecord(parsed) || typeof parsed.query !== "string") throw new Error("invalid translation");
  return parsed.query.trim();
}

/** Only a current subscription product can authorize a costly server action. */
export function hasServerPremiumEntitlement(value: unknown, now: number, allowSandbox: boolean): boolean {
  const subscriber = isRecord(value) ? value.subscriber : null;
  if (!isRecord(subscriber) || !isRecord(subscriber.entitlements) || !isRecord(subscriber.subscriptions)) return false;
  const entitlement = subscriber.entitlements.premium;
  if (!isRecord(entitlement) || typeof entitlement.product_identifier !== "string" || typeof entitlement.purchase_date !== "string") return false;
  const subscription = subscriber.subscriptions[entitlement.product_identifier];
  if (!isRecord(subscription) || subscription.refunded_at != null || (subscription.is_sandbox !== false && !allowSandbox)) return false;
  const expires = typeof entitlement.expires_date === "string" ? Date.parse(entitlement.expires_date) : NaN;
  const grace = typeof entitlement.grace_period_expires_date === "string" ? Date.parse(entitlement.grace_period_expires_date) : NaN;
  return Number.isFinite(expires) && expires > now || Number.isFinite(grace) && grace > now;
}

export function validateDeepFindRequest(input: unknown): { identity: string; query?: string } | null {
  if (!isRecord(input) || typeof input.installationToken !== "string" || !identityPattern.test(input.installationToken)) return null;
  if (input.action === "status" && Object.keys(input).length === 2) return { identity: input.installationToken };
  if (Object.keys(input).length !== 2 || typeof input.query !== "string" || input.query !== input.query.trim()) return null;
  if (input.query.length < 8 || input.query.length > 160 || hasControlCharacters(input.query)) return null;
  return { identity: input.installationToken, query: input.query };
}

/** Costly operations start only after a fresh RevenueCat check and atomic reservation. */
export async function executeDeepFind(input: unknown, deps: DeepFindDependencies): Promise<DeepFindResponse> {
  const request = validateDeepFindRequest(input);
  if (!request) return failure("invalid_request", "Enter a specific source request (8–160 characters).");

  try {
    if (!await deps.verifyPremium(request.identity)) return failure("premium_required", "Deep Find requires an active Premium subscription.");
  } catch {
    return failure("unavailable", "Premium could not be verified. Try again later.");
  }

  if (!request.query) {
    try {
      const { enabled, remaining, resetAt } = await deps.getRemaining(request.identity);
      return enabled ? { state: "status", remaining, resetAt } : failure("disabled", "Deep Find is paused.");
    } catch { return failure("unavailable", "Deep Find is unavailable."); }
  }

  let reservation: DeepFindReservation;
  try { reservation = await deps.reserve(request.identity); }
  catch { return failure("unavailable", "Deep Find is unavailable."); }
  if (reservation.outcome !== "reserved" || !reservation.reservationId) {
    const state = reservation.outcome === "reserved" ? "unavailable" : reservation.outcome;
    return { state, message: state === "allowance_exhausted" ? "Your monthly Deep Finds are used. Try again after the reset." : "Deep Find is temporarily unavailable.", remaining: reservation.remaining, resetAt: reservation.resetAt };
  }

  let translated: string;
  try {
    translated = await deps.translate(request.query);
    if (!translated || translated.length > 100 || hasControlCharacters(translated)) throw new Error("invalid translation");
  } catch {
    try {
      await deps.release(request.identity, reservation.reservationId);
      return failure("unavailable", "Deep Find could not prepare that request. No monthly search was used.");
    } catch {
      return failure("unavailable", "Deep Find could not prepare that request. Check your allowance before retrying.");
    }
  }

  // Once a provider request begins, the monthly allowance stays consumed even
  // if the network response is lost; global search budget is never refunded.
  try {
    const ids = [...new Set(await deps.searchChannels(translated))].filter((id) => channelPattern.test(id)).slice(0, DEEP_FIND_MAX_RESULTS);
    if (ids.length === 0) return { state: "ready", sources: [], remaining: reservation.remaining, resetAt: reservation.resetAt };
    const verified = await deps.verifyChannels(ids);
    const byId = new Map(verified.filter((source) => ids.includes(source.providerSourceId)).map((source) => [source.providerSourceId, sanitizeSource(source)]));
    const sources = ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []).slice(0, DEEP_FIND_MAX_RESULTS);
    if (sources.length) await deps.cacheSources(sources);
    return { state: "ready", sources, remaining: reservation.remaining, resetAt: reservation.resetAt };
  } catch {
    return failure("unavailable", "The provider could not complete Deep Find. That request may count toward your monthly allowance.");
  }
}

function failure(state: Exclude<DeepFindResponse["state"], "ready" | "status">, message: string): DeepFindResponse {
  return { state, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
