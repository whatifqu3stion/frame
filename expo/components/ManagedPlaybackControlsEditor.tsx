import { PauseCircle } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import ClockTimePicker from "@/components/ClockTimePicker";
import { scheduleSummary } from "@/domain/scheduleSummary";
import { INDEFINITE_PAUSE, MAX_SESSION_LIMIT_MINUTES, MAX_SESSION_BREAK_MINUTES } from "@/domain/playbackControls";
import type { ClockWindow, ManagedPlaybackControls } from "@/models/playbackControls";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = { value: ManagedPlaybackControls; onChange: (value: ManagedPlaybackControls) => void; onValidityChange?: (valid: boolean) => void };

export default function ManagedPlaybackControlsEditor({ value, onChange, onValidityChange }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [invalidTimes, setInvalidTimes] = useState<Record<string, boolean>>({});
  const updateValidity = (key: string, valid: boolean): void => {
    const next = { ...invalidTimes, [key]: !valid };
    setInvalidTimes(next);
    onValidityChange?.(!Object.values(next).some(Boolean));
  };
  const setWindow = (key: "allowedWindow" | "quietHours", enabled: boolean, fallback: ClockWindow): void => {
    const next = { ...invalidTimes, [`${key}.startMinute`]: false, [`${key}.endMinute`]: false };
    setInvalidTimes(next); onValidityChange?.(!Object.values(next).some(Boolean));
    onChange({ ...value, [key]: enabled ? value[key] ?? fallback : null });
  };
  const setMinute = (key: "allowedWindow" | "quietHours", side: "startMinute" | "endMinute", minute: number): void => {
    const current = value[key];
    if (current) onChange({ ...value, [key]: { ...current, [side]: minute } });
  };
  const updateNumber = (text: string, key: "sessionLimitMinutes" | "sessionBreakMinutes"): void => {
    const number = Number(text.replace(/\D/g, ""));
    onChange({ ...value, [key]: number });
  };
  const pauseLabel = value.pausedUntil === INDEFINITE_PAUSE ? "Paused until resumed" : value.pausedUntil && value.pausedUntil > Date.now() ? `Paused until ${new Date(value.pausedUntil).toLocaleString()}` : "Not paused";
  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>These limits apply only inside Frame. Device time changes can affect schedules.</Text>
      <ControlSection title="Viewing window" body="Allow playback only during one daily window." enabled={Boolean(value.allowedWindow)} onToggle={(enabled) => setWindow("allowedWindow", enabled, { startMinute: 7 * 60, endMinute: 20 * 60 })} styles={styles}>
        {value.allowedWindow ? <View style={styles.timeRow}><ClockTimePicker label="Starts" minuteOfDay={value.allowedWindow.startMinute} onChange={(minute: number) => setMinute("allowedWindow", "startMinute", minute)} onValidityChange={(valid) => updateValidity("allowedWindow.startMinute", valid)} /><ClockTimePicker label="Ends" minuteOfDay={value.allowedWindow.endMinute} onChange={(minute: number) => setMinute("allowedWindow", "endMinute", minute)} onValidityChange={(valid) => updateValidity("allowedWindow.endMinute", valid)} /></View> : null}
      </ControlSection>
      <ControlSection title="Quiet hours" body="Block playback during a daily rest period, including overnight." enabled={Boolean(value.quietHours)} onToggle={(enabled) => setWindow("quietHours", enabled, { startMinute: 21 * 60, endMinute: 7 * 60 })} styles={styles}>
        {value.quietHours ? <View style={styles.timeRow}><ClockTimePicker label="Starts" minuteOfDay={value.quietHours.startMinute} onChange={(minute: number) => setMinute("quietHours", "startMinute", minute)} onValidityChange={(valid) => updateValidity("quietHours.startMinute", valid)} /><ClockTimePicker label="Ends" minuteOfDay={value.quietHours.endMinute} onChange={(minute: number) => setMinute("quietHours", "endMinute", minute)} onValidityChange={(valid) => updateValidity("quietHours.endMinute", valid)} /></View> : null}
      </ControlSection>
      <ControlSection title="Continuous playback limit" body="Require a break after continuous playback." enabled={value.sessionLimitMinutes !== null} onToggle={(enabled) => onChange({ ...value, sessionLimitMinutes: enabled ? value.sessionLimitMinutes ?? 30 : null })} styles={styles}>
        {value.sessionLimitMinutes !== null ? <View style={styles.numberRow}><NumberField label={`Playback minutes (1–${MAX_SESSION_LIMIT_MINUTES})`} value={value.sessionLimitMinutes} onChange={(text) => updateNumber(text, "sessionLimitMinutes")} styles={styles} /><NumberField label={`Break minutes (1–${MAX_SESSION_BREAK_MINUTES})`} value={value.sessionBreakMinutes} onChange={(text) => updateNumber(text, "sessionBreakMinutes")} styles={styles} /></View> : null}
      </ControlSection>
      <Text style={styles.title} accessibilityRole="header">Schedule summary</Text>
      <Text style={styles.body} accessibilityLiveRegion="polite">{scheduleSummary(value)}</Text>
      <View style={styles.pauseCard}>
        <PauseCircle size={19} color={palette.active} /><View style={styles.flex}><Text style={styles.title}>Pause Frame</Text><Text style={styles.body}>{pauseLabel}</Text></View>
      </View>
      <View style={styles.pauseActions}>
        <PauseButton label="1 hour" onPress={() => onChange({ ...value, pausedUntil: Date.now() + 60 * 60_000 })} styles={styles} />
        <PauseButton label="Until tomorrow" onPress={() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(7, 0, 0, 0); onChange({ ...value, pausedUntil: tomorrow.getTime() }); }} styles={styles} />
        <PauseButton label="Until resumed" onPress={() => onChange({ ...value, pausedUntil: INDEFINITE_PAUSE })} styles={styles} />
        {value.pausedUntil !== null ? <PauseButton label="Resume now" onPress={() => onChange({ ...value, pausedUntil: null })} styles={styles} /> : null}
      </View>
    </View>
  );
}

function ControlSection({ title, body, enabled, onToggle, styles, children }: { title: string; body: string; enabled: boolean; onToggle: (enabled: boolean) => void; styles: ReturnType<typeof createStyles>; children?: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text></View><Switch value={enabled} onValueChange={onToggle} accessibilityLabel={`${title} ${enabled ? "on" : "off"}`} /></View>{children}</View>;
}
function NumberField({ label, value, onChange, styles }: { label: string; value: number; onChange: (text: string) => void; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.flex}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={String(value)} onChangeText={onChange} keyboardType="number-pad" maxLength={3} style={styles.numberInput} accessibilityLabel={label} /></View>;
}
function PauseButton({ label, onPress, styles }: { label: string; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  return <Pressable onPress={onPress} style={styles.pauseButton} accessibilityRole="button"><Text style={styles.pauseButtonText}>{label}</Text></Pressable>;
}
function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    wrap: { gap: spacing.md }, intro: { ...type.bodySoft, color: palette.inkMuted },
    section: { gap: spacing.md, padding: spacing.md, borderRadius: radii.control, backgroundColor: palette.surfaceDeep },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md }, flex: { flex: 1 }, title: { ...type.label, color: palette.ink }, body: { ...type.bodySoft, color: palette.inkMuted },
    timeRow: { gap: spacing.md }, numberRow: { gap: spacing.md }, fieldLabel: { ...type.caption, color: palette.inkMuted },
    numberInput: { minHeight: 48, marginTop: 6, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.surface, color: palette.ink, textAlign: "center" },
    pauseCard: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.control, backgroundColor: palette.activeSoft },
    pauseActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, pauseButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.surfaceDeep }, pauseButtonText: { ...type.label, color: palette.active },
  });
}

