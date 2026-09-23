import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Clock3 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { formatMinute } from "@/domain/playbackControls";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = { label: string; minuteOfDay: number; onChange: (minute: number) => void };

export default function ClockTimePicker({ label, minuteOfDay, onChange }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [open, setOpen] = useState(false);
  const value = useMemo(() => new Date(2020, 0, 1, Math.floor(minuteOfDay / 60), minuteOfDay % 60), [minuteOfDay]);
  const handleChange = (_event: DateTimePickerEvent, selected?: Date): void => {
    if (Platform.OS === "android") setOpen(false);
    if (selected) onChange(selected.getHours() * 60 + selected.getMinutes());
  };
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === "ios" ? (
        <DateTimePicker value={value} mode="time" display="compact" minuteInterval={15} onChange={handleChange} accentColor={palette.accent} accessibilityLabel={label} />
      ) : (
        <>
          <Pressable onPress={() => setOpen(true)} style={styles.button} accessibilityRole="button" accessibilityLabel={`${label}, ${formatMinute(minuteOfDay)}`}>
            <Clock3 size={16} color={palette.accent} /><Text style={styles.value}>{formatMinute(minuteOfDay)}</Text>
          </Pressable>
          {open ? <DateTimePicker value={value} mode="time" minuteInterval={15} onChange={handleChange} /> : null}
        </>
      )}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    wrap: { flex: 1, gap: 6 },
    label: { ...type.caption, color: palette.inkMuted },
    button: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, backgroundColor: palette.surfaceDeep },
    value: { ...type.label, color: palette.accent },
  });
}
