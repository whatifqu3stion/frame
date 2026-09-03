import type {
  DailyAllowanceStatus,
  DailyAllowanceWarning,
  ManagedAllowance,
  ManagedAllowanceRecord,
} from "@/models/dailyAllowance";
import type { Profile } from "@/models/profile";

export const MAX_DAILY_ALLOWANCE_MINUTES = 1_440;
export const MIN_GENUINE_DAY_MS = 20 * 60 * 60 * 1000;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type LocalDay = {
  key: string;
  startedAt: number;
  timezoneOffsetMinutes: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Returns a stable local-calendar identity plus the local midnight anchor. */
export function getLocalDay(now: number): LocalDay {
  const date = new Date(now);
  return {
    key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    startedAt: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
    timezoneOffsetMinutes: date.getTimezoneOffset(),
  };
}

export function validateManagedAllowance(allowance: ManagedAllowance): string | null {
  if (allowance.mode === "unlimited") return null;
  if (!Number.isInteger(allowance.minutes) || allowance.minutes <= 0 || allowance.minutes > MAX_DAILY_ALLOWANCE_MINUTES) {
    return `Daily Frame time must be between 1 and ${MAX_DAILY_ALLOWANCE_MINUTES} minutes.`;
  }
  return null;
}

export function createManagedAllowanceRecord(profileId: string, allowance: ManagedAllowance, now: number): ManagedAllowanceRecord {
  const error = validateManagedAllowance(allowance);
  if (error) throw new Error(error);
  const day = getLocalDay(now);
  return {
    profileId,
    mode: allowance.mode,
    dailyLimitMinutes: allowance.mode === "dailyLimit" ? allowance.minutes : null,
    dayKey: day.key,
    dayStartedAt: day.startedAt,
    lastSeenAt: now,
    timezoneOffsetMinutes: day.timezoneOffsetMinutes,
    consumedSeconds: 0,
    addedSeconds: 0,
    warnedFive: 0,
    warnedOne: 0,
    updatedAt: now,
  };
}

export function parseManagedAllowance(record: ManagedAllowanceRecord): ManagedAllowance | null {
  if (record.mode === "unlimited" && record.dailyLimitMinutes === null) return { mode: "unlimited" };
  if (record.mode === "dailyLimit" && typeof record.dailyLimitMinutes === "number") {
    const allowance: ManagedAllowance = { mode: "dailyLimit", minutes: record.dailyLimitMinutes };
    return validateManagedAllowance(allowance) === null ? allowance : null;
  }
  return null;
}

function hasConsistentStoredDay(record: ManagedAllowanceRecord): boolean {
  if (!Number.isInteger(record.timezoneOffsetMinutes) || Math.abs(record.timezoneOffsetMinutes) > 14 * 60) return false;
  const shifted = new Date(record.dayStartedAt - record.timezoneOffsetMinutes * 60_000);
  const key = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  return key === record.dayKey && shifted.getUTCHours() === 0 && shifted.getUTCMinutes() === 0 && shifted.getUTCSeconds() === 0;
}

function hasValidRollover(record: ManagedAllowanceRecord): boolean {
  return DAY_KEY_PATTERN.test(record.dayKey)
    && Number.isFinite(record.dayStartedAt)
    && Number.isFinite(record.lastSeenAt)
    && hasConsistentStoredDay(record)
    && Number.isInteger(record.consumedSeconds)
    && record.consumedSeconds >= 0
    && Number.isInteger(record.addedSeconds)
    && record.addedSeconds >= 0
    && (record.warnedFive === 0 || record.warnedFive === 1)
    && (record.warnedOne === 0 || record.warnedOne === 1)
    && record.dayStartedAt <= record.lastSeenAt;
}

/** Advances only after a forward, plausibly genuine local calendar day. */
export function reconcileManagedAllowanceRecord(
  record: ManagedAllowanceRecord,
  now: number,
): { ok: true; record: ManagedAllowanceRecord; didRollover: boolean } | { ok: false; reason: string } {
  if (!parseManagedAllowance(record) || !hasValidRollover(record) || !Number.isFinite(now)) {
    return { ok: false, reason: "Daily Frame time needs Owner review before playback can continue." };
  }
  const currentDay = getLocalDay(now);
  const isForwardClock = now >= record.lastSeenAt;
  const hasNewCalendarDay = currentDay.key !== record.dayKey && currentDay.startedAt > record.dayStartedAt;
  const hasPlausibleDayDistance = currentDay.startedAt - record.dayStartedAt >= MIN_GENUINE_DAY_MS;
  if (isForwardClock && hasNewCalendarDay && hasPlausibleDayDistance) {
    return {
      ok: true,
      didRollover: true,
      record: {
        ...record,
        dayKey: currentDay.key,
        dayStartedAt: currentDay.startedAt,
        lastSeenAt: now,
        timezoneOffsetMinutes: currentDay.timezoneOffsetMinutes,
        consumedSeconds: 0,
        addedSeconds: 0,
        warnedFive: 0,
        warnedOne: 0,
        updatedAt: now,
      },
    };
  }
  return {
    ok: true,
    didRollover: false,
    record: { ...record, lastSeenAt: Math.max(record.lastSeenAt, now), updatedAt: now },
  };
}

export function statusForProfile(profile: Profile, record: ManagedAllowanceRecord | null): DailyAllowanceStatus {
  if (profile.role !== "managed") return { kind: "unlimited", canPlay: true };
  if (!record) return { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Daily Frame time needs Owner review before playback can continue." };
  const allowance = parseManagedAllowance(record);
  if (!allowance) return { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Daily Frame time needs Owner review before playback can continue." };
  if (allowance.mode === "unlimited") return { kind: "unlimited", canPlay: true };
  const totalSeconds = allowance.minutes * 60 + record.addedSeconds;
  const remainingSeconds = Math.max(0, totalSeconds - record.consumedSeconds);
  if (remainingSeconds === 0) {
    return { kind: "complete", canPlay: false, remainingSeconds: 0, allowanceMinutes: allowance.minutes, addedSeconds: record.addedSeconds };
  }
  return { kind: "limited", canPlay: true, remainingSeconds, allowanceMinutes: allowance.minutes, addedSeconds: record.addedSeconds };
}

/** Claims at most the nearest warning, including when playback starts below a threshold. */
export function claimAllowanceWarning(
  record: ManagedAllowanceRecord,
  status: DailyAllowanceStatus,
): { record: ManagedAllowanceRecord; warning?: DailyAllowanceWarning } {
  if (status.kind !== "limited") return { record };
  if (status.remainingSeconds <= 60 && record.warnedOne === 0) {
    return { record: { ...record, warnedOne: 1 }, warning: "oneMinute" };
  }
  if (status.remainingSeconds <= 300 && record.warnedFive === 0) {
    return { record: { ...record, warnedFive: 1 }, warning: "fiveMinutes" };
  }
  return { record };
}

export function updateRecurringAllowance(
  record: ManagedAllowanceRecord,
  allowance: ManagedAllowance,
  now: number,
): ManagedAllowanceRecord {
  const error = validateManagedAllowance(allowance);
  if (error) throw new Error(error);
  return {
    ...record,
    mode: allowance.mode,
    dailyLimitMinutes: allowance.mode === "dailyLimit" ? allowance.minutes : null,
    warnedFive: 0,
    warnedOne: 0,
    lastSeenAt: Math.max(record.lastSeenAt, now),
    updatedAt: now,
  };
}
