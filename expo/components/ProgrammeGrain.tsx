import { Image, StyleSheet, View } from "react-native";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** Decorative static texture, painted before content and excluded from touch/accessibility. */
export default function ProgrammeGrain() {
  const { palette } = useFrameTheme();
  return <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.clip}>
    <Image
      source={require("../assets/textures/programme-grain.png")}
      resizeMode="repeat"
      fadeDuration={0}
      accessible={false}
      style={[styles.tile, { opacity: palette.programmeGrainOpacity }]}
    />
  </View>;
}
const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFillObject, borderRadius: radii.card, overflow: "hidden" },
  tile: { width: "100%", height: "100%" },
});
