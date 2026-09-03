export type ManagedAllowance =
  | { mode: "unlimited" }
  | { mode: "dailyLimit"; minutes: number };

export type ManagedAllowanceRecord = {
  profileId: string;
  mode: string;
  dailyLimitMinutes: number | null;
  dayKey: string;
  dayStartedAt: number;
  lastSeenAt: number;
  timezoneOffsetMinutes: number;
  consumedSeconds: number;
  addedSeconds: number;
  warnedFive: number;
  warnedOne: number;
  updatedAt: number;
};

export type DailyAllowanceWarning = "fiveMinutes" | "oneMinute";

export type DailyAllowanceStatus =
  | { kind: "unlimited"; canPlay: true }
  | { kind: "limited"; canPlay: true; remainingSeconds: number; allowanceMinutes: number; addedSeconds: number; warning?: DailyAllowanceWarning }
  | { kind: "complete"; canPlay: false; remainingSeconds: 0; allowanceMinutes: number; addedSeconds: number }
  | { kind: "ownerReview"; canPlay: false; remainingSeconds: 0; reason: string };
