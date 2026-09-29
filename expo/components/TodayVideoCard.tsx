import MediaMount from "@/components/MediaMount";
import Image from "@/components/MediaImage";
import { Bookmark, MoreHorizontal, Play, Rows3 } from "lucide-react-native";
import { memo, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { formatDuration, formatRelativeDate } from "@/services/youtube";
import type { TodaySnapshotItem } from "@/models/today";

function TodayVideoCard({ item, busy, disabled = false, onWatch, onSave, onSession, onMore }: { item: TodaySnapshotItem; busy: boolean; disabled?: boolean; onWatch: () => void; onSave: () => void; onSession: () => void; onMore: () => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const detail = [formatRelativeDate(item.publishedAt), formatDuration(item.durationSeconds)].filter(Boolean).join(" · ");
  return (
    <View style={styles.card} testID={`today-card-${item.id}`}>
      <Pressable onPress={onWatch} disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy, busy }} style={({ pressed }) => [styles.media, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Watch ${item.title} by ${item.sourceTitle}`}>
        <MediaMount><View style={styles.thumbnailWrap}>
          <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} contentFit="cover" cachePolicy="none" transition={140} />
          <View style={styles.duration}><Text style={styles.durationText}>{formatDuration(item.durationSeconds)}</Text></View>
        </View></MediaMount>
        <Text style={styles.source} numberOfLines={1}>{item.sourceTitle}</Text>
        <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </Pressable>
      {busy ? <View style={styles.progress} accessibilityLiveRegion="polite"><ActivityIndicator size="small" color={palette.accent} /><Text style={styles.quickText}>Working…</Text></View> : null}
      <View style={styles.actions}>
        <Pressable onPress={onWatch} disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy, busy }} style={({ pressed }) => [styles.watch, pressed && styles.pressed]} accessibilityRole="button"><Play size={16} color={palette.onDark} fill={palette.onDark} /><Text style={styles.watchText}>Watch</Text></Pressable>
        <Pressable onPress={onSave} disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy, busy }} style={({ pressed }) => [styles.quick, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Save ${item.title}`}><Bookmark size={17} color={palette.accent} /><Text style={styles.quickText}>Save</Text></Pressable>
        <Pressable onPress={onSession} disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy, busy }} style={({ pressed }) => [styles.quick, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Add ${item.title} to a session`}><Rows3 size={17} color={palette.accent} /><Text style={styles.quickText}>Session</Text></Pressable>
        <Pressable onPress={onMore} disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy, busy }} style={({ pressed }) => [styles.more, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`More actions for ${item.title}`}><MoreHorizontal size={20} color={palette.inkMuted} /></Pressable>
      </View>
    </View>
  );
}
function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({ card: { marginBottom: spacing.xl, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, media: { padding: 0 }, thumbnailWrap: { aspectRatio: 16 / 9, overflow: "hidden", borderRadius: radii.media, backgroundColor: palette.surfaceDeep }, thumbnail: { width: "100%", height: "100%" }, duration: { position: "absolute", right: spacing.sm, bottom: spacing.sm, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(20,18,16,0.82)" }, durationText: { color: "#F7F1E7", fontSize: 12, fontFamily: "HankenGrotesk_600SemiBold" }, source: { ...type.caption, marginTop: spacing.md }, title: { ...type.heading, fontSize: 22, lineHeight: 29, marginTop: spacing.xs }, detail: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.xs }, progress: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }, actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, paddingHorizontal: 0, marginTop: spacing.md }, watch: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.control, backgroundColor: palette.accentDeep }, watchText: { ...type.label, color: palette.onDark }, quick: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: spacing.sm, borderRadius: radii.control, backgroundColor: palette.activeSoft }, quickText: { ...type.label, color: palette.accent }, more: { marginLeft: "auto", width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.control }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] } });
}
export default memo(TodayVideoCard);

