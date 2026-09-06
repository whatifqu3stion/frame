import { Clock3, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { tomorrowSnoozeTime } from "@/domain/today";
import SnoozePicker from "./SnoozePicker";

export default function SnoozeModal({ visible, title, onClose, onSnooze }: { visible: boolean; title: string; onClose: () => void; onSnooze: (until: number) => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [chosen, setChosen] = useState<Date>(new Date(Date.now() + 2 * 60 * 60 * 1_000));
  useEffect(() => { if (visible) setChosen(new Date(Date.now() + 2 * 60 * 60 * 1_000)); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close snooze options" />
        <View style={styles.sheet}>
          <View style={styles.header}><View style={styles.flex}><Text style={styles.eyebrow}>Return later</Text><Text style={styles.title} numberOfLines={2}>{title}</Text></View><Pressable onPress={onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close"><X size={20} color={palette.ink} /></Pressable></View>
          <Pressable onPress={() => onSnooze(tomorrowSnoozeTime(Date.now()))} style={styles.tomorrowButton} accessibilityRole="button"><Clock3 size={18} color={palette.onDark} /><Text style={styles.tomorrowText}>Tomorrow morning</Text></Pressable>
          <Text style={styles.or}>Or choose a local return time</Text>
          <SnoozePicker value={chosen} onChange={setChosen} />
          <Pressable onPress={() => onSnooze(chosen.getTime())} disabled={chosen.getTime() <= Date.now()} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]} accessibilityRole="button"><Text style={styles.confirmText}>Snooze until {chosen.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({ overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay }, sheet: { padding: spacing.page, paddingBottom: spacing.xl, backgroundColor: palette.surfaceHigh, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, gap: spacing.md }, header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, flex: { flex: 1 }, eyebrow: { ...type.caption, color: palette.accent }, title: { ...type.heading, marginTop: spacing.xs }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, tomorrowButton: { minHeight: 52, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep }, tomorrowText: { ...type.label, color: palette.onDark }, or: { ...type.caption, textAlign: "center", marginTop: spacing.sm }, confirmButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radii.control, borderWidth: 1, borderColor: palette.border, marginTop: spacing.sm }, confirmText: { ...type.label, color: palette.accent }, pressed: { opacity: 0.72 } });
}
