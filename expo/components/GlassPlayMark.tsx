import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Play } from "lucide-react-native";
import Text from "@/components/FrameText";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { StyleSheet, View } from "react-native";
import { useReducedTransparency } from "@/hooks/useReducedTransparency";

/** The enclosing poster owns the hit area and accessible action. */
export default function GlassPlayMark({ label }: { label?: string } = {}) {
  const opaque = useReducedTransparency();
  const { type } = useFrameTheme();
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.lens, Boolean(label) && styles.labelled, opaque && styles.opaque]}>
    {!opaque && <>
      <BlurView tint="dark" intensity={28} experimentalBlurMethod="dimezisBlurView" style={styles.surface} />
      <LinearGradient colors={["rgba(255,255,255,0.32)", "rgba(27,24,23,0.30)", "rgba(255,255,255,0.12)"]}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.surface} />
    </>}
    <View style={styles.symbol}><Play size={18} fill="#FFFDF9" color="#FFFDF9" /></View>
    {label && <Text style={[type.label, styles.label]}>{label}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  lens: { position: "absolute", left: 12, bottom: 12, width: 46, height: 46, borderRadius: 23,
    overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,31,29,0.46)",
    borderWidth: 1, borderColor: "rgba(255,253,249,0.60)" },
  surface: { ...StyleSheet.absoluteFillObject, borderRadius: 23, overflow: "hidden" },
  symbol: { zIndex: 1, marginLeft: 2 },
  opaque: { backgroundColor: "#342B25" },
  labelled: { width: "auto", minHeight: 46, height: "auto", paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", gap: 6, backgroundColor: "rgba(34,31,29,0.78)" },
  label: { color: "#FFFDF9" },
});
