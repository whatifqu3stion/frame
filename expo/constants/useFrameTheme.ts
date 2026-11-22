import { createContext, useContext, useMemo } from "react";
import { createPalette, createType, type FramePalette, type FrameType } from "@/constants/theme";
import type { AccentMode } from "@/types";
import { useApp } from "@/providers/AppProvider";

export const FrameAppearanceContext = createContext<{ theme: string; accent: AccentMode } | null>(null);

export type FrameTheme = {
  isDark: boolean;
  accent: AccentMode;
  palette: FramePalette;
  type: FrameType;
};

/** Returns the persisted Frame appearance and semantic text styles. */
export function useFrameTheme(): FrameTheme {
  const { prefs } = useApp();
  const appearance = useContext(FrameAppearanceContext) ?? prefs;
  const isDark = appearance.theme === "ink";
  const accent = appearance.accent;
  const palette = useMemo<FramePalette>(() => createPalette(isDark, accent), [isDark, accent]);
  const type = useMemo<FrameType>(() => createType(palette), [palette]);
  return { isDark, accent, palette, type };
}
