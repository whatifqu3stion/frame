export type ClockWindow = {
  startMinute: number;
  endMinute: number;
};

export type ManagedPlaybackControls = {
  allowedWindow: ClockWindow | null;
  quietHours: ClockWindow | null;
  sessionLimitMinutes: number | null;
  sessionBreakMinutes: number;
  pausedUntil: number | null;
};

export type ProfilePlaybackControlsRecord = {
  profileId: string;
  allowedStartMinute: number | null;
  allowedEndMinute: number | null;
  quietStartMinute: number | null;
  quietEndMinute: number | null;
  sessionLimitMinutes: number | null;
  sessionBreakMinutes: number;
  pausedUntil: number | null;
  updatedAt: number;
};

export type ProfileSessionUsageRecord = {
  profileId: string;
  lastPlaybackAt: number | null;
  consumedSeconds: number;
  lockedUntil: number | null;
  updatedAt: number;
};

export type PlaybackControlStatus =
  | { kind: "available"; canPlay: true; sessionRemainingSeconds?: number }
  | { kind: "paused" | "outsideWindow" | "quietHours" | "sessionBreak" | "ownerReview"; canPlay: false; reason: string; availableAt?: number };
