import Text from "@/components/FrameText";
import SelectionArtwork from "@/components/motion/SelectionArtwork";
import type { ReactNode } from "react";
import { Check } from "lucide-react-native";
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Pressable from "@/components/motion/ChoicePressable";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = Omit<PressableProps, "children" | "style" | "accessibilityRole" | "accessibilityState"> & {
  label: string;
  selected: boolean;
  role?: "radio" | "checkbox";
  variant?: "outlined" | "ruled";
  leading?: ReactNode;
  unselectedMark?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Shared choice grammar: quiet backing, an explicit check, and wrapping text. */
export default function ChoiceOption({ label, selected, role = "radio", variant = "outlined", leading, unselectedMark, style, disabled = false, ...props }: Props) {
  const { palette, type } = useFrameTheme();
  return <Pressable {...props} disabled={disabled} accessibilityRole={role} aria-checked={selected} accessibilityState={{ checked: selected, disabled: Boolean(disabled) }} style={({ pressed }) => [
    styles.option,
    variant === "ruled" ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border } : { borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    selected && { backgroundColor: palette.activeSoft },
    style,
    disabled && styles.disabled,
    pressed && { backgroundColor: palette.surfaceDeep },
  ]}>
    {leading ? <View accessible={false}><SelectionArtwork selected={selected}>{leading}</SelectionArtwork></View> : null}
    <Text style={[type.label, styles.label, { color: selected ? palette.active : palette.ink }]}>{label}</Text>
    <View style={styles.mark} accessible={false}>{selected ? <Check size={16} color={palette.active} /> : unselectedMark}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  option: { minHeight: 52, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.control },
  label: { flex: 1, flexShrink: 1 },
  mark: { width: 16, height: 16, flexShrink: 0 },
  disabled: { opacity: 0.5 },
});
