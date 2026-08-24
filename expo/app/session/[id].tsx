import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronDown, ChevronUp, Copy, Pencil, Play, Trash2, X } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { formatDuration } from "@/services/youtube";
import type { Video } from "@/types";

export default function SavedSessionScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, savedVideos, watchLater, duplicateSession, removeSession, updateSessionVideos, requirePurchase } = useApp();
  const session = useMemo(() => sessions.find((candidate) => candidate.id === id), [id, sessions]);
  const videoMap = useMemo<Map<string, Video>>(() => {
    const map = new Map<string, Video>();
    [...watchLater, ...savedVideos].forEach((video) => map.set(video.id, video));
    return map;
  }, [savedVideos, watchLater]);
  const totalSeconds = session?.orderedVideoIds.reduce((sum, videoId) => sum + (videoMap.get(videoId)?.durationSeconds ?? 0), 0) ?? 0;

  const startAt = useCallback((index: number): void => {
    if (!session || !requirePurchase("sessions")) return;
    const videoId = session.orderedVideoIds[index];
    if (!videoMap.has(videoId)) {
      Alert.alert("Video unavailable", "This saved item is no longer in your local library. Remove it or add the video again.");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({
      pathname: "/watch/[id]",
      params: { id: videoId, session: session.orderedVideoIds.join(","), i: String(index), savedSessionId: session.id },
    });
  }, [requirePurchase, session, videoMap]);

  const move = useCallback(async (index: number, direction: -1 | 1): Promise<void> => {
    if (!session || !requirePurchase("sessions")) return;
    const target = index + direction;
    if (target < 0 || target >= session.orderedVideoIds.length) return;
    const next = [...session.orderedVideoIds];
    [next[index], next[target]] = [next[target], next[index]];
    await updateSessionVideos(session.id, next);
    void Haptics.selectionAsync().catch(() => {});
  }, [requirePurchase, session, updateSessionVideos]);

  const removeVideo = useCallback(async (videoId: string): Promise<void> => {
    if (!session || !requirePurchase("sessions")) return;
    await updateSessionVideos(session.id, session.orderedVideoIds.filter((candidate) => candidate !== videoId));
  }, [requirePurchase, session, updateSessionVideos]);

  const duplicate = useCallback(async (): Promise<void> => {
    if (!session || !requirePurchase("sessions")) return;
    const copy = await duplicateSession(session.id);
    if (!copy) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace({ pathname: "/session/[id]", params: { id: copy.id } });
  }, [duplicateSession, requirePurchase, session]);

  const openEditor = useCallback((): void => {
    if (!session || !requirePurchase("sessions")) return;
    router.push({ pathname: "/session", params: { id: session.id } });
  }, [requirePurchase, session]);

  const confirmDelete = useCallback((): void => {
    if (!session || !requirePurchase("sessions")) return;
    Alert.alert("Delete named session?", `“${session.name}” will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await removeSession(session.id); router.back(); } },
    ]);
  }, [removeSession, requirePurchase, session]);

  if (!session) {
    return (
      <View style={[styles.missing, { paddingBottom: insets.bottom + spacing.xl }]}>
        <EmptyState title="Session unavailable" body="It may have been deleted on this device." />
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.page, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>Named session</Text>
      <Text style={styles.title} accessibilityRole="header">{session.name}</Text>
      <Text style={styles.subtitle}>{session.orderedVideoIds.length} of 3 videos · {formatDuration(totalSeconds)} known runtime</Text>

      <View style={styles.actions}>
        <Pressable onPress={openEditor} style={styles.actionButton} accessibilityRole="button">
          <Pencil size={16} color={palette.accent} /><Text style={styles.actionText}>Edit</Text>
        </Pressable>
        <Pressable onPress={() => { void duplicate(); }} style={styles.actionButton} accessibilityRole="button">
          <Copy size={16} color={palette.accent} /><Text style={styles.actionText}>Duplicate</Text>
        </Pressable>
        <Pressable onPress={confirmDelete} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Delete named session">
          <Trash2 size={17} color={palette.danger} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {session.orderedVideoIds.length === 0 ? (
          <EmptyState title="This session is empty" body="Edit it to choose one to three videos." />
        ) : session.orderedVideoIds.map((videoId, index) => {
          const video = videoMap.get(videoId);
          return (
            <View key={videoId} style={styles.row}>
              <View style={styles.orderMark}><Text style={styles.orderText}>{index + 1}</Text></View>
              <Pressable onPress={() => startAt(index)} style={styles.videoMain} accessibilityRole="button" accessibilityLabel={video ? `Start with ${video.title}` : "Unavailable video"}>
                <Text style={styles.channel} numberOfLines={1}>{video?.channelTitle || "Unavailable"}</Text>
                <Text style={[styles.videoTitle, !video && styles.unavailable]} numberOfLines={2}>{video?.title || "Video no longer in your local library"}</Text>
                <Text style={styles.duration}>{video ? formatDuration(video.durationSeconds) : "Remove or add again"}</Text>
              </Pressable>
              <View style={styles.rowActions}>
                <Pressable onPress={() => { void move(index, -1); }} disabled={index === 0} style={[styles.smallButton, index === 0 && styles.disabled]} accessibilityLabel="Move earlier"><ChevronUp size={16} color={palette.inkMuted} /></Pressable>
                <Pressable onPress={() => { void move(index, 1); }} disabled={index === session.orderedVideoIds.length - 1} style={[styles.smallButton, index === session.orderedVideoIds.length - 1 && styles.disabled]} accessibilityLabel="Move later"><ChevronDown size={16} color={palette.inkMuted} /></Pressable>
                <Pressable onPress={() => { void removeVideo(videoId); }} style={styles.smallButton} accessibilityLabel="Remove from session"><X size={16} color={palette.danger} /></Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {session.orderedVideoIds.length > 0 ? (
        <Pressable onPress={() => startAt(0)} style={({ pressed }) => [styles.beginButton, pressed && styles.pressed]} accessibilityRole="button" testID="begin-saved-session">
          <Play size={17} color={palette.onDark} fill={palette.onDark} />
          <Text style={styles.beginText}>Begin from the start</Text>
        </Pressable>
      ) : null}
      <Text style={styles.stopNote}>Frame advances only when you choose Next, then stops after the final video.</Text>
    </ScrollView>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    missing: { flex: 1, backgroundColor: palette.wall, justifyContent: "center", padding: spacing.page },
    eyebrow: { ...type.caption, color: palette.accent },
    title: { ...type.title, marginTop: spacing.xs },
    subtitle: { ...type.bodySoft, marginTop: spacing.sm, color: palette.inkMuted },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
    actionButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.activeSoft },
    actionText: { ...type.label, color: palette.accent },
    iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.surface },
    list: { marginTop: spacing.xl, gap: spacing.md },
    row: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    orderMark: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: palette.accentDeep },
    orderText: { ...type.label, color: palette.onDark },
    videoMain: { flex: 1, minHeight: 76, justifyContent: "center" },
    channel: { ...type.caption, color: palette.inkMuted },
    videoTitle: { ...type.heading, fontSize: 15, lineHeight: 20, marginTop: 2 },
    unavailable: { color: palette.danger },
    duration: { ...type.caption, color: palette.inkMuted, marginTop: spacing.xs },
    rowActions: { gap: 2 },
    smallButton: { width: 36, height: 32, alignItems: "center", justifyContent: "center" },
    disabled: { opacity: 0.22 },
    beginButton: { minHeight: 52, marginTop: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep },
    beginText: { ...type.label, color: palette.onDark },
    stopNote: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
    secondaryButton: { minHeight: 48, marginTop: spacing.lg, alignItems: "center", justifyContent: "center" },
    secondaryText: { ...type.label, color: palette.accent },
    pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  });
}
