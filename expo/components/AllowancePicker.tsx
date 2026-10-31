import Text from "@/components/FrameText";
import TextField from "@/components/TextField";
import { useFeedback } from "@/hooks/useFeedback";
import MotionView from "@/components/motion/MotionView";
import ChoiceOption from "@/components/ChoiceOption";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { ViewingAllowance } from "@/models/viewingAllowance";

type Props = {
  value: ViewingAllowance;
  onChange: (allowance: ViewingAllowance) => void;
  showLabel?: boolean;
};

const PRESETS = [15, 30, 45, 60] as const;

/** Compact profile viewing-allowance selector with validated whole-minute choices. */
export default function AllowancePicker({ value, onChange, showLabel = true }: Props) {
  const touch = useFeedback();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const isPreset = value.mode === "dailyLimit" && PRESETS.includes(value.minutes as 15 | 30 | 45 | 60);
  const [custom, setCustom] = useState<string>(value.mode === "dailyLimit" && !isPreset ? String(value.minutes) : "");

  const [customMode, setCustomMode] = useState(!isPreset && value.mode === "dailyLimit");

  const chooseCustom = (text: string): void => {
    setCustomMode(true);
    const digits = text.replace(/\D/g, "").slice(0, 4);
    setCustom(digits);
    const minutes = Number(digits);
    onChange({ mode: "dailyLimit", minutes: Number.isInteger(minutes) ? minutes : 0 });
  };

  return (
    <View>
      {showLabel ? <Text style={styles.label}>Daily viewing allowance</Text> : null}
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Daily viewing allowance">
        {PRESETS.map((minutes) => {
          const selected = !customMode && value.mode === "dailyLimit" && value.minutes === minutes;
          return <ChoiceOption key={minutes} label={`${minutes} min`} selected={selected} onPress={() => { if (selected) return; setCustomMode(false); onChange({ mode: "dailyLimit", minutes }); touch.selection(); }} style={styles.option} />;
        })}
        <ChoiceOption label="Custom" selected={value.mode === "dailyLimit" && customMode} onPress={() => { if (customMode && value.mode === "dailyLimit") return; chooseCustom(custom || "1"); touch.selection(); }} style={styles.option} />
        <ChoiceOption label="Unlimited — no daily limit" selected={value.mode === "unlimited"} onPress={() => { if (value.mode === "unlimited") return; setCustomMode(false); onChange({ mode: "unlimited" }); touch.selection(); }} style={styles.unlimited} />
      </View>
      {value.mode === "dailyLimit" && customMode ? <MotionView enter><Text style={styles.note}>Custom minutes (1–1440)</Text><TextField value={custom} onChangeText={chooseCustom} keyboardType="number-pad" placeholder="Minutes (1–1440)" placeholderTextColor={palette.inkMuted} containerStyle={styles.input} maxLength={4} accessibilityLabel="Custom daily viewing allowance in minutes" />{value.minutes < 1 || value.minutes > 1440 ? <Text style={[styles.note, { color: palette.danger }]} accessibilityLiveRegion="polite">Enter between 1 and 1440 minutes.</Text> : null}</MotionView> : null}
      <Text style={styles.note}>This allowance limits playback only inside Frame. It does not limit viewing in browsers or other apps.</Text>
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    label: { ...type.caption, color: palette.inkMuted, marginTop: spacing.md, marginBottom: spacing.sm },
    options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    option: { flexGrow: 1, flexBasis: 110 },
    unlimited: { width: "100%" },
    input: { marginTop: spacing.sm },
    note: { ...type.bodySoft, color: palette.inkMuted, fontSize: 12, marginTop: spacing.sm },
  });
}

