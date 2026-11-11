import { useReducedTransparency } from "@/hooks/useReducedTransparency";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** Neutral frosted glass keeps labels and icons crisp. */
export default function TabBarGlass() {
  const { isDark, palette } = useFrameTheme();
  const reduceTransparency = useReducedTransparency();
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.clip]}>
    {reduceTransparency ? <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.surfaceHigh }]} /> : <>
      <BlurView intensity={56} tint={isDark ? "dark" : "light"} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(29, 27, 26, 0.50)" : "rgba(251, 248, 242, 0.47)" }]} />
    </>}
    <View style={[styles.rim, { backgroundColor: palette.borderSoft }]} />
  </View>;
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  rim: { position: "absolute", top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
