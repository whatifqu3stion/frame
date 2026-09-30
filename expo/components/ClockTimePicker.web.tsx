import TextField from "@/components/TextField";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatMinute } from "@/domain/playbackControls";
import { type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = { label: string; minuteOfDay: number; onChange: (minute: number) => void; onValidityChange?: (valid: boolean) => void };

export default function ClockTimePicker({ label, minuteOfDay, onChange, onValidityChange }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(to24Hour(minuteOfDay));
  useEffect(() => setValue(to24Hour(minuteOfDay)), [minuteOfDay]);
  const update = (text: string): void => {
    setValue(text);
    const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
    const hour = Number(match?.[1]);
    const minute = Number(match?.[2]);
    const valid = Boolean(match && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59);
    onValidityChange?.(valid);
    setError(valid ? null : "Enter a time from 00:00 to 23:59 before saving.");
    if (valid) onChange(hour * 60 + minute);
  };
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={type.bodySoft}>24-hour time · HH:MM</Text>
      <TextField value={value} onChangeText={update} onSubmitEditing={() => update(value)} placeholder="08:00" style={styles.input} maxLength={5} autoCorrect={false} autoCapitalize="none" accessibilityLabel={`${label}, currently ${formatMinute(minuteOfDay)}`} />
      {error ? <Text accessibilityLiveRegion="polite" style={[type.bodySoft, { color: palette.danger }]}>{error}</Text> : null}
    </View>
  );
}

function to24Hour(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    wrap: { flex: 1, gap: 6 },
    label: { ...type.caption, color: palette.inkMuted },
    input: { textAlign: "center", fontVariant: ["tabular-nums"] },
  });
}

