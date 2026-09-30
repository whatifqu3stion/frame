import { Clock3, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Sheet from "@/components/Sheet";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { tomorrowSnoozeTime } from "@/domain/today";
import SnoozePicker from "./SnoozePicker";

export default function SnoozeModal({ visible, title, busy = false, onClose, onSnooze }: { visible: boolean; title: string; busy?: boolean; onClose: () => void; onSnooze: (until: number) => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [chosen, setChosen] = useState<Date>(new Date(Date.now() + 2 * 60 * 60 * 1_000));
  useEffect(() => { if (visible) setChosen(new Date(Date.now() + 2 * 60 * 60 * 1_000)); }, [visible]);
  return (
    <Sheet visible={visible} onClose={() => { if (!busy) onClose(); }} contentStyle={{ gap: spacing.md }}>
          <View style={styles.header}><View style={styles.flex}><Text style={styles.eyebrow}>Snooze video</Text><Text style={styles.title} numberOfLines={2}>{title}</Text></View><Pressable disabled={busy} onPress={onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close"><X size={20} color={palette.ink} /></Pressable></View>
          <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => onSnooze(tomorrowSnoozeTime(Date.now()))} style={styles.tomorrowButton} accessibilityRole="button">{busy ? <ActivityIndicator color={palette.onDark} /> : <Clock3 size={18} color={palette.onDark} />}<Text style={styles.tomorrowText}>{busy ? "Snoozing…" : "Tomorrow"} · {new Date(tomorrowSnoozeTime(Date.now())).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></Pressable>
          <Text style={styles.or}>Or choose a date and time</Text>
          <SnoozePicker value={chosen} onChange={(date) => { if (!busy) setChosen(date); }} />
          {chosen.getTime() <= Date.now() ? <Text accessibilityLiveRegion="polite" style={[type.bodySoft, { color: palette.danger }]}>Choose a time in the future.</Text> : null}
          <Pressable onPress={() => onSnooze(chosen.getTime())} disabled={busy || chosen.getTime() <= Date.now()} accessibilityState={{ busy, disabled: busy || chosen.getTime() <= Date.now() }} style={({ pressed }) => [styles.confirmButton, (pressed || chosen.getTime() <= Date.now()) && styles.pressed]} accessibilityRole="button"><Text style={styles.confirmText}>Snooze until {chosen.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</Text></Pressable>
    </Sheet>
  );
}
function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({ overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay }, sheet: { padding: spacing.page, paddingBottom: spacing.xl, backgroundColor: palette.surfaceHigh, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, gap: spacing.md }, header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, flex: { flex: 1 }, eyebrow: { ...type.caption, color: palette.accent }, title: { ...type.heading, marginTop: spacing.xs }, iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, tomorrowButton: { minHeight: 52, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep }, tomorrowText: { ...type.label, color: palette.onDark }, or: { ...type.caption, textAlign: "center", marginTop: spacing.sm }, confirmButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radii.control, borderWidth: 1, borderColor: palette.border, marginTop: spacing.sm }, confirmText: { ...type.label, color: palette.accent }, pressed: { opacity: 0.72 } });
}

