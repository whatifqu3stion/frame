export type ViewingAllowance =
  | { mode: "unlimited" }
  | { mode: "dailyLimit"; minutes: number };

export type ProfilePlaybackLimitRecord = {
  profileId: string;
  dailyLimitMinutes: number | null;
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

export type ViewingAllowanceStatus =
  | { kind: "unlimited"; canPlay: true; pendingChange?: PendingViewingAllowanceChange }
  | { kind: "limited"; canPlay: true; remainingSeconds: number; allowanceMinutes: number; pendingChange?: PendingViewingAllowanceChange; warning?: ViewingAllowanceWarning }
  | { kind: "complete"; canPlay: false; remainingSeconds: 0; allowanceMinutes: number; pendingChange?: PendingViewingAllowanceChange }
  | { kind: "ownerReview"; canPlay: false; remainingSeconds: 0; reason: string };
