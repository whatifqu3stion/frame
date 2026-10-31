import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** One static paper texture beneath the screen, never over video, text or controls. */
export default function PaperSurface({ children }: { children?: ReactNode }) {
  const { isDark, palette } = useFrameTheme();
  return <View style={[styles.surface, { backgroundColor: palette.wall }]}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Image source={require("../assets/textures/programme-grain.png")} resizeMode="repeat" fadeDuration={0} accessible={false} style={[StyleSheet.absoluteFill, { width: "100%", height: "100%", opacity: isDark ? 0.14 : 0.28 }]} />
    </View>
    {children}
  </View>;
}
const styles = StyleSheet.create({ surface: { flex: 1, overflow: "hidden" } });
