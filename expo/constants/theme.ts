import { Platform } from "react-native";

export const palette = {
  wall: "#FAF9F6",
  surface: "#F4F3F0",
  surfaceDeep: "#E9E8E5",
  ink: "#1A1C1A",
  inkSoft: "#4A4742",
  inkMuted: "#8A8678",
  accent: "#715B35",
  accentDeep: "#5C4928",
  accentSoft: "#A8916B",
  border: "rgba(208, 197, 183, 0.35)",
  borderSoft: "rgba(208, 197, 183, 0.2)",
  overlay: "rgba(26, 28, 26, 0.55)",
  shadow: "rgba(26, 28, 26, 0.06)",
} as const;

export const fonts = {
  serif: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "Georgia",
  }) as string,
  serifBold: Platform.select({
    ios: "Georgia-Bold",
    android: "serif",
    default: "Georgia",
  }) as string,
  sans: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System",
  }) as string,
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }) as string,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
  xxxl: 96,
} as const;

export const type = {
  display: {
    fontFamily: fonts.serif,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -0.5,
    color: palette.ink,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: palette.ink,
  },
  heading: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 26,
    color: palette.ink,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: palette.ink,
  },
  bodySoft: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: palette.inkSoft,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    color: palette.inkMuted,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    fontWeight: "600" as const,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: palette.ink,
    fontWeight: "500" as const,
  },
} as const;
