import MotionView from "@/components/motion/MotionView";
import { Pressable, StyleSheet, Text } from "react-native";
import { X } from "lucide-react-native";
import { spacing, radii, watchPalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function SavedRemovalNotice({ targetId, title, busy, onUndo, onDismiss, dark = false }: { targetId: string; title: string; busy: boolean; onUndo(): void; onDismiss(): void; dark?: boolean }) {
  const { palette, type } = useFrameTheme();
  const color = dark ? watchPalette.ink : palette.ink;
  return <MotionView enter changeKey={targetId} style={[styles.notice, { backgroundColor: dark ? watchPalette.surface : palette.surfaceHigh, borderColor: dark ? watchPalette.border : palette.border }]} accessibilityLiveRegion="polite">
    <Text style={[type.bodySoft, styles.message, { color }]} numberOfLines={2}>Removed from Saved: {title}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Undo removal of ${title}`} accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onUndo} style={styles.action}><Text style={[type.label, { color }]}>{busy ? "Restoring…" : "Undo"}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss removal message" disabled={busy} onPress={onDismiss} style={styles.close}><X size={18} color={color} /></Pressable>
  </MotionView>;
}
const styles = StyleSheet.create({ notice: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.control }, message: { flexGrow: 1, flexShrink: 1, flexBasis: 150 }, action: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm }, close: { width: 48, height: 48, justifyContent: "center", alignItems: "center" } });
