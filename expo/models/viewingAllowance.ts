export type ViewingAllowance =
  | { mode: "unlimited" }
  | { mode: "dailyLimit"; minutes: number; commitment?: boolean };

export type ProfilePlaybackLimitRecord = {
  profileId: string;
  dailyLimitMinutes: number | null;
  commitment?: boolean;
  pendingDailyLimitMinutes: number | null;
  pendingActivatesAt: number | null;
  updatedAt: number;
};

export type ProfilePlaybackUsageRecord = {
  profileId: string;
  dayKey: string;
  dayStartedAt: number;
  lastSeenAt: number;
  timezoneOffsetMinutes: number;
  consumedSeconds: number;
  warnedFive: number;
  warnedOne: number;
  updatedAt: number;
};

export type ViewingAllowanceWarning = "fiveMinutes" | "oneMinute";

export type PendingViewingAllowanceChange = {
  allowance: ViewingAllowance;
  activatesAt: number;
};

export type ViewingAllowanceStatus = { commitment?: boolean } & (
  | { kind: "unlimited"; canPlay: true; pendingChange?: PendingViewingAllowanceChange; sessionRemainingSeconds?: number }
  | { kind: "limited"; canPlay: true; remainingSeconds: number; allowanceMinutes: number; pendingChange?: PendingViewingAllowanceChange; warning?: ViewingAllowanceWarning; sessionRemainingSeconds?: number }
  | { kind: "complete"; canPlay: false; remainingSeconds: 0; allowanceMinutes: number; pendingChange?: PendingViewingAllowanceChange }
  | { kind: "ownerReview"; canPlay: false; remainingSeconds: 0; reason: string }
  | { kind: "restricted"; canPlay: false; remainingSeconds: 0; restriction: "paused" | "outsideWindow" | "quietHours" | "sessionBreak"; reason: string; availableAt?: number });
