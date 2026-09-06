import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function SnoozePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{value.toLocaleString()}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => onChange(new Date(value.getTime() + 60 * 60 * 1_000))} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>+1 hour</Text></Pressable>
        <Pressable onPress={() => onChange(new Date(value.getTime() + 24 * 60 * 60 * 1_000))} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>+1 day</Text></Pressable>
      </View>
    </View>
  );
}
function createStyles(palette: FramePalette, type: FrameType) { return StyleSheet.create({ wrap: { gap: spacing.md }, text: { ...type.body, textAlign: "center" }, row: { flexDirection: "row", gap: spacing.sm }, button: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.surfaceDeep }, buttonText: { ...type.label, color: palette.accent } }); }
