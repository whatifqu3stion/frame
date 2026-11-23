import Text from "@/components/FrameText";
import SelectionArtwork from "@/components/motion/SelectionArtwork";
import type { KeyboardEvent, ReactNode } from "react";
import { Check, Square } from "lucide-react-native";
import { Platform, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Pressable from "@/components/motion/ChoicePressable";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = Omit<PressableProps, "children" | "style" | "accessibilityRole" | "accessibilityState"> & {
  label: string;
  detail?: string;
  dimWhenDisabled?: boolean;
  selected: boolean;
  role?: "radio" | "checkbox";
  variant?: "outlined" | "ruled" | "filter" | "topic";
  leading?: ReactNode;
  unselectedMark?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// React Native Web renders radio and checkbox roles on divs. Its press
// responder handles Enter but leaves Space and radio-group arrows to us.
function onChoiceKeyDown(event: KeyboardEvent<HTMLElement>) {
  const target = event.currentTarget;
  if (event.target !== target || target.getAttribute("aria-disabled") === "true") return;
  if (event.key === " " && target.tagName !== "BUTTON") {
    event.preventDefault();
    if (!event.repeat) target.click();
    return;
  }
  if (target.getAttribute("role") !== "radio") return;
  const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1
    : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
  const group = target.closest('[role="radiogroup"]');
  if (!step || !group) return;
  const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"]):not(:disabled)'))
    .filter((element) => element.closest('[role="radiogroup"]') === group);
  const index = radios.indexOf(target);
  if (index < 0 || !radios.length) return;
  event.preventDefault();
  const next = radios[(index + step + radios.length) % radios.length];
  next.focus();
  next.click();
}

/** Shared choice grammar: quiet backing, an explicit check, and wrapping text. */
export default function ChoiceOption({ label, detail, selected, role = "radio", variant = "outlined", leading, unselectedMark, style, disabled = false, dimWhenDisabled = true, ...props }: Props) {
  const { palette, type } = useFrameTheme();
  const filter = variant === "filter";
  const mark = <View style={styles.mark} accessible={false}>{selected ? <Check size={16} color={palette.active} /> : unselectedMark ?? (Platform.isTV && role === "checkbox" ? <Square size={15} color={palette.inkMuted} /> : null)}</View>;
  return <Pressable {...props} {...(Platform.OS === "web" ? { onKeyDown: onChoiceKeyDown } : {})} disabled={disabled} accessibilityRole={role} aria-checked={selected} accessibilityState={{ checked: selected, disabled: Boolean(disabled) }} style={({ pressed }) => [
    styles.option,
    variant === "ruled" ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border } : { borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    selected && { backgroundColor: palette.activeSoft },
    filter && [styles.filter, { borderColor: selected ? palette.active : palette.border }],
    variant === "topic" && [styles.topic, { borderColor: selected ? palette.active : palette.border }],
    style,
    disabled && dimWhenDisabled && styles.disabled,
    pressed && { backgroundColor: palette.surfaceDeep },
  ]}>
    {leading ? <View accessible={false}><SelectionArtwork selected={selected}>{leading}</SelectionArtwork></View> : null}
    {filter ? mark : null}
    {detail ? <View style={[styles.label, { gap: spacing.xs }]}>
      <Text style={[type.label, { color: selected ? palette.active : palette.ink }]}>{label}</Text>
      <Text style={type.caption}>{detail}</Text>
    </View> : <Text style={[type.label, styles.label, filter && styles.filterLabel, variant === "topic" && styles.topicLabel, { color: selected ? palette.active : palette.ink }]}>{label}</Text>}
    {!filter ? mark : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  option: { minHeight: 52, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.control },
  label: { flexGrow: 1, flexShrink: 1, flexBasis: "auto" },
  filter: { minHeight: 48, flexShrink: 1, paddingHorizontal: spacing.md, justifyContent: "center" },
  filterLabel: { flexGrow: 0 },
  topic: { minHeight: 54, paddingHorizontal: 12 },
  topicLabel: { fontSize: 16, lineHeight: 21 },
  mark: { width: 16, height: 16, flexShrink: 0 },
  disabled: { opacity: 0.5 },
});
