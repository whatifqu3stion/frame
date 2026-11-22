import type { AccentMode, ThemeMode } from "@/types";

type Appearance = { theme: ThemeMode; accent: AccentMode };
let lastCommitted: Appearance | null = null;

/** Memory only: crash recovery must never depend on the failed provider or a storage read. */
export function rememberRecoveryAppearance(theme: ThemeMode, accent: AccentMode): void {
  lastCommitted = { theme, accent };
}
export function recoveryAppearance(systemDark: boolean): Appearance {
  return lastCommitted ? { ...lastCommitted } : { theme: systemDark ? "ink" : "warm", accent: "blue" };
}
