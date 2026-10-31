import type { ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useMotionTarget } from "@/hooks/useMotionTarget";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";

/** The selected backing opens around the icon without moving the tab target. */
export default function TabIconSurface({ focused, children }: { focused: boolean; children: ReactNode }) {
  const { palette } = useFrameTheme();
  const reduced = useReducedMotion();
  const opacity = useMotionTarget(focused ? 1 : 0, motion.choice);
  return <View style={styles.icon}>
    <Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFillObject, styles.backing, { backgroundColor: palette.activeSoft, opacity, transform: [{ scaleX: opacity.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.55, 1] }) }, { scaleY: opacity.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.85, 1] }) }] }]} />
    {children}
  </View>;
}
const styles = StyleSheet.create({ icon: { width: 44, height: 28, alignItems: "center", justifyContent: "center" }, backing: { borderRadius: 14 } });
