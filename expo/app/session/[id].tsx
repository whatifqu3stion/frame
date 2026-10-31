import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import ProgrammeArtwork from "@/components/ProgrammeArtwork";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
import { motion } from "@/constants/motion";
import Heading from "@/components/Heading";
import { readSessionRun, resetSessionRun } from "@/db/database";
import { sessionTimeRemaining } from "@/domain/sessionTimer";
import { useFocusEffect } from "@react-navigation/native";
import { boundedCollection } from "@/constants/layout";
import MediaImage from "@/components/MediaImage";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useFeedback } from "@/hooks/useFeedback";
import { skipToken, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Copy, Pencil, Play, Trash2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VideoDetailsRecovery from "@/components/VideoDetailsRecovery";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import EmptyState from "@/components/EmptyState";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { todayRepository } from "@/repositories/todayRepository";
import { expireVideo, isMetadataCurrent } from "@/domain/metadataRetention";
import { sessionPosition, sessionRuntime } from "@/domain/sessionFlow";
import { formatDuration } from "@/services/youtube";
import type { Video } from "@/types";

export default function SavedSessionScreen() {
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [timingOpen, setTimingOpen] = useState(false);
  const { id, assembled } = useLocalSearchParams<{ id: string; assembled?: string }>();
  const { activeProfileId, sessions, savedVideos, duplicateSession, removeSession, updateSessionPosition, requirePurchase, libraryError, refreshLibrary } = useApp();
  const { busy, run, capture } = useScreenAction(`${activeProfileId}:${id}`);
  const session = useMemo(() => sessions.find((candidate) => candidate.id === id), [id, sessions]);
  const todayVideosQuery = useQuery({
    queryKey: ["session-today-media", activeProfileId, session?.orderedVideoIds.join(",") ?? ""], networkMode: "always",
    queryFn: async () => Promise.all((session?.orderedVideoIds ?? []).map((videoId) => todayRepository.getVideo(activeProfileId, videoId))),
    enabled: Boolean(session),
  });
  const recovered = useQuery<Record<string, Video>>({ queryKey: ["recovered-library", activeProfileId], queryFn: skipToken, enabled: false });
  const videoMap = useMemo<Map<string, Video>>(() => {
    const map = new Map<string, Video>();
    [...(todayVideosQuery.data ?? []).filter((video): video is Video => Boolean(video)), ...savedVideos, ...Object.values(recovered.data ?? {})].forEach((video) => {
      if ((video.fetchedAt ?? 0) >= (map.get(video.id)?.fetchedAt ?? 0)) map.set(video.id, expireVideo(video, Date.now()));
    });
    return map;
  }, [savedVideos, todayVideosQuery.data, recovered.data]);
  const timerQuery = useQuery({ queryKey: ["session-run", activeProfileId, id], queryFn: () => readSessionRun(activeProfileId, String(id)), enabled: Boolean(session), networkMode: "always" });
  const refreshTimer = timerQuery.refetch;
  useFocusEffect(useCallback(() => { void refreshTimer(); }, [refreshTimer]));
  const timeComplete = Boolean(timerQuery.data && (timerQuery.data.ended || (session?.targetMinutes && sessionTimeRemaining(timerQuery.data, session.targetMinutes) === 0)));
  const finishingCurrent = Boolean(timerQuery.data?.finishVideoId && !timerQuery.data.ended && session?.orderedVideoIds[sessionPosition(session)] === timerQuery.data.finishVideoId);
  const position = session ? sessionPosition(session) : 0;
  const runtime = sessionRuntime(session?.orderedVideoIds ?? [], [...videoMap.values()]);

  const startAt = useCallback(async (index: number): Promise<void> => {
    if (!session || !requirePurchase("sessions")) return;
    if (!session.targetMinutes) { router.push({ pathname: "/session", params: { id: session.id } }); return; }
    const videoId = session.orderedVideoIds[index];
    if (!videoId) return;
    const done = feedback.capture();
    await run(async () => {
      const usage = await readSessionRun(activeProfileId, session.id);
      if (usage.ended || (sessionTimeRemaining(usage, session.targetMinutes!) === 0 && usage.finishVideoId !== videoId) || position >= session.orderedVideoIds.length) await resetSessionRun(activeProfileId, session.id);
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
  }, [activeProfileId, feedback, requirePurchase, session, updateSessionPosition, videoMap, run, position]);

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
    Alert.alert("Delete session?", `“${session.name}” will be removed. Your saved videos will remain in Saved.`, [
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
    <ScrollView style={styles.screen} contentContainerStyle={[boundedCollection, { padding: spacing.page, paddingLeft: spacing.page + insets.left, paddingRight: spacing.page + insets.right, paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
      <MotionView enter={assembled === "1"} onPresented={() => { if (assembled === "1") router.setParams({ assembled: undefined }); }} duration={motion.state} style={styles.programme}>
      <ProgrammeGrain />
      <ProgrammeArtwork videos={session.orderedVideoIds.map((videoId) => videoMap.get(videoId))} enter={assembled === "1"} editorial />
      <Heading level={1} style={styles.title}>{session.name}</Heading>
      <Text style={styles.subtitle}>{session.orderedVideoIds.length} {session.orderedVideoIds.length === 1 ? "video" : "videos"} · {runtime.seconds ? `${runtime.unknown ? "at least " : ""}${Math.ceil(runtime.seconds / 60)} min in queue` : "duration unavailable"}{runtime.seconds > 0 && runtime.unknown ? " · some durations unavailable" : ""}</Text>
      {position > 0 ? <Text style={styles.subtitle}>{position >= session.orderedVideoIds.length ? "Queue complete" : `Up next · Video ${position + 1} of ${session.orderedVideoIds.length}`}</Text> : null}
      {session.orderedVideoIds.length > 0 ? (
        <View style={styles.startRow}>
          {session.targetMinutes ? <View style={styles.timeCopy}>
            <Pressable onPress={() => setTimingOpen(!timingOpen)} style={styles.timingToggle} accessibilityRole="button" accessibilityLabel={`Viewing time: ${session.targetMinutes} minutes. How session timing works`} accessibilityState={{ expanded: timingOpen }} testID="session-timing-help">
              <Text style={styles.timeLabel}>{session.targetMinutes} min viewing</Text>
              <DisclosureIndicator expanded={timingOpen} color={palette.onProgrammeSoft} />
            </Pressable>
            {timeComplete || timerQuery.data?.consumedSeconds ? <Text style={styles.timeStatus}>{timeComplete ? "Time complete" : `${Math.ceil(sessionTimeRemaining(timerQuery.data!, session.targetMinutes) / 60)} min left`}</Text> : null}
          </View> : null}
        <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => { void startAt(position < session.orderedVideoIds.length ? position : 0); }} style={({ pressed }) => [styles.beginButton, (pressed || busy) && styles.pressed]} accessibilityRole="button" testID="begin-saved-session">
          <Play size={17} color={palette.programme} fill={palette.programme} />
          <Text style={styles.beginText}>{busy ? "Working…" : !session.targetMinutes ? "Choose duration" : finishingCurrent ? "Finish current video" : timeComplete || position >= session.orderedVideoIds.length ? "Start a new timed session" : position > 0 ? `Continue with video ${position + 1}` : "Start session"}</Text>
        </Pressable>
        </View>
      ) : null}
      {timingOpen && session.targetMinutes ? <MotionView enter distance={-6}><Text style={styles.timingNote}>Only playback counts toward your {session.targetMinutes} minutes. Frame pauses when your time is up; you can finish the current video. Profile limits still apply.</Text></MotionView> : null}
      </MotionView>
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
          <EmptyState title="This session is empty" body={`Edit it to add videos and choose a duration.`} />
        ) : session.orderedVideoIds.map((videoId, index) => {
          const video = videoMap.get(videoId);
          return (
            <View key={videoId}><View style={styles.row}>
              <View style={styles.orderMark}><Text style={styles.orderText}>{index + 1}</Text></View>
              <Pressable disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => { void startAt(index); }} style={styles.videoMain} accessibilityRole="button" accessibilityLabel={`Start with ${video?.title ?? `video ${index + 1}`}`} >
                <MediaImage source={video?.thumbnailUrl ? { uri: video.thumbnailUrl } : null} style={styles.thumbnail} contentFit="cover" cachePolicy="none" />
                <View style={styles.videoCopy}><Text style={styles.channel} numberOfLines={1}>{video?.channelTitle || "Saved source"}</Text>
                <Text style={styles.videoTitle}>{video?.title || "Video details unavailable"}{index === position ? " · Up next" : ""}</Text>
                <Text style={styles.duration}>{video?.durationSeconds ? formatDuration(video.durationSeconds) : "Duration unavailable · internet required"}</Text></View>
              </Pressable>

            </View>
            <VideoDetailsRecovery key={`${activeProfileId}:${videoId}`} videoId={videoId} expired={!isMetadataCurrent(video?.fetchedAt, Date.now())} />
            </View>
          );
        })}
      </View>


    </ScrollView>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: "transparent" },
    missing: { flex: 1, backgroundColor: "transparent", justifyContent: "center", padding: spacing.page },
    programme: { padding: spacing.lg, backgroundColor: palette.programme, borderRadius: radii.card },
    title: { ...type.title, fontSize: 26, lineHeight: 33, color: palette.onProgramme },
    subtitle: { ...type.bodySoft, marginTop: spacing.xs, color: palette.onProgrammeSoft },
    startRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.programmeRule },
    timeCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 120 },
    timingToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.xs },
    timeLabel: { ...type.label, color: palette.onProgramme, flexShrink: 1 },
    timeStatus: { ...type.caption, color: palette.onProgrammeSoft },
    timingNote: { ...type.bodySoft, color: palette.onProgrammeSoft, marginTop: spacing.md },
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
    beginButton: { minHeight: 48, flexGrow: 1, flexBasis: 144, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, backgroundColor: palette.onProgramme, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    beginText: { ...type.label, color: palette.programme, flexShrink: 1, textAlign: "center" },
    stopNote: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
    secondaryButton: { minHeight: 48, marginTop: spacing.lg, alignItems: "center", justifyContent: "center" },
    secondaryText: { ...type.label, color: palette.accent },
    pressed: { opacity: 0.72 },
  });
}
