import type {
  PendingViewingAllowanceChange,
  ProfilePlaybackLimitRecord,
  ProfilePlaybackUsageRecord,
  ViewingAllowance,
  ViewingAllowanceStatus,
  ViewingAllowanceWarning,
} from "@/models/viewingAllowance";
import type { Profile } from "@/models/profile";

export const MAX_DAILY_ALLOWANCE_MINUTES = 1_440;
export const OWNER_RELAXATION_DELAY_MS = 24 * 60 * 60 * 1_000;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type LocalDay = { key: string; startedAt: number; timezoneOffsetMinutes: number };

function pad(value: number): string { return String(value).padStart(2, "0"); }

/** Returns the device's current local-calendar identity and midnight anchor. */
export function getLocalDay(now: number): LocalDay {
  const date = new Date(now);
  return {
    key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    startedAt: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
    timezoneOffsetMinutes: date.getTimezoneOffset(),
  };
}

export function validateViewingAllowance(allowance: ViewingAllowance): string | null {
  if (allowance.mode === "unlimited") return null;
  if (!Number.isInteger(allowance.minutes) || allowance.minutes < 1 || allowance.minutes > MAX_DAILY_ALLOWANCE_MINUTES) {
    return `Daily viewing allowance must be a whole number from 1 to ${MAX_DAILY_ALLOWANCE_MINUTES} minutes.`;
  }
  return null;
}

export function allowanceFromMinutes(minutes: number | null): ViewingAllowance {
  return minutes === null ? { mode: "unlimited" } : { mode: "dailyLimit", minutes };
}

export function minutesFromAllowance(allowance: ViewingAllowance): number | null {
  const error = validateViewingAllowance(allowance);
  if (error) throw new Error(error);
  return allowance.mode === "unlimited" ? null : allowance.minutes;
}

export function createUsageRecord(profileId: string, now: number): ProfilePlaybackUsageRecord {
  const day = getLocalDay(now);
  return { profileId, dayKey: day.key, dayStartedAt: day.startedAt, lastSeenAt: now, timezoneOffsetMinutes: day.timezoneOffsetMinutes, consumedSeconds: 0, warnedFive: 0, warnedOne: 0, updatedAt: now };
}

function isValidUsage(record: ProfilePlaybackUsageRecord): boolean {
  return DAY_KEY_PATTERN.test(record.dayKey)
    && Number.isFinite(record.dayStartedAt)
    && Number.isFinite(record.lastSeenAt)
    && Number.isInteger(record.timezoneOffsetMinutes)
    && Number.isInteger(record.consumedSeconds)
    && record.consumedSeconds >= 0
    && (record.warnedFive === 0 || record.warnedFive === 1)
    && (record.warnedOne === 0 || record.warnedOne === 1);
}

/** Resets only when the observed local date advances; backward dates never reduce usage. */
export function reconcileUsage(record: ProfilePlaybackUsageRecord, now: number): { record: ProfilePlaybackUsageRecord; didRollover: boolean } {
  if (!isValidUsage(record) || !Number.isFinite(now)) throw new Error("Viewing allowance data needs Owner review before playback can continue.");
  const currentDay = getLocalDay(now);
  if (currentDay.key > record.dayKey) {
    return { record: { ...createUsageRecord(record.profileId, now) }, didRollover: true };
  }
  return { record: { ...record, lastSeenAt: Math.max(record.lastSeenAt, now), updatedAt: now }, didRollover: false };
}

function pendingFromLimit(limit: ProfilePlaybackLimitRecord): PendingViewingAllowanceChange | undefined {
  if (limit.pendingActivatesAt === null) return undefined;
  return { allowance: allowanceFromMinutes(limit.pendingDailyLimitMinutes), activatesAt: limit.pendingActivatesAt };
}

export function applyDuePendingLimit(limit: ProfilePlaybackLimitRecord, now: number): { record: ProfilePlaybackLimitRecord; didActivate: boolean } {
  if (limit.pendingActivatesAt === null || now < limit.pendingActivatesAt) return { record: limit, didActivate: false };
  return { record: { ...limit, dailyLimitMinutes: limit.pendingDailyLimitMinutes, pendingDailyLimitMinutes: null, pendingActivatesAt: null, updatedAt: now }, didActivate: true };
}

export function statusFromRecords(limit: ProfilePlaybackLimitRecord | null, usage: ProfilePlaybackUsageRecord | null): ViewingAllowanceStatus {
  if (!limit || limit.dailyLimitMinutes === null) return { kind: "unlimited", canPlay: true, ...(limit ? { pendingChange: pendingFromLimit(limit) } : {}) };
  if (!Number.isInteger(limit.dailyLimitMinutes) || limit.dailyLimitMinutes < 1 || limit.dailyLimitMinutes > MAX_DAILY_ALLOWANCE_MINUTES || !usage) {
    return { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Viewing allowance data needs Owner review before playback can continue." };
  }
  const remainingSeconds = Math.max(0, limit.dailyLimitMinutes * 60 - usage.consumedSeconds);
  const pendingChange = pendingFromLimit(limit);
  if (remainingSeconds === 0) return { kind: "complete", canPlay: false, remainingSeconds: 0, allowanceMinutes: limit.dailyLimitMinutes, ...(pendingChange ? { pendingChange } : {}) };
  return { kind: "limited", canPlay: true, remainingSeconds, allowanceMinutes: limit.dailyLimitMinutes, ...(pendingChange ? { pendingChange } : {}) };
}

export function claimWarning(usage: ProfilePlaybackUsageRecord, status: ViewingAllowanceStatus): { usage: ProfilePlaybackUsageRecord; warning?: ViewingAllowanceWarning } {
  if (status.kind !== "limited") return { usage };
  if (status.remainingSeconds <= 60 && usage.warnedOne === 0) return { usage: { ...usage, warnedOne: 1 }, warning: "oneMinute" };
  if (status.remainingSeconds <= 300 && usage.warnedFive === 0) return { usage: { ...usage, warnedFive: 1 }, warning: "fiveMinutes" };
  return { usage };
}

export function isOwnerRelaxation(currentMinutes: number | null, requestedMinutes: number | null): boolean {
  return currentMinutes !== null && (requestedMinutes === null || requestedMinutes > currentMinutes);
}

/** Applies Standard changes immediately and delays only relaxation of an Owner's active limit. */
export function requestLimitChange(profile: Profile, current: ProfilePlaybackLimitRecord | null, allowance: ViewingAllowance, now: number): ProfilePlaybackLimitRecord {
  const requestedMinutes = minutesFromAllowance(allowance);
  const currentMinutes = current?.dailyLimitMinutes ?? null;
  if (profile.role === "owner" && isOwnerRelaxation(currentMinutes, requestedMinutes)) {
    return { profileId: profile.id, dailyLimitMinutes: currentMinutes, pendingDailyLimitMinutes: requestedMinutes, pendingActivatesAt: now + OWNER_RELAXATION_DELAY_MS, updatedAt: now };
  }
  return { profileId: profile.id, dailyLimitMinutes: requestedMinutes, pendingDailyLimitMinutes: null, pendingActivatesAt: null, updatedAt: now };
}
