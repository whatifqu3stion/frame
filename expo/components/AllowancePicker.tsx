import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { ManagedAllowance } from "@/models/dailyAllowance";

type Props = {
  value: ManagedAllowance;
  onChange: (allowance: ManagedAllowance) => void;
};

const PRESETS = [15, 30, 60] as const;

/** Compact explicit allowance selector shared by Managed creation and editing. */
export default function AllowancePicker({ value, onChange }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const isPreset = value.mode === "dailyLimit" && PRESETS.includes(value.minutes as 15 | 30 | 60);
  const [custom, setCustom] = useState<string>(value.mode === "dailyLimit" && !isPreset ? String(value.minutes) : "");

  useEffect(() => {
    setCustom(value.mode === "dailyLimit" && !isPreset ? String(value.minutes) : "");
  }, [isPreset, value]);

  const chooseCustom = (text: string): void => {
    const digits = text.replace(/\D/g, "").slice(0, 4);
    setCustom(digits);
    const minutes = Number(digits);
    onChange({ mode: "dailyLimit", minutes: Number.isInteger(minutes) ? minutes : 0 });
  };

  return (
    <View>
      <Text style={styles.label}>Daily Frame time</Text>
      <View style={styles.options}>
        {PRESETS.map((minutes) => {
          const selected = value.mode === "dailyLimit" && value.minutes === minutes;
          return <Pressable key={minutes} onPress={() => onChange({ mode: "dailyLimit", minutes })} style={[styles.option, selected && styles.selected]} accessibilityRole="radio" accessibilityState={{ selected }}><Text style={[styles.optionText, selected && styles.selectedText]}>{minutes} min</Text></Pressable>;
        })}
        <Pressable onPress={() => chooseCustom(custom || "1")} style={[styles.option, value.mode === "dailyLimit" && !isPreset && styles.selected]} accessibilityRole="radio"><Text style={[styles.optionText, value.mode === "dailyLimit" && !isPreset && styles.selectedText]}>Custom</Text></Pressable>
        <Pressable onPress={() => onChange({ mode: "unlimited" })} style={[styles.unlimited, value.mode === "unlimited" && styles.selected]} accessibilityRole="radio" accessibilityState={{ selected: value.mode === "unlimited" }}><Text style={[styles.optionText, value.mode === "unlimited" && styles.selectedText]}>Unlimited — no daily limit</Text></Pressable>
      </View>
      {value.mode === "dailyLimit" && !isPreset ? <TextInput value={custom} onChangeText={chooseCustom} keyboardType="number-pad" placeholder="Minutes (1–1440)" placeholderTextColor={palette.inkMuted} style={styles.input} accessibilityLabel="Custom Daily Frame time in minutes" /> : null}
      <Text style={styles.note}>This allowance limits playback only inside Frame. It does not block YouTube, browsers, or other apps.</Text>
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    label: { ...type.caption, color: palette.inkMuted, marginTop: spacing.md, marginBottom: spacing.sm },
    options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    option: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    unlimited: { minHeight: 48, width: "100%", justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    selected: { borderColor: palette.active, backgroundColor: palette.activeSoft },
    optionText: { ...type.label, color: palette.inkMuted, fontSize: 12 },
    selectedText: { color: palette.active },
    input: { ...type.body, minHeight: 48, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.borderSoft, borderRadius: radii.control, backgroundColor: palette.surfaceHigh },
    note: { ...type.bodySoft, color: palette.inkMuted, fontSize: 11, marginTop: spacing.sm },
  });
}
