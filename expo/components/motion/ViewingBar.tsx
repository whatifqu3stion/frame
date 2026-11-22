import { Animated, StyleSheet, View } from "react-native";
import { useMotionTarget } from "@/hooks/useMotionTarget";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";

export const VIEWING_BAR_HEIGHT = 48;

/** Fixed plot geometry: transform the bar around its baseline, never its hit target. */
export default function ViewingBar({ height, selected, index, scrubbing = false }: { height: number; selected: boolean; index: number; scrubbing?: boolean }) {
  const { palette } = useFrameTheme();
  const amount = useMotionTarget(height / VIEWING_BAR_HEIGHT, motion.chart);
  const selection = useMotionTarget(selected ? 1 : 0, scrubbing ? 0 : motion.choice);
  const { progress } = usePresentationProgress({ enter: true, duration: motion.chart + index * 30 });
  const scale = Animated.multiply(amount, progress.interpolate({ inputRange: [0, 1], outputRange: [0.08, 1] }));
  return <View style={styles.column} pointerEvents="none" accessible={false}>
    <Animated.View style={[styles.bar, { backgroundColor: palette.inkMuted, transform: [{ translateY: Animated.multiply(Animated.subtract(1, scale), VIEWING_BAR_HEIGHT / 2) }, { scaleY: scale }] }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.active, opacity: selection }]} />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({ column: { height: VIEWING_BAR_HEIGHT, width: "45%", maxWidth: 26, overflow: "hidden" }, bar: { height: VIEWING_BAR_HEIGHT, width: "100%" } });
