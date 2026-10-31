import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** Neutral frosted glass keeps labels and icons crisp. */
export default function TabBarGlass() {
  const { isDark, palette } = useFrameTheme();
  const [reduceTransparency, setReduceTransparency] = useState(Platform.OS === "ios");
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let mounted = true;
    let observed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", (value) => {
      observed = true;
      setReduceTransparency(value);
    });
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (mounted && !observed) setReduceTransparency(value);
    }).catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);

  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.clip]}>
    {reduceTransparency ? <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.surfaceHigh }]} /> : <>
      <BlurView intensity={70} tint={isDark ? "dark" : "light"} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(35, 30, 27, 0.50)" : "rgba(255, 251, 245, 0.42)" }]} />
      <LinearGradient colors={isDark ? ["rgba(255, 245, 229, 0.10)", "rgba(35, 30, 27, 0)", "rgba(35, 30, 27, 0.22)"] : ["rgba(255, 255, 255, 0.38)", "rgba(255, 251, 245, 0)", "rgba(255, 251, 245, 0.28)"]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.rim, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.60)" }]} />
    </>}
  </View>;
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  rim: { position: "absolute", top: 0, left: 0, right: 0, height: 1 },
});
