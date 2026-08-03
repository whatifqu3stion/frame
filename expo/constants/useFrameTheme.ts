import { useMemo } from "react";
import { createType, darkPalette, lightPalette, type FramePalette, type FrameType } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";

export type FrameTheme = {
  isDark: boolean;
  palette: FramePalette;
  type: FrameType;
};

/** Returns the persisted Frame appearance and semantic text styles. */
export function useFrameTheme(): FrameTheme {
  const { prefs } = useApp();
  const isDark = prefs.theme === "ink";
  const palette = isDark ? darkPalette : lightPalette;
  const type = useMemo<FrameType>(() => createType(palette), [palette]);
  return { isDark, palette, type };
}
