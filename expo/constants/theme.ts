import { Platform, type TextStyle, type ViewStyle } from "react-native";

export type FramePalette = {
  wall: string;
  surface: string;
  surfaceDeep: string;
  surfaceHigh: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  accent: string;
  accentDeep: string;
  accentSoft: string;
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
  wall: "#F7F3EB",
  surface: "#EFE9DE",
  surfaceDeep: "#E4DDD1",
  surfaceHigh: "#FBF8F2",
  ink: "#29241F",
  inkSoft: "#514A43",
  inkMuted: "#81786E",
  accent: "#8A604B",
  accentDeep: "#654333",
  accentSoft: "#C89D82",
  rose: "#C7A2A1",
  clay: "#B87658",
  sage: "#84917C",
  success: "#66775F",
  danger: "#9B493C",
  border: "rgba(84, 67, 54, 0.16)",
  borderSoft: "rgba(84, 67, 54, 0.09)",
  overlay: "rgba(37, 29, 24, 0.54)",
  shadow: "rgba(54, 39, 29, 0.12)",
  onDark: "#F7F1E7",
  onDarkSoft: "rgba(247, 241, 231, 0.72)",
};

export const darkPalette: FramePalette = {
  wall: "#141210",
  surface: "#201D1A",
  surfaceDeep: "#2B2723",
  surfaceHigh: "#34302C",
  ink: "#E9E2D8",
  inkSoft: "#C1B8AE",
  inkMuted: "#928981",
  accent: "#D09A7A",
  accentDeep: "#744A38",
  accentSoft: "#B98870",
  rose: "#B88F90",
  clay: "#C78061",
  sage: "#95A08D",
  success: "#98A98F",
  danger: "#DA8174",
  border: "rgba(234, 224, 214, 0.15)",
  borderSoft: "rgba(234, 224, 214, 0.08)",
  overlay: "rgba(8, 7, 6, 0.72)",
  shadow: "rgba(0, 0, 0, 0.28)",
  onDark: "#F7F1E7",
  onDarkSoft: "rgba(247, 241, 231, 0.72)",
};

/** Warm light mode remains the compatibility default for static utility screens. */
export const palette = lightPalette;

export const watchPalette = {
  wall: "#100E0D",
  stage: "#080706",
  surface: "#1C1917",
  surfaceHigh: "#28231F",
  ink: "#F2ECE3",
  inkSoft: "rgba(242, 236, 227, 0.76)",
  inkMuted: "rgba(242, 236, 227, 0.55)",
  accent: "#D0A082",
  accentSoft: "#C9AB91",
  border: "rgba(242, 236, 227, 0.14)",
  glow: "rgba(184, 118, 88, 0.16)",
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
