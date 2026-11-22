import { Image, StyleSheet, View } from "react-native";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** Decorative static texture, painted before content and excluded from touch/accessibility. */
type Finish = "sheet" | "paper" | "button" | "panel" | "wall";
const inkSheet = require("../assets/textures/panel-ink.png");
const buttonInk = require("../assets/textures/button-ink.png");

export default function ProgrammeGrain({ finish = "paper" }: { finish?: Finish }) {
  const { palette, isDark } = useFrameTheme();
  const opacity = {
    sheet: isDark ? 0.085 : 0.14,
    // The sheet's peak alpha is 80. Match the original card grain's cap of 32.
    paper: palette.programmeGrainOpacity * (32 / 80),
    panel: 0.65,
    wall: 0.14,
    button: 0.28,
  }[finish];
  return <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.clip, { borderRadius: finish === "paper" ? radii.card : finish === "button" ? radii.control : 0 }]}>
    <Image
      source={finish === "button" ? buttonInk : inkSheet}
      resizeMode="cover"
      fadeDuration={0}
      accessible={false}
      style={[styles.sheet, finish === "panel" && styles.panelCrop, { opacity }]}
    />
  </View>;
}
const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  sheet: { width: "100%", height: "100%" },
  panelCrop: { position: "absolute", width: "175%", height: "175%", left: "-37.5%", top: "-37.5%" },
});
