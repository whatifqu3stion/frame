import Text from "@/components/FrameText";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

function localInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export default function SnoozePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const { palette, type, isDark } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const changeDay = (days: number): void => { const next = new Date(value); next.setDate(next.getDate() + days); onChange(next); };
  return <View style={styles.wrap}>
    <Text style={type.label}>Return date and time</Text>
    <input type="datetime-local" aria-label="Return date and local time" value={localInput(value)} min={localInput(new Date())} onChange={(event) => { const next = new Date(event.target.value); if (Number.isFinite(next.getTime())) onChange(next); }} style={{ minHeight: 48, width: "100%", boxSizing: "border-box", padding: 12, borderRadius: radii.control, border: `1px solid ${palette.border}`, background: palette.surface, color: palette.ink, font: "inherit", fontSize: 16, colorScheme: isDark ? "dark" : "light" }} />
    <View style={styles.row}>
      <Pressable onPress={() => changeDay(-1)} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>Previous day</Text></Pressable>
      <Pressable onPress={() => changeDay(1)} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>Next day</Text></Pressable>
    </View>
  </View>;
}
function createStyles(palette: FramePalette, type: FrameType) { return StyleSheet.create({ wrap: { gap: spacing.md }, row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, button: { minHeight: 48, flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.control, backgroundColor: palette.surfaceDeep }, buttonText: { ...type.label, color: palette.accent } }); }
