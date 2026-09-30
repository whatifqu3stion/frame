import { formatClockWindow, isMinuteInsideWindow, validateManagedPlaybackControls } from "./playbackControls";
import type { ManagedPlaybackControls } from "../models/playbackControls";

/** Summarizes configured daily windows, excluding the separate allowance and pause gates. */
export function scheduleSummary(controls: ManagedPlaybackControls): string {
  const error = validateManagedPlaybackControls(controls);
  if (error) return error;
  const { allowedWindow, quietHours } = controls;
  const available = Array.from({ length: 1440 }, (_, minute) => (!allowedWindow || isMinuteInsideWindow(minute, allowedWindow)) && (!quietHours || !isMinuteInsideWindow(minute, quietHours))).some(Boolean);
  if (!available) return "These windows leave no time for playback. Adjust the viewing window or quiet hours.";
  const parts = [allowedWindow ? `Viewing window: ${formatClockWindow(allowedWindow)}.` : "No daily viewing window.", quietHours ? `Quiet hours: ${formatClockWindow(quietHours)}. Quiet hours take priority where the windows overlap.` : "No quiet hours."];
  if (controls.sessionLimitMinutes !== null) parts.push(`A ${controls.sessionBreakMinutes}-minute break follows ${controls.sessionLimitMinutes} minutes of continuous playback.`);
  parts.push("Daily allowances and Pause Frame still apply.");
  return parts.join(" ");
}
