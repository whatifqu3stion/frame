import type { Profile } from "@/models/profile";
import type {
  ClockWindow,
  ManagedPlaybackControls,
  PlaybackControlStatus,
  ProfilePlaybackControlsRecord,
  ProfileSessionUsageRecord,
} from "@/models/playbackControls";

export const DEFAULT_SESSION_BREAK_MINUTES = 15;
export const MAX_SESSION_LIMIT_MINUTES = 240;
export const MAX_SESSION_BREAK_MINUTES = 180;
export const INDEFINITE_PAUSE = -1;

export const DEFAULT_MANAGED_PLAYBACK_CONTROLS: ManagedPlaybackControls = {
  allowedWindow: null,
  quietHours: null,
  sessionLimitMinutes: null,
  sessionBreakMinutes: DEFAULT_SESSION_BREAK_MINUTES,
  pausedUntil: null,
};

export function validateClockWindow(window: ClockWindow | null, label: string): string | null {
  if (!window) return null;
  if (!isMinute(window.startMinute) || !isMinute(window.endMinute) || window.startMinute === window.endMinute) {
    return `${label} needs two different valid times.`;
  }
  return null;
}

export function validateManagedPlaybackControls(controls: ManagedPlaybackControls): string | null {
  const allowedError = validateClockWindow(controls.allowedWindow, "Viewing window");
  if (allowedError) return allowedError;
  const quietError = validateClockWindow(controls.quietHours, "Quiet hours");
  if (quietError) return quietError;
  if (controls.sessionLimitMinutes !== null
    && (!Number.isInteger(controls.sessionLimitMinutes) || controls.sessionLimitMinutes < 1 || controls.sessionLimitMinutes > MAX_SESSION_LIMIT_MINUTES)) {
    return `Session limit must be between 1 and ${MAX_SESSION_LIMIT_MINUTES} minutes.`;
  }
  if (!Number.isInteger(controls.sessionBreakMinutes) || controls.sessionBreakMinutes < 1 || controls.sessionBreakMinutes > MAX_SESSION_BREAK_MINUTES) {
    return `Session break must be between 1 and ${MAX_SESSION_BREAK_MINUTES} minutes.`;
  }
  if (controls.pausedUntil !== null && controls.pausedUntil !== INDEFINITE_PAUSE
    && (!Number.isSafeInteger(controls.pausedUntil) || controls.pausedUntil <= 0)) {
    return "Pause time is invalid.";
  }
  return null;
}

export function createPlaybackControlsRecord(profileId: string, controls: ManagedPlaybackControls, now: number): ProfilePlaybackControlsRecord {
  const error = validateManagedPlaybackControls(controls);
  if (error) throw new Error(error);
  return {
    profileId,
    allowedStartMinute: controls.allowedWindow?.startMinute ?? null,
    allowedEndMinute: controls.allowedWindow?.endMinute ?? null,
    quietStartMinute: controls.quietHours?.startMinute ?? null,
    quietEndMinute: controls.quietHours?.endMinute ?? null,
    sessionLimitMinutes: controls.sessionLimitMinutes,
    sessionBreakMinutes: controls.sessionBreakMinutes,
    pausedUntil: controls.pausedUntil,
    updatedAt: now,
  };
}

export function controlsFromRecord(record: ProfilePlaybackControlsRecord | null): ManagedPlaybackControls {
  if (!record) return { ...DEFAULT_MANAGED_PLAYBACK_CONTROLS };
  const controls: ManagedPlaybackControls = {
    allowedWindow: pair(record.allowedStartMinute, record.allowedEndMinute),
    quietHours: pair(record.quietStartMinute, record.quietEndMinute),
    sessionLimitMinutes: record.sessionLimitMinutes,
    sessionBreakMinutes: record.sessionBreakMinutes,
    pausedUntil: record.pausedUntil,
  };
  const error = validateManagedPlaybackControls(controls);
  if (error) throw new Error(error);
  return controls;
}

export function createSessionUsageRecord(profileId: string, now: number): ProfileSessionUsageRecord {
  return { profileId, lastPlaybackAt: null, consumedSeconds: 0, lockedUntil: null, updatedAt: now };
}

export function isMinuteInsideWindow(minute: number, window: ClockWindow): boolean {
  if (window.startMinute < window.endMinute) return minute >= window.startMinute && minute < window.endMinute;
  return minute >= window.startMinute || minute < window.endMinute;
}

export function localMinute(now: number): number {
  const date = new Date(now);
  return date.getHours() * 60 + date.getMinutes();
}

export function evaluatePlaybackControls(
  profile: Profile,
  controls: ManagedPlaybackControls,
  usage: ProfileSessionUsageRecord,
  now: number,
): PlaybackControlStatus {
  if (profile.role !== "managed") return { kind: "available", canPlay: true };
  const error = validateManagedPlaybackControls(controls);
  if (error || !validUsage(usage)) {
    return { kind: "ownerReview", canPlay: false, reason: "Managed playback controls need Owner review before playback can continue." };
  }
  if (controls.pausedUntil === INDEFINITE_PAUSE || (controls.pausedUntil !== null && controls.pausedUntil > now)) {
    return {
      kind: "paused",
      canPlay: false,
      reason: controls.pausedUntil === INDEFINITE_PAUSE ? "Frame is paused for this profile." : `Frame is paused until ${new Date(controls.pausedUntil).toLocaleString()}.`,
      ...(controls.pausedUntil === INDEFINITE_PAUSE ? {} : { availableAt: controls.pausedUntil }),
    };
  }
  const minute = localMinute(now);
  if (controls.allowedWindow && !isMinuteInsideWindow(minute, controls.allowedWindow)) {
    return { kind: "outsideWindow", canPlay: false, reason: `Playback is available during the Owner-set viewing window (${formatClockWindow(controls.allowedWindow)}).` };
  }
  if (controls.quietHours && isMinuteInsideWindow(minute, controls.quietHours)) {
    return { kind: "quietHours", canPlay: false, reason: `Quiet hours are active (${formatClockWindow(controls.quietHours)}).` };
  }
  if (usage.lockedUntil !== null && usage.lockedUntil > now) {
    return { kind: "sessionBreak", canPlay: false, reason: `This session is complete. Playback returns ${new Date(usage.lockedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`, availableAt: usage.lockedUntil };
  }
  if (controls.sessionLimitMinutes === null) return { kind: "available", canPlay: true };
  const remaining = Math.max(0, controls.sessionLimitMinutes * 60 - usage.consumedSeconds);
  if (remaining === 0) {
    return { kind: "sessionBreak", canPlay: false, reason: `This session is complete. Take a ${controls.sessionBreakMinutes}-minute break.` };
  }
  return { kind: "available", canPlay: true, sessionRemainingSeconds: remaining };
}

export function reconcileSessionUsage(
  usage: ProfileSessionUsageRecord,
  controls: ManagedPlaybackControls,
  now: number,
): { record: ProfileSessionUsageRecord; didReset: boolean } {
  if (!validUsage(usage) || !Number.isFinite(now)) throw new Error("Managed playback controls need Owner review.");
  const breakMs = controls.sessionBreakMinutes * 60_000;
  const completedBreak = usage.lockedUntil !== null && now >= usage.lockedUntil;
  const idleBreak = usage.lastPlaybackAt !== null && now - usage.lastPlaybackAt >= breakMs;
  if (completedBreak || idleBreak) return { record: createSessionUsageRecord(usage.profileId, now), didReset: true };
  return { record: usage, didReset: false };
}

export function formatMinute(minute: number): string {
  const hour = Math.floor(minute / 60);
  const minutePart = minute % 60;
  const date = new Date(2020, 0, 1, hour, minutePart);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatClockWindow(window: ClockWindow): string {
  return `${formatMinute(window.startMinute)}–${formatMinute(window.endMinute)}`;
}

function pair(start: number | null, end: number | null): ClockWindow | null {
  if (start === null && end === null) return null;
  if (start === null || end === null) throw new Error("Stored playback window is incomplete.");
  return { startMinute: start, endMinute: end };
}

function isMinute(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 1_439;
}

function validUsage(usage: ProfileSessionUsageRecord): boolean {
  return Number.isInteger(usage.consumedSeconds) && usage.consumedSeconds >= 0
    && (usage.lastPlaybackAt === null || Number.isFinite(usage.lastPlaybackAt))
    && (usage.lockedUntil === null || Number.isFinite(usage.lockedUntil));
}
