import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import { Clock3, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Sheet from "@/components/Sheet";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { tomorrowSnoozeTime } from "@/domain/today";
import SnoozePicker from "./SnoozePicker";

export default function SnoozeModal({ visible, title, busy = false, error, onClose, onSnooze, onDismiss }: { visible: boolean; title: string; busy?: boolean; error?: string | null; onClose: () => void; onSnooze: (until: number) => void; onDismiss?: () => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [chosen, setChosen] = useState<Date>(new Date(Date.now() + 2 * 60 * 60 * 1_000));
  const hasActions = Boolean(onDismiss);
  const [choosingTime, setChoosingTime] = useState(!hasActions);
  useEffect(() => { if (visible) { setChosen(new Date(Date.now() + 2 * 60 * 60 * 1_000)); setChoosingTime(!hasActions); } }, [visible, hasActions]);
  return (
    <Sheet visible={visible} onClose={() => { if (!busy) onClose(); }} onBack={choosingTime && onDismiss ? () => { if (!busy) setChoosingTime(false); } : undefined} contentKey={choosingTime ? "snooze" : "actions"} contentStyle={{ gap: spacing.md }}>
          <View style={styles.header}><View style={styles.flex}><Text style={type.heading} accessibilityRole="header">{choosingTime ? "Snooze video" : "Video options"}</Text><Text style={type.bodySoft}>{title}</Text></View><Pressable disabled={busy} accessibilityState={{ disabled: busy }} onPress={onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close video options"><X size={20} color={palette.ink} /></Pressable></View>
          {error ? <Text accessibilityLiveRegion="polite" style={[type.bodySoft, { color: palette.danger }]}>{error}</Text> : null}
          {!choosingTime ? <>
            <Text style={type.bodySoft}>Choose when this video returns, or remove it from today’s selection.</Text>
            <Pressable disabled={busy} accessibilityState={{ disabled: busy }} accessibilityRole="button" onPress={() => setChoosingTime(true)} style={styles.confirmButton}><Text style={styles.confirmText}>Snooze</Text></Pressable>
            <Pressable disabled={busy} accessibilityState={{ disabled: busy, busy }} accessibilityRole="button" onPress={onDismiss} style={styles.confirmButton}><Text style={[styles.confirmText, { color: palette.danger }]}>{busy ? "Dismissing…" : "Dismiss from Today"}</Text></Pressable>
            <Text style={type.caption}>You can undo a dismissal. Saved videos stay in Saved.</Text>
          </> : <>
          {onDismiss ? <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => setChoosingTime(false)} style={styles.confirmButton}><Text style={styles.confirmText}>Back to video options</Text></Pressable> : null}
          <PrimaryAction depth={palette.primaryButtonDepth} disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => onSnooze(tomorrowSnoozeTime(Date.now()))} style={styles.tomorrowButton} accessibilityRole="button">{busy ? <ActivityIndicator color={palette.onDark} /> : <Clock3 size={18} color={palette.onDark} />}<Text style={styles.tomorrowText}>{busy ? "Snoozing…" : "Tomorrow"} · {new Date(tomorrowSnoozeTime(Date.now())).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></PrimaryAction>
          <Text style={styles.or}>Or choose a date and time</Text>
          <SnoozePicker value={chosen} onChange={(date) => { if (!busy) setChosen(date); }} />
          {chosen.getTime() <= Date.now() ? <Text accessibilityLiveRegion="polite" style={[type.bodySoft, { color: palette.danger }]}>Choose a time in the future.</Text> : null}
          <Pressable onPress={() => onSnooze(chosen.getTime())} disabled={busy || chosen.getTime() <= Date.now()} accessibilityState={{ busy, disabled: busy || chosen.getTime() <= Date.now() }} style={({ pressed }) => [styles.confirmButton, (pressed || chosen.getTime() <= Date.now()) && styles.pressed]} accessibilityRole="button"><Text style={styles.confirmText}>Snooze until {chosen.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</Text></Pressable>
          </>}
    </Sheet>
  );
}
function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({ overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay }, sheet: { padding: spacing.page, paddingBottom: spacing.xl, backgroundColor: palette.surfaceHigh, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, gap: spacing.md }, header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, flex: { flex: 1 }, eyebrow: { ...type.caption, color: palette.accent }, title: { ...type.heading, marginTop: spacing.xs }, iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, tomorrowButton: { minHeight: 52, padding: spacing.md, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep }, tomorrowText: { ...type.label, flexShrink: 1, textAlign: "center", color: palette.onDark }, or: { ...type.caption, textAlign: "center", marginTop: spacing.sm }, confirmButton: { minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.control, borderWidth: 1, borderColor: palette.border, marginTop: spacing.sm }, confirmText: { ...type.label, textAlign: "center", color: palette.accent }, pressed: { opacity: 0.72 } });
}

