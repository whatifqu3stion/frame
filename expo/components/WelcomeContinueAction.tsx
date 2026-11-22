import { useLayoutEffect } from "react";
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import OnboardingGlimmer from "./motion/OnboardingGlimmer";
import PrimaryAction from "@/components/PrimaryAction";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import Text from "@/components/FrameText";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";
import { radii, spacing } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const fillEase = Easing.bezier(0.77, 0, 0.175, 1);

/** The preview's conclusion emphasizes the available next step. */
export default function WelcomeContinueAction({ complete, showCue, label, disabled, onPress, style }: {
  complete: boolean;
  showCue: boolean;
  label: string;
  disabled: boolean;
  onPress: PressableProps["onPress"];
  style: StyleProp<ViewStyle>;
}) {
  const { palette, type } = useFrameTheme();
  const reduced = useReducedMotion();
  const fill = useSharedValue(complete ? 1 : 0);
  useLayoutEffect(() => {
    fill.set(complete ? withTiming(1, { duration: reduced ? motion.choice : motion.reveal, easing: fillEase }) : 0);
    return () => cancelAnimation(fill);
  }, [complete, reduced, fill]);
  const mask = useAnimatedStyle(() => ({
    opacity: reduced ? fill.get() : 1,
    transform: [{ translateX: reduced ? "0%" : `${(fill.get() - 1) * 100}%` }],
  }));
  // Keep the label fixed as the clipped ink layer moves across it.
  const labelPosition = useAnimatedStyle(() => ({
    transform: [{ translateX: reduced ? "0%" : `${(1 - fill.get()) * 100}%` }],
  }));
  return <PrimaryAction onPress={onPress} disabled={disabled} depth={palette.primaryButtonDepth}
    accessibilityLabel={label} accessibilityState={{ disabled }} testID="onboarding-next"
    style={[style, { backgroundColor: palette.accentSoft }]}>
    <Text style={[type.label, styles.label, { color: palette.accentDeep }]}>{label}</Text>
    <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.clip}>
      <Animated.View style={[styles.ink, { backgroundColor: palette.accentDeep }, mask]}>
        <ProgrammeGrain finish="button" />
        <Animated.View style={[styles.caption, labelPosition]}>
          <Text style={[type.label, styles.label, { color: palette.onDark }]}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </View>
    {showCue && <OnboardingGlimmer />}
  </PrimaryAction>;
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: radii.control, borderCurve: "continuous" },
  ink: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  caption: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: spacing.md },
  label: { textAlign: "center" },
});
