import Text from "@/components/FrameText";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { motion } from "@/constants/motion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { useReducedMotionPreference } from "@/hooks/useReducedMotion";

// Geometry adapted from noun_Fullscreen_1399012.svg, supplied by the project owner.
// Original: “Fullscreen” by Andrejs Kirma, from the Noun Project.
const corners = [
  { path: "M3 3V7H0V0H7V3Z", x: -1, y: -1 },
  { path: "M17 3H13V0H20V7H17Z", x: 1, y: -1 },
  { path: "M3 17H7V20H0V13H3Z", x: -1, y: 1 },
  { path: "M17 17V13H20V20H13V17Z", x: 1, y: 1 },
] as const;

/** One quiet assembly of the supplied mark; setup remains interactive throughout. */
export default function OnboardingIdentity({ enter, onPresented }: { enter: boolean; onPresented(): void }) {
  const { palette, type } = useFrameTheme();
  const preference = useReducedMotionPreference();
  const { progress } = usePresentationProgress({
    enter, deferEntrance: true, active: preference !== null,
    duration: motion.introduction, onPresented,
  });
  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] });
  return <View style={styles.identity} accessible accessibilityLabel="Frame" testID="onboarding-identity">
    <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      {corners.map(({ path, x, y }) => <Animated.View key={path} style={[StyleSheet.absoluteFill, {
        transform: [{ translateX: Animated.multiply(offset, x) }, { translateY: Animated.multiply(offset, y) }],
      }]}>
        <Svg width={36} height={36} viewBox="0 0 20 20"><Path d={path} fill={palette.active} /></Svg>
      </Animated.View>)}
    </View>
    <Text style={[type.title, styles.wordmark, { color: palette.ink }]} accessible={false}>Frame</Text>
  </View>;
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  mark: { width: 36, height: 36 },
  wordmark: { fontSize: 32, lineHeight: 42 },
});
