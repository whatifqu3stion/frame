import { Platform, type TextStyle, type ViewStyle } from "react-native";

export type FramePalette = {
  wall: string;
  surface: string;
  surfaceDeep: string;
  surfaceHigh: string;
  surfaceDim: string;
  surfaceBright: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  accent: string;
  accentDeep: string;
  accentSoft: string;
  active: string;
  activeSoft: string;
  rose: string;
  clay: string;
  sage: string;
  success: string;
  danger: string;
  border: string;
  borderSoft: string;
  overlay: string;
  shadow: string;
  onDark: string;
  onDarkSoft: string;
};

export const lightPalette: FramePalette = {
  wall: "#FCF9F8",
  surface: "#F6F3F2",
  surfaceDeep: "#EBE8E7",
  surfaceHigh: "#F9F6F5",
  surfaceDim: "#DCD9D9",
  surfaceBright: "#FEFCFB",
  ink: "#2C2825",
  inkSoft: "#736C66",
  inkMuted: "#8D8681",
  accent: "#736C66",
  accentDeep: "#2C2825",
  accentSoft: "#DCD9D9",
  active: "#5E7F91",
  activeSoft: "rgba(94, 127, 145, 0.16)",
  rose: "#BAA1A0",
  clay: "#A9755E",
  sage: "#4A544A",
  success: "#4A544A",
  danger: "#943F36",
  border: "rgba(115, 108, 102, 0.18)",
  borderSoft: "rgba(115, 108, 102, 0.10)",
  overlay: "rgba(44, 40, 37, 0.54)",
  shadow: "rgba(44, 40, 37, 0.10)",
  onDark: "#F4F0ED",
  onDarkSoft: "rgba(244, 240, 237, 0.74)",
};

export const darkPalette: FramePalette = {
  wall: "#141312",
  surface: "#1C1B1A",
  surfaceDeep: "#201F1E",
  surfaceHigh: "#282625",
  surfaceDim: "#10100F",
  surfaceBright: "#252422",
  ink: "#F4F0ED",
  inkSoft: "#A88E7D",
  inkMuted: "#847A73",
  accent: "#A88E7D",
  accentDeep: "#695247",
  accentSoft: "#C9B2A4",
  active: "#78A1B6",
  activeSoft: "rgba(120, 161, 182, 0.18)",
  rose: "#B69090",
  clay: "#B87D61",
  sage: "#4A544A",
  success: "#809580",
  danger: "#D98276",
  border: "rgba(244, 240, 237, 0.14)",
  borderSoft: "rgba(244, 240, 237, 0.08)",
  overlay: "rgba(7, 7, 6, 0.74)",
  shadow: "rgba(0, 0, 0, 0.30)",
  onDark: "#F4F0ED",
  onDarkSoft: "rgba(244, 240, 237, 0.74)",
};

/** Warm light mode remains the compatibility default for static utility screens. */
export const palette = lightPalette;

export const watchPalette = {
  wall: "#141312",
  stage: "#0D0C0C",
  surface: "#1C1B1A",
  surfaceHigh: "#201F1E",
  ink: "#F4F0ED",
  inkSoft: "rgba(244, 240, 237, 0.76)",
  inkMuted: "rgba(244, 240, 237, 0.55)",
  accent: "#A88E7D",
  accentSoft: "#C9B2A4",
  border: "rgba(244, 240, 237, 0.14)",
  glow: "rgba(168, 142, 125, 0.16)",
} as const;

export const fonts = {
  serif: "LibreCaslonText_400Regular",
  serifBold: "LibreCaslonText_700Bold",
  sans: "HankenGrotesk_400Regular",
  sansMedium: "HankenGrotesk_500Medium",
  sansSemibold: "HankenGrotesk_600SemiBold",
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  page: 20,
  lg: 24,
  xl: 40,
  xxl: 64,
  xxxl: 96,
} as const;

export const radii = {
  small: 8,
  control: 10,
  card: 16,
  large: 22,
  pill: 999,
} as const;

export const motion = {
  quick: 140,
  standard: 240,
  slow: 380,
} as const;

export const softShadow: ViewStyle = {
  shadowColor: "#3C291E",
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 2,
};

export type FrameType = {
  display: TextStyle;
  title: TextStyle;
  heading: TextStyle;
  body: TextStyle;
  bodySoft: TextStyle;
  caption: TextStyle;
  label: TextStyle;
};

export function createType(p: FramePalette): FrameType {
  return {
    display: { fontFamily: fonts.serif, fontSize: 42, lineHeight: 49, letterSpacing: -0.7, color: p.ink },
    title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 35, letterSpacing: -0.35, color: p.ink },
    heading: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 27, color: p.ink },
    body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: p.ink },
    bodySoft: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: p.inkSoft },
    caption: { fontFamily: fonts.sansSemibold, fontSize: 11, lineHeight: 15, color: p.inkMuted, letterSpacing: 1.25, textTransform: "uppercase" },
    label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: p.ink },
  };
}

export const type = createType(lightPalette);
