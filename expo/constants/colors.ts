import { darkPalette, lightPalette } from "@/constants/theme";

export default {
  light: {
    text: lightPalette.ink,
    background: lightPalette.wall,
    tint: lightPalette.accent,
    tabIconDefault: lightPalette.inkMuted,
    tabIconSelected: lightPalette.accent,
  },
  dark: {
    text: darkPalette.ink,
    background: darkPalette.wall,
    tint: darkPalette.accent,
    tabIconDefault: darkPalette.inkMuted,
    tabIconSelected: darkPalette.accent,
  },
};
