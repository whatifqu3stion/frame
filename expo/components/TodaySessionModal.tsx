import { Plus, Rows3, X } from "lucide-react-native";
import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { VideoQueue } from "@/types";

export default function TodaySessionModal({ visible, title, sessions, onClose, onPick, onCreate }: { visible: boolean; title: string; sessions: readonly VideoQueue[]; onClose: () => void; onPick: (sessionId: string) => void; onCreate: () => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close session picker" />
        <View style={styles.sheet}>
          <View style={styles.header}><View style={styles.flex}><Text style={styles.eyebrow}>Add to Session</Text><Text style={styles.title} numberOfLines={2}>{title}</Text></View><Pressable onPress={onClose} style={styles.close} accessibilityRole="button"><X size={20} color={palette.ink} /></Pressable></View>
          {sessions.map((session) => {
            const full = session.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems;
            return <Pressable key={session.id} disabled={full} onPress={() => onPick(session.id)} style={[styles.row, full && styles.disabled]} accessibilityRole="button"><Rows3 size={18} color={palette.accent} /><View style={styles.flex}><Text style={styles.rowTitle}>{session.name}</Text><Text style={styles.meta}>{session.orderedVideoIds.length} of {PRODUCT_LIMITS.sessionDraftMaxItems} videos</Text></View></Pressable>;
          })}
          <Pressable onPress={onCreate} style={styles.create} accessibilityRole="button"><Plus size={18} color={palette.onDark} /><Text style={styles.createText}>{sessions.length === 0 ? "Create Today session" : "New Today session"}</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
function createStyles(palette: FramePalette, type: FrameType) { return StyleSheet.create({ overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay }, sheet: { padding: spacing.page, paddingBottom: spacing.xl, backgroundColor: palette.surfaceHigh, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, gap: spacing.sm }, header: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }, flex: { flex: 1 }, eyebrow: { ...type.caption, color: palette.accent }, title: { ...type.heading, marginTop: spacing.xs }, close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.surface }, rowTitle: { ...type.label }, meta: { ...type.bodySoft, color: palette.inkMuted }, disabled: { opacity: 0.4 }, create: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep }, createText: { ...type.label, color: palette.onDark } }); }
