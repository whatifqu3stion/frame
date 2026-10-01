import MediaImage from "@/components/MediaImage";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useFeedback } from "@/hooks/useFeedback";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Copy, Pencil, Play, Trash2 } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import EmptyState from "@/components/EmptyState";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { todayRepository } from "@/repositories/todayRepository";
import { expireVideo } from "@/domain/metadataRetention";
import { sessionPosition, sessionRuntime } from "@/domain/sessionFlow";
import { formatDuration } from "@/services/youtube";
import type { Video } from "@/types";

export default function SavedSessionScreen() {
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProfileId, sessions, savedVideos, duplicateSession, removeSession, updateSessionPosition, requirePurchase, libraryError, refreshLibrary } = useApp();
  const { busy, run, capture } = useScreenAction(`${activeProfileId}:${id}`);
  const session = useMemo(() => sessions.find((candidate) => candidate.id === id), [id, sessions]);
  const todayVideosQuery = useQuery({
    queryKey: ["session-today-media", activeProfileId, session?.orderedVideoIds.join(",") ?? ""], networkMode: "always",
    queryFn: async () => Promise.all((session?.orderedVideoIds ?? []).map((videoId) => todayRepository.getVideo(activeProfileId, videoId))),
    enabled: Boolean(session),
  });
  const videoMap = useMemo<Map<string, Video>>(() => {
    const map = new Map<string, Video>();
    [...(todayVideosQuery.data ?? []).filter((video): video is Video => Boolean(video)), ...savedVideos].forEach((video) => map.set(video.id, expireVideo(video, Date.now())));
    return map;
  }, [savedVideos, todayVideosQuery.data]);
  const position = session ? sessionPosition(session) : 0;
  const runtime = sessionRuntime(session?.orderedVideoIds ?? [], [...videoMap.values()]);
  const remaining = sessionRuntime(session?.orderedVideoIds ?? [], [...videoMap.values()], position);
  const finishTime = remaining.unknown === 0 && remaining.seconds > 0 ? new Date(Date.now() + remaining.seconds * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;

  const startAt = useCallback(async (index: number): Promise<void> => {
    if (!session || !requirePurchase("sessions")) return;
    const videoId = session.orderedVideoIds[index];
    if (!videoId) return;
    const done = feedback.capture();
    await run(async () => {
      const moved = await updateSessionPosition(session.id, videoId, index, index);
      if (!moved) throw new Error("Session changed");
    }, () => {
      done("commit");
      const video = videoMap.get(videoId);
      router.push({
        pathname: FRAME_PLAYBACK_ROUTE,
        params: { id: videoId, savedSessionId: session.id, sessionProfileId: activeProfileId, title: video?.title ?? "", channelId: video?.channelId ?? "", channelTitle: video?.channelTitle ?? "", thumbnailUrl: video?.thumbnailUrl ?? "", publishedAt: video?.publishedAt ?? "", durationSeconds: String(video?.durationSeconds ?? 0), cachedMetadata: "1", fetchedAt: String(video?.fetchedAt ?? 0) },
      });
    }, () => Alert.alert("Couldn’t start session", "Check your session and try again."));
  }, [activeProfileId, feedback, requirePurchase, session, updateSessionPosition, videoMap, run]);

  const duplicate = useCallback(async (): Promise<void> => {
    if (!session || !requirePurchase("sessions")) return;
    const done = feedback.capture();
    await run(() => duplicateSession(session.id), (copy) => {
      if (!copy) return;
      done("commit");
      router.replace({ pathname: "/session/[id]", params: { id: copy.id } });
    }, () => Alert.alert("Couldn’t duplicate session", "Check your sessions in Saved before trying again."));
  }, [duplicateSession, feedback, requirePurchase, session, run]);

  const openEditor = useCallback((): void => {
    if (!session || !requirePurchase("sessions")) return;
    router.push({ pathname: "/session", params: { id: session.id } });
  }, [requirePurchase, session]);

  const confirmDelete = useCallback((): void => {
    if (!session || !requirePurchase("sessions")) return;
    const isCurrent = capture();
    Alert.alert("Delete session?", `“${session.name}” will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { if (isCurrent()) void run(() => removeSession(session.id), () => router.back(), () => Alert.alert("Couldn’t delete session", "Check your sessions in Saved before trying again.")); } },
    ]);
  }, [capture, removeSession, requirePurchase, session, run]);

  if (libraryError) return <View style={styles.missing}><EmptyState title="Sessions couldn’t load" body="Try again to open this session." action={{ label: "Try again", onPress: () => { void refreshLibrary().catch(() => Alert.alert("Library unavailable", "Close and reopen Frame to try again.")); } }} /></View>;

  if (!session) {
    return (
      <View style={[styles.missing, { paddingBottom: insets.bottom + spacing.xl }]}>
        <EmptyState title="Session unavailable" body="It may have been deleted on this device." />
        <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => router.back()} style={styles.secondaryButton} accessibilityRole="button"><Text style={styles.secondaryText}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.page, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
      <View style={styles.programme}>
      <ProgrammeGrain />
      <Text style={styles.title} accessibilityRole="header">{session.name}</Text>
      <Text style={styles.subtitle}>{session.orderedVideoIds.length} of {PRODUCT_LIMITS.sessionDraftMaxItems} videos · {runtime.seconds ? `${runtime.unknown ? "At least " : ""}${formatDuration(runtime.seconds)}` : "Duration unavailable"}{runtime.seconds > 0 && runtime.unknown ? " · some durations unavailable" : ""}</Text>
      <Text style={styles.subtitle}>{session.orderedVideoIds.length === 0 ? "Add a video when you're ready." : position >= session.orderedVideoIds.length ? "Session complete. You can watch it again below." : `Next: ${position + 1} of ${session.orderedVideoIds.length} · ${remaining.seconds ? `${remaining.unknown ? "At least " : ""}${formatDuration(remaining.seconds)} of video` : "Duration unavailable"}${finishTime ? ` · Ends around ${finishTime} without breaks` : ""}`}</Text>

      {session.orderedVideoIds.length > 0 ? (
        <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => { void startAt(position < session.orderedVideoIds.length ? position : 0); }} style={({ pressed }) => [styles.beginButton, pressed && styles.pressed]} accessibilityRole="button" testID="begin-saved-session">
          <Play size={17} color={palette.programme} fill={palette.programme} />
          <Text style={styles.beginText}>{busy ? "Working…" : position >= session.orderedVideoIds.length ? "Watch again" : position > 0 ? `Continue with video ${position + 1}` : "Start session"}</Text>
        </Pressable>
      ) : null}

      </View>
      <View style={styles.actions}>
        <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={openEditor} style={styles.actionButton} accessibilityRole="button">
          <Pencil size={16} color={palette.accent} /><Text style={styles.actionText}>Edit</Text>
        </Pressable>
        <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => { void duplicate(); }} style={styles.actionButton} accessibilityRole="button">
          <Copy size={16} color={palette.accent} /><Text style={styles.actionText}>Duplicate</Text>
        </Pressable>
        <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={confirmDelete} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Delete session">
          <Trash2 size={17} color={palette.danger} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {session.orderedVideoIds.length === 0 ? (
          <EmptyState title="This session is empty" body={`Edit it to choose one to ${PRODUCT_LIMITS.sessionDraftMaxItems} videos.`} />
        ) : session.orderedVideoIds.map((videoId, index) => {
          const video = videoMap.get(videoId);
          return (
            <View key={videoId} style={styles.row}>
              <View style={styles.orderMark}><Text style={styles.orderText}>{index + 1}</Text></View>
              <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => { void startAt(index); }} style={styles.videoMain} accessibilityRole="button" accessibilityLabel={`Start with ${video?.title ?? `video ${index + 1}`}`} >
                <MediaImage source={video?.thumbnailUrl ? { uri: video.thumbnailUrl } : null} style={styles.thumbnail} contentFit="cover" cachePolicy="none" />
                <View style={styles.videoCopy}><Text style={styles.channel} numberOfLines={1}>{video?.channelTitle || "Saved source"}</Text>
                <Text style={styles.videoTitle}>{video?.title || "Video details unavailable"}{index === position ? " · Up next" : ""}</Text>
                <Text style={styles.duration}>{video?.durationSeconds ? formatDuration(video.durationSeconds) : "Duration unavailable · internet required"}</Text></View>
              </Pressable>

            </View>
          );
        })}
      </View>

      <Text style={styles.stopNote}>You choose when to play each video. After the last one, the session ends.</Text>
    </ScrollView>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    missing: { flex: 1, backgroundColor: palette.wall, justifyContent: "center", padding: spacing.page },
    programme: { padding: spacing.lg, backgroundColor: palette.programme, borderRadius: radii.card },
    title: { ...type.title, color: palette.onProgramme },
    subtitle: { ...type.bodySoft, marginTop: spacing.sm, color: palette.onProgrammeSoft },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
    actionButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.activeSoft },
    actionText: { ...type.label, color: palette.accent },
    iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.surface },
    list: { marginTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
    row: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
    orderMark: { minWidth: 32, alignItems: "flex-start", justifyContent: "center" },
    orderText: { ...type.heading, color: palette.inkMuted, fontSize: 24, fontVariant: ["tabular-nums"] },
    videoMain: { flex: 1, minHeight: 76, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }, thumbnail: { width: 80, aspectRatio: 16 / 9, borderRadius: radii.media }, videoCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 130 },
    channel: { ...type.caption, color: palette.inkMuted },
    videoTitle: { ...type.heading, fontSize: 20, lineHeight: 27, marginTop: 2 },
    unavailable: { color: palette.danger },
    duration: { ...type.caption, color: palette.inkMuted, marginTop: spacing.xs },
    rowActions: { gap: spacing.xs },
    smallButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.control },
    disabled: { opacity: 0.22 },
    beginButton: { minHeight: 52, marginTop: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, backgroundColor: palette.onProgramme, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    beginText: { ...type.label, color: palette.programme, flexShrink: 1, textAlign: "center" },
    stopNote: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
    secondaryButton: { minHeight: 48, marginTop: spacing.lg, alignItems: "center", justifyContent: "center" },
    secondaryText: { ...type.label, color: palette.accent },
    pressed: { opacity: 0.72 },
  });
}
