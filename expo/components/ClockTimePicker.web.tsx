import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { formatMinute } from "@/domain/playbackControls";
import { radii, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = { label: string; minuteOfDay: number; onChange: (minute: number) => void };

export default function ClockTimePicker({ label, minuteOfDay, onChange }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [value, setValue] = useState(to24Hour(minuteOfDay));
  useEffect(() => setValue(to24Hour(minuteOfDay)), [minuteOfDay]);
  const commit = (): void => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    const hour = Number(match?.[1]);
    const minute = Number(match?.[2]);
    if (match && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) onChange(hour * 60 + minute);
    else setValue(to24Hour(minuteOfDay));
  };
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={setValue} onBlur={commit} onSubmitEditing={commit} placeholder="08:00" style={styles.input} accessibilityLabel={`${label}, currently ${formatMinute(minuteOfDay)}`} />
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
    input: { minHeight: 48, borderRadius: radii.control, backgroundColor: palette.surfaceDeep, color: palette.ink, textAlign: "center", paddingHorizontal: 12 },
  });
}
