import { Platform, type TextStyle, type ViewStyle } from "react-native";
import type { AccentMode } from "@/types";

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
  onAccent: string;
  onDanger: string;
  onDark: string;
  onDarkSoft: string;
  mount: string;
  mountEdge: string;
  programme: string;
  onProgramme: string;
  onProgrammeSoft: string;
  programmeRule: string;
  programmeGrainOpacity: number;
  primaryButtonDepth: ViewStyle;
};

type AccentTokens = Pick<FramePalette, "accent" | "accentDeep" | "accentSoft" | "active" | "activeSoft">;
type PaletteBase = Omit<FramePalette, keyof AccentTokens | "primaryButtonDepth" | "onAccent" | "onDanger">;

const lightBase: PaletteBase = {
  wall: "#F3F0EA", surface: "#F8F5EF", surfaceDeep: "#E9E4DB", surfaceHigh: "#FFFDFA", surfaceDim: "#DED7CC", surfaceBright: "#FFFEFB",
  ink: "#2C2825", inkSoft: "#625B54", inkMuted: "#625B52", rose: "#B88E95", clay: "#A9755E", sage: "#60725E", success: "#4A544A", danger: "#943F36",
  mount: "#FFFDFA", mountEdge: "#D8D0C4", programme: "#342B25", programmeGrainOpacity: 0.22, onProgramme: "#FAF4EA", onProgrammeSoft: "#D4C7B6", programmeRule: "#69584A",
  border: "rgba(88, 76, 64, 0.24)", borderSoft: "rgba(88, 76, 64, 0.14)", overlay: "rgba(44, 40, 37, 0.48)", shadow: "rgba(54, 42, 32, 0.09)", onDark: "#FFFDF9", onDarkSoft: "rgba(255, 253, 249, 0.76)",
};

const darkBase: PaletteBase = {
  wall: "#171513", surface: "#201D1A", surfaceDeep: "#27231F", surfaceHigh: "#2D2925", surfaceDim: "#121110", surfaceBright: "#322D28",
  ink: "#F4F0ED", inkSoft: "#C7C0BA", inkMuted: "#B3A99F", rose: "#B6909A", clay: "#B87D61", sage: "#4A544A", success: "#809580", danger: "#D98276",
  mount: "#302B26", mountEdge: "#51483F", programme: "#382F28", programmeGrainOpacity: 0.16, onProgramme: "#FAF4EA", onProgrammeSoft: "#D4C7B6", programmeRule: "#69584A",
  border: "rgba(244, 240, 237, 0.22)", borderSoft: "rgba(244, 240, 237, 0.13)", overlay: "rgba(7, 7, 6, 0.74)", shadow: "rgba(0, 0, 0, 0.30)", onDark: "#F4F0ED", onDarkSoft: "rgba(244, 240, 237, 0.74)",
};

const accentTokens: Record<AccentMode, { light: AccentTokens; dark: AccentTokens }> = {
  blue: {
    light: { accent: "#3B6073", accentDeep: "#36596B", accentSoft: "#BFD2DB", active: "#3B6073", activeSoft: "rgba(74, 113, 134, 0.10)" },
    dark: { accent: "#8FB7CA", accentDeep: "#3F687C", accentSoft: "#C7DEE7", active: "#8FB7CA", activeSoft: "rgba(143, 183, 202, 0.10)" },
  },
  green: {
    light: { accent: "#49624C", accentDeep: "#3F5944", accentSoft: "#C4D2C2", active: "#49624C", activeSoft: "rgba(82, 107, 85, 0.10)" },
    dark: { accent: "#9AB497", accentDeep: "#486345", accentSoft: "#C6D8C4", active: "#9AB497", activeSoft: "rgba(154, 180, 151, 0.10)" },
  },
  rose: {
    light: { accent: "#834B56", accentDeep: "#7B4752", accentSoft: "#E1C4C9", active: "#834B56", activeSoft: "rgba(156, 98, 108, 0.10)" },
    dark: { accent: "#D4A4AC", accentDeep: "#8B5963", accentSoft: "#E6C7CC", active: "#D4A4AC", activeSoft: "rgba(212, 164, 172, 0.10)" },
  },
};

export const accentOptions: readonly { id: AccentMode; label: string }[] = [
  { id: "blue", label: "Mineral blue" }, { id: "green", label: "Mineral green" }, { id: "rose", label: "Muted rose" },
];

export function primaryActionDepth(isDark: boolean, accent: AccentMode): ViewStyle {
  const colors = accentTokens[accent][isDark ? "dark" : "light"];
  const cast = isDark ? `${colors.accentSoft}99` : "rgba(90, 74, 58, 0.36)";
  const offset = isDark ? -2 : 2;
  let primaryButtonDepth: ViewStyle = { boxShadow: `0px ${offset}px 0px 0px ${cast}` };
  // Outset shadows require Android 9. Use a crisp edge on earlier devices.
  if (Platform.OS === "android" && Number(Platform.Version) < 28) {
    primaryButtonDepth = isDark ? { borderTopWidth: 2, borderTopColor: cast } : { borderBottomWidth: 2, borderBottomColor: cast };
  }
  return primaryButtonDepth;
}

export function createPalette(isDark: boolean, accent: AccentMode): FramePalette {
  const colors = accentTokens[accent][isDark ? "dark" : "light"];
  return { ...(isDark ? darkBase : lightBase), ...colors, primaryButtonDepth: primaryActionDepth(isDark, accent), onAccent: isDark ? darkBase.wall : lightBase.onDark, onDanger: isDark ? darkBase.wall : lightBase.onDark };
}

export const lightPalette: FramePalette = createPalette(false, "blue");
export const darkPalette: FramePalette = createPalette(true, "blue");

/** Warm light mode remains the compatibility default for static utility screens. */
export const palette = lightPalette;

export const watchPalette = {
  litWall: "#56483D",
  darkLitWall: darkBase.surfaceHigh,
  wall: "#202021",
  stage: "#202021",
  surface: "#24201C",
  surfaceHigh: "#302922",
  ink: "#F4F0ED",
  inkSoft: "rgba(244, 240, 237, 0.76)",
  inkMuted: "rgba(244, 240, 237, 0.68)",
  accent: "#9AC0D2",
  accentSoft: "#C7DEE7",
  mount: "#302B26", mountEdge: "#51483F", programme: "#382F28", onProgramme: "#FAF4EA", onProgrammeSoft: "#D4C7B6", programmeRule: "#69584A",
  border: "rgba(244, 240, 237, 0.22)",
  glow: "rgba(143, 183, 202, 0.16)",
} as const;

export const fonts = {
  serif: "LibreCaslonText_400Regular",
  serifBold: "LibreCaslonText_700Bold",
  serifItalic: "LibreCaslonText_400Regular_Italic",
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
  media: 0,
  mount: 2,
  source: 6,
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
    title: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 37, letterSpacing: -0.45, color: p.ink },
    heading: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 27, color: p.ink },
    body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: p.ink },
    bodySoft: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: p.inkSoft },
    caption: { fontFamily: fonts.sansSemibold, fontSize: 12, lineHeight: 17, color: p.inkMuted, letterSpacing: 0.2 },
    label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: p.ink },
  };
}

export const type = createType(lightPalette);

