import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Check, Play } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { formatDuration } from "@/services/youtube";
import type { Video } from "@/types";

export default function SessionBuilder() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { savedVideos, watchLater, isPremium, requirePurchase } = useApp();
  const [selected, setSelected] = useState<string[]>([]);

  const pool = useMemo<Video[]>(() => {
    const videos = new Map<string, Video>();
    [...watchLater, ...savedVideos].forEach((video) => {
      if (!videos.has(video.id)) videos.set(video.id, video);
    });
    return Array.from(videos.values());
  }, [savedVideos, watchLater]);

  const totalSeconds = useMemo<number>(
    () => selected.reduce((sum, id) => sum + (pool.find((video) => video.id === id)?.durationSeconds ?? 0), 0),
    [pool, selected],
  );

  const toggle = useCallback((id: string): void => {
    if (!isPremium && !requirePurchase()) return;
    void Haptics.selectionAsync().catch(() => {});
    setSelected((previous) => {
      if (previous.includes(id)) return previous.filter((candidate) => candidate !== id);
      if (previous.length >= 3) return previous;
      return [...previous, id];
    });
  }, [isPremium, requirePurchase]);

  const begin = useCallback((): void => {
    if (selected.length === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const [first, ...rest] = selected;
    router.replace({
      pathname: "/watch/[id]",
      params: { id: first, session: [first, ...rest].join(","), i: "0" },
    });
  }, [selected]);

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>Session</Text>
      <Text style={styles.title} accessibilityRole="header">Choose a few.{"\n"}Watch. Stop.</Text>
      <Text style={styles.subtitle}>Pick up to three videos for this sitting. When the last one ends, Frame stops. No feed, no next-up.</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList<Video>
        data={pool}
        keyExtractor={(video) => video.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="Nothing to sit with yet" body="Save videos or add them to Watch Later, then build a session from them." />}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          const order = selected.indexOf(item.id) + 1;
          const isDisabled = selected.length >= 3 && !isSelected;
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              disabled={isDisabled}
              style={({ pressed }) => [styles.row, isDisabled && styles.rowDisabled, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              accessibilityLabel={`${item.title}${isSelected ? `, selection ${order}` : ""}`}
              testID={`session-pick-${item.id}`}
            >
              <View style={[styles.indexBox, isSelected && styles.indexBoxOn]}>
                {isSelected ? <Text style={styles.indexText}>{order}</Text> : <Check size={14} color={palette.inkMuted} strokeWidth={1.6} />}
              </View>
              <View style={styles.flex}>
                <Text style={type.caption} numberOfLines={1}>{item.channelTitle || "YouTube"}</Text>
                <Text style={[styles.rowTitle, isSelected && styles.selectedTitle]} numberOfLines={2}>{item.title}</Text>
              </View>
              <Text style={styles.duration}>{formatDuration(item.durationSeconds)}</Text>
            </Pressable>
          );
        }}
        contentContainerStyle={[styles.content, { paddingBottom: selected.length > 0 ? insets.bottom + 132 : insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
      />

      {selected.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.flex}>
            <Text style={type.caption}>{selected.length} video{selected.length === 1 ? "" : "s"}</Text>
            <Text style={styles.total}>{formatDuration(totalSeconds)} total</Text>
          </View>
          <Pressable onPress={begin} style={({ pressed }) => [styles.beginBtn, pressed && styles.pressed]} accessibilityRole="button" testID="begin-session">
            <Play size={16} color={palette.onDark} strokeWidth={1.8} fill={palette.onDark} />
            <Text style={styles.beginText}>Begin</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.wall },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg },
  header: { paddingBottom: spacing.xl },
  eyebrow: { ...type.caption, color: palette.accent },
  title: { ...type.title, marginTop: spacing.xs },
  subtitle: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 320 },
  flex: { flex: 1 },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSoft },
  indexBox: { width: 34, height: 34, borderRadius: radii.control, backgroundColor: palette.surface, justifyContent: "center", alignItems: "center" },
  indexBoxOn: { backgroundColor: palette.accentDeep },
  indexText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
  rowDisabled: { opacity: 0.45 },
  rowTitle: { ...type.heading, fontSize: 16, lineHeight: 20, marginTop: 2 },
  selectedTitle: { color: palette.accent },
  duration: { ...type.caption, color: palette.inkMuted },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: palette.surfaceHigh, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  total: { ...type.heading, marginTop: 2 },
  beginBtn: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.accentDeep, paddingHorizontal: spacing.xl, justifyContent: "center", borderRadius: radii.control },
  beginText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
