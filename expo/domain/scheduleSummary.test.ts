import { describe, expect, test } from "bun:test";
import { DEFAULT_MANAGED_PLAYBACK_CONTROLS as defaults, INDEFINITE_PAUSE } from "./playbackControls";
import { scheduleSummary } from "./scheduleSummary";

describe("Schedule explanation", () => {
  test("detects a daytime viewing window entirely covered by quiet hours", () => {
    expect(scheduleSummary({ ...defaults, allowedWindow: { startMinute: 600, endMinute: 720 }, quietHours: { startMinute: 540, endMinute: 780 } })).toContain("leave no time");
  });
  test("detects fully blocked overnight windows", () => {
    expect(scheduleSummary({ ...defaults, allowedWindow: { startMinute: 1320, endMinute: 360 }, quietHours: { startMinute: 1260, endMinute: 420 } })).toContain("leave no time");
  });
  test("retains a one-minute opening and treats touching boundaries correctly", () => {
    expect(scheduleSummary({ ...defaults, allowedWindow: { startMinute: 600, endMinute: 660 }, quietHours: { startMinute: 601, endMinute: 660 } })).not.toContain("leave no time");
    expect(scheduleSummary({ ...defaults, allowedWindow: { startMinute: 600, endMinute: 660 }, quietHours: { startMinute: 660, endMinute: 720 } })).not.toContain("leave no time");
  });
  test("explains partial overlap and retains separate pause and allowance gates", () => {
    const summary = scheduleSummary({ ...defaults, allowedWindow: { startMinute: 420, endMinute: 1200 }, quietHours: { startMinute: 1140, endMinute: 480 }, sessionLimitMinutes: 30, sessionBreakMinutes: 10, pausedUntil: INDEFINITE_PAUSE });
    expect(summary).toContain("Quiet hours take priority");
    expect(summary).toContain("10-minute break follows 30 minutes");
    expect(summary).toContain("Daily allowances and Pause Frame still apply");
  });
  test("shows validation instead of summarizing invalid windows", () => {
    expect(scheduleSummary({ ...defaults, allowedWindow: { startMinute: 600, endMinute: 600 } })).toContain("different");
  });
});
