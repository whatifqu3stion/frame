import { darkPalette, lightPalette } from "@/constants/theme";

export default {
  light: {
    text: lightPalette.ink,
    background: lightPalette.wall,
    tint: lightPalette.active,
    tabIconDefault: lightPalette.inkMuted,
    tabIconSelected: lightPalette.active,
  },
  dark: {
    text: darkPalette.ink,
    background: darkPalette.wall,
    tint: darkPalette.active,
    tabIconDefault: darkPalette.inkMuted,
    tabIconSelected: darkPalette.active,
  },
};
