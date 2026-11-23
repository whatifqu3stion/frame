import Text from "@/components/FrameText";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useFrameTheme } from "@/constants/useFrameTheme";

// Geometry adapted from noun_Fullscreen_1399012.svg, supplied by the project owner.
// Original: “Fullscreen” by Andrejs Kirma, from the Noun Project.
// Match the corner positions and inks in scripts/render-brand-assets.swift.
const corners = [
  { path: "M3 3V7H0V0H7V3Z", ink: "#834B56" },
  { path: "M17 3H13V0H20V7H17Z", ink: "#3B6073" },
  { path: "M3 17H7V20H0V13H3Z", ink: "#49624C" },
  { path: "M17 17V13H20V20H13V17Z", ink: "#A9755E" },
] as const;

export default function OnboardingIdentity() {
  const { palette, type } = useFrameTheme();
  return <View style={styles.identity} accessible accessibilityLabel="Frame" testID="onboarding-identity">
    <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={24} height={24} viewBox="0 0 20 20" accessible={false} focusable={false}>
        {corners.map(({ path, ink }) => <Path key={ink} d={path} fill={ink} />)}
      </Svg>
    </View>
    <Text style={[type.title, styles.wordmark, { color: palette.ink }]} accessible={false}>Frame</Text>
  </View>;
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
  mark: { width: 24, height: 24 },
  wordmark: { fontSize: 26, lineHeight: 34 },
});
