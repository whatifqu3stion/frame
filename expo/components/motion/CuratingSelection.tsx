import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Text from "@/components/FrameText";
import { motion } from "@/constants/motion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { DiscoveryStage } from "@/services/byokWeeklyPicks";

export const discoveryStageCopy: Record<DiscoveryStage, string> = {
  setup: "Preparing your search…", suggestions: "Finding creators for your interests…", verification: "Checking the channels…",
  sample: "Looking through recent videos…", review: "Reviewing your possible picks…", save: "Saving your discoveries…",
};
function PrintFrame({ index, ready }: { index: number; ready: boolean }) {
  const { palette } = useFrameTheme();
  const reduced = useReducedMotion();
  const visible = useMotionVisibility();
  const breath = useSharedValue(0);
  const settled = useSharedValue(ready ? 1 : 0);
  useEffect(() => {
    settled.set(reduced ? Number(ready) : withTiming(Number(ready), { duration: motion.artwork }));
    if (!reduced && visible && !ready) breath.set(withRepeat(withTiming(1, { duration: 1900 + index * 240, easing: Easing.inOut(Easing.sin) }), -1, true));
    else breath.set(0);
    return () => { cancelAnimation(breath); cancelAnimation(settled); };
  }, [breath, settled, ready, reduced, visible, index]);
  const frameStyle = useAnimatedStyle(() => ({ opacity: ready ? 1 : 0.52 + breath.get() * 0.25,
    transform: [{ translateY: reduced ? 0 : (1 - settled.get()) * ((index === 1 ? -7 : 7) - breath.get() * 4) }] }));
  const inkStyle = useAnimatedStyle(() => ({ opacity: settled.get() }));
  return <Animated.View style={[styles.frame, { backgroundColor: palette.surface, borderColor: palette.border }, frameStyle]}>
    <View style={[styles.matte, { borderColor: palette.borderSoft, backgroundColor: palette.activeSoft }]}>
      <View style={[styles.rule, { backgroundColor: palette.active, opacity: 0.14 }]} />
      <Animated.View style={[styles.seal, { backgroundColor: palette.accentDeep }, inkStyle]}><Check size={18} strokeWidth={2.6} color={palette.onDark} /></Animated.View>
    </View>
    <View style={[styles.caption, { backgroundColor: palette.borderSoft }]} />
  </Animated.View>;
}
/** Count only accepted reviews; the quiet motion never pretends to measure time remaining. */
export function CuratingSelection({ stage, reviewedCount = 0, startedAt }: { stage: DiscoveryStage; reviewedCount?: number; startedAt?: number }) {
  const { palette, type } = useFrameTheme();
  const [mountedAt] = useState(Date.now);
  const [patient, setPatient] = useState(false);
  const visible = useMotionVisibility();
  const reduced = useReducedMotion();
  const thanks = useSharedValue(0);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setPatient(true), Math.max(0, 12000 - (Date.now() - (startedAt ?? mountedAt))));
    return () => clearTimeout(timer);
  }, [visible, startedAt, mountedAt]);
  useEffect(() => { thanks.set(reduced ? Number(patient) : withTiming(Number(patient), { duration: motion.artwork })); return () => cancelAnimation(thanks); }, [patient, reduced, thanks]);
  const thanksStyle = useAnimatedStyle(() => ({ opacity: thanks.get() }));
  return <View style={styles.content} testID="curating-selection">
    <Text style={[type.label, styles.eyebrow, { color: palette.active }]}>CHOSEN AROUND YOU</Text>
    <Text style={[type.title, styles.title]} accessibilityRole="header">Finding your kind{"\n"}of good.</Text>
    <Text style={[type.bodySoft, styles.intro]}>A few discoveries worth your time.</Text>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.prints}>
      {[0, 1, 2].map(index => <PrintFrame key={index} index={index} ready={reviewedCount > index} />)}
    </View>
    <View style={styles.status} accessibilityLiveRegion="polite">
      <Text style={[type.label, styles.center]}>{discoveryStageCopy[stage]}</Text>
      <Text style={[type.bodySoft, styles.count]}>{reviewedCount ? `${reviewedCount} ${reviewedCount === 1 ? "pick" : "picks"} reviewed` : "Your first picks will appear as they’re ready."}</Text>
    </View>
    <Animated.View style={[styles.thanks, thanksStyle]} accessibilityElementsHidden={!patient} importantForAccessibility={patient ? "auto" : "no-hide-descendants"}>
      <Text style={[type.bodySoft, styles.center]} accessibilityLiveRegion="polite">{patient ? "Thanks for waiting. We’re checking the details." : " "}</Text>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  content: { alignItems: "center", paddingTop: 24, paddingBottom: 12 },
  eyebrow: { textAlign: "center", fontSize: 11, letterSpacing: 1.7, marginBottom: 16 },
  title: { textAlign: "center", maxWidth: 340 },
  intro: { textAlign: "center", marginTop: 16, maxWidth: 290 },
  prints: { flexDirection: "row", justifyContent: "center", gap: 12, paddingVertical: 46, width: "100%", maxWidth: 310 },
  frame: { flex: 1, maxWidth: 88, aspectRatio: 0.77, borderWidth: 1, borderRadius: 5, padding: 7 },
  matte: { flex: 1, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  rule: { width: 1, height: "150%", position: "absolute", transform: [{ rotate: "36deg" }] },
  seal: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  caption: { height: 2, width: "42%", marginTop: 8, marginBottom: 3 },
  status: { gap: 8, minHeight: 72, maxWidth: 310 },
  center: { textAlign: "center" },
  count: { textAlign: "center", fontSize: 14, lineHeight: 21 },
  thanks: { minHeight: 60, marginTop: 24, maxWidth: 270 },
});
