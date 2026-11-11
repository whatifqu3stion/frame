import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Text from "@/components/FrameText";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import PrintStudy from "@/components/motion/PrintStudy";
import { motion } from "@/constants/motion";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useMotionTarget } from "@/hooks/useMotionTarget";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { DiscoveryStage } from "@/services/byokWeeklyPicks";

export const discoveryStageCopy: Record<DiscoveryStage, string> = {
  setup: "Preparing…", suggestions: "Finding creators…", verification: "Checking channels…",
  sample: "Reading recent uploads…", review: "Reviewing video quality…", save: "Saving your selection…",
};

const plates = [
  { motif: "arc", left: "72%", top: "55%", width: "21%", travel: [-0.18, -0.07, 0], tilt: [-9, -3, 0] },
  { motif: "fold", left: "68%", top: "21%", width: "25%", travel: [-0.19, -0.04, 0], tilt: [7, 2, 0] },
  { motif: "orbit", left: "7%", top: "21%", width: "56%", travel: [0.04, 0.02, 0], tilt: [-4, -1, 0] },
] as const;

export function CuratingSelection({ stage }: { stage: DiscoveryStage }) {
  const { palette, type } = useFrameTheme();
  const visible = useMotionVisibility();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const lamp = useRef(new Animated.Value(0)).current;
  const register = useMotionTarget(reduced || stage === "save" ? 2 : stage === "setup" || stage === "suggestions" ? 0 : 1, motion.printArrange);
  useEffect(() => {
    lamp.setValue(0);
    if (!visible || reduced) return;
    const light = Animated.loop(Animated.timing(lamp, { toValue: 1, duration: motion.printLight, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    light.start();
    return () => { light.stop(); lamp.setValue(0); };
  }, [lamp, reduced, visible]);
  return <View style={{ gap: spacing.md }} testID="curating-selection">
    <Text style={type.title} accessibilityRole="header">Preparing your picks.</Text>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)} style={[styles.table, { backgroundColor: palette.programme }]}>
      <ProgrammeGrain />
      {plates.map((plate) => <Animated.View key={plate.motif} style={[styles.plate, {
        left: plate.left, top: plate.top, width: plate.width, backgroundColor: palette.onProgramme,
        transform: [
          { translateX: register.interpolate({ inputRange: [0, 1, 2], outputRange: plate.travel.map((fraction) => fraction * width) }) },
          { rotate: register.interpolate({ inputRange: [0, 1, 2], outputRange: plate.tilt.map((angle) => `${angle}deg`) }) },
        ],
      }]}><View style={styles.ink}><PrintStudy motif={plate.motif} /></View></Animated.View>)}
      {!reduced && visible && width > 0 ? <Animated.View style={[StyleSheet.absoluteFillObject, styles.light, { transform: [{ translateX: lamp.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [-width, -width, width, width] }) }] }]}>
        <LinearGradient style={StyleSheet.absoluteFill} colors={["transparent", palette.onProgramme, "transparent"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} />
      </Animated.View> : null}
    </View>
    <Text style={type.bodySoft} accessibilityLiveRegion="polite" aria-live="polite">{discoveryStageCopy[stage]}</Text>
  </View>;
}

const styles = StyleSheet.create({
  table: { width: "100%", aspectRatio: 1.8, overflow: "hidden", borderRadius: radii.mount },
  plate: { position: "absolute", aspectRatio: 1.55, padding: 4, borderRadius: radii.mount },
  ink: { flex: 1, overflow: "hidden" }, light: { opacity: 0.12 },
});
