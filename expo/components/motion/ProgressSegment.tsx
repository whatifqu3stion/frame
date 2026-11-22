import { Animated, StyleSheet, View } from "react-native";
import { useMotionTarget } from "@/hooks/useMotionTarget";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";

/** Setup progress resolves in place, including Back; no invented waiting. */
export default function ProgressSegment({ complete }: { complete: boolean }) {
  const { palette } = useFrameTheme();
  const opacity = useMotionTarget(complete ? 1 : 0, motion.choice);
  return <View accessible={false} style={[styles.track, { backgroundColor: palette.borderSoft }]}>
    <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.active, opacity }]} />
  </View>;
}
const styles = StyleSheet.create({ track: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" } });
