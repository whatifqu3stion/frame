import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CalendarClock } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function SnoozePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const handleChange = (_event: DateTimePickerEvent, selected?: Date): void => {
    if (Platform.OS === "android") setMode(null);
    if (selected) onChange(selected);
  };
  if (Platform.OS === "ios") {
    return <DateTimePicker value={value} mode="datetime" display="inline" minimumDate={new Date()} onChange={handleChange} accentColor={palette.accent} />;
  }
  return (
    <View style={styles.row}>
      <Pressable onPress={() => setMode("date")} style={styles.button} accessibilityRole="button"><CalendarClock size={17} color={palette.accent} /><Text style={styles.text}>{value.toLocaleDateString()}</Text></Pressable>
      <Pressable onPress={() => setMode("time")} style={styles.button} accessibilityRole="button"><Text style={styles.text}>{value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></Pressable>
      {mode ? <DateTimePicker value={value} mode={mode} minimumDate={new Date()} onChange={handleChange} /> : null}
    </View>
  );
}
function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({ row: { flexDirection: "row", gap: spacing.sm }, button: { minHeight: 48, flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.surfaceDeep }, text: { ...type.label, color: palette.accent } });
}
