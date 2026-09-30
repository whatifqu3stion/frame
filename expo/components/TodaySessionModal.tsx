import TextField from "@/components/TextField";
import { Plus, Rows3, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Sheet from "@/components/Sheet";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { VideoQueue } from "@/types";

type Props = { visible: boolean; title: string; videoId: string; busy: boolean; nestedRoute?: boolean; sessions: readonly VideoQueue[]; onClose: () => void; onPick: (sessionId: string) => void; onCreate: (name: string) => void };
export default function TodaySessionModal({ visible, title, videoId, busy, sessions, onClose, onPick, onCreate, nestedRoute = false }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [name, setName] = useState("");
  useEffect(() => { if (!visible) setName(""); }, [visible]);
  const defaultName = `Session ${sessions.length + 1}`;
  return (
    <Sheet nestedRoute={nestedRoute} visible={visible} onClose={() => { if (!busy) onClose(); }} contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.flex}><Text style={type.heading} accessibilityRole="header">Add to session</Text><Text style={styles.meta}>{title}</Text></View>
        <Pressable disabled={busy} onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close session picker" accessibilityState={{ disabled: busy }}><X size={20} color={palette.ink} /></Pressable>
      </View>
      {sessions.map((session) => {
        const included = session.orderedVideoIds.includes(videoId);
        const full = session.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems;
        const disabled = busy || full || included;
        return <Pressable key={session.id} disabled={disabled} onPress={() => onPick(session.id)} style={[styles.row, disabled && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled }}><Rows3 size={18} color={palette.accent} /><View style={styles.flex}><Text style={type.label}>{session.name}</Text><Text style={styles.meta}>{included ? "Already in this session" : full ? "Full · choose another session" : `${session.orderedVideoIds.length} of ${PRODUCT_LIMITS.sessionDraftMaxItems} videos`}</Text></View></Pressable>;
      })}
      <Text style={styles.label}>New session name</Text>
      <TextField value={name} onChangeText={setName} editable={!busy} placeholder={defaultName} placeholderTextColor={palette.inkMuted} maxLength={64} returnKeyType="done" accessibilityLabel="New session name" />
      <Pressable disabled={busy} onPress={() => onCreate(name.trim() || defaultName)} style={[styles.create, busy && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}>
        {busy ? <ActivityIndicator color={palette.onDark} /> : <Plus size={18} color={palette.onDark} />}<Text style={styles.createText}>{busy ? "Adding…" : "Create and add video"}</Text>
      </Pressable>
    </Sheet>
  );
}
function createStyles(palette: FramePalette, type: FrameType) { return StyleSheet.create({ content: { gap: spacing.sm }, header: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }, flex: { flex: 1 }, close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.control, backgroundColor: palette.surface }, meta: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.xs }, disabled: { opacity: 0.5 }, label: { ...type.label, marginTop: spacing.md }, create: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep }, createText: { ...type.label, color: palette.onDark, flexShrink: 1 } }); }
