import { BlurView } from "expo-blur";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { Bookmark, ChevronLeft, ChevronRight, Clock, ExternalLink, RotateCcw } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import YouTubePlayer from "@/components/YouTubePlayer";
import type { YouTubePlaybackState, YouTubePlayerError, YouTubePlayerHandle } from "@/components/YouTubePlayer.types";
import { SAMPLE_VIDEOS } from "@/constants/sampleData";
import { palette, spacing, type } from "@/constants/theme";
import { getResume } from "@/db/database";
import { useApp } from "@/providers/AppProvider";
import { formatDuration, formatRelativeDate } from "@/services/youtube";
import type { Video } from "@/types";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const PLAYER_TIMEOUT_MS = 18000;
const RESUME_WRITE_INTERVAL_MS = 15000;
const KEEP_AWAKE_TAG = "frame-video-playback";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalText(value: string | undefined): string {
  return value?.trim() ?? "";
}

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{
    id: string | string[];
    session?: string | string[];
    i?: string | string[];
    title?: string | string[];
    channelId?: string | string[];
    channelTitle?: string | string[];
    thumbnailUrl?: string | string[];
    publishedAt?: string | string[];
    durationSeconds?: string | string[];
  }>();
  const id = firstParam(params.id) ?? "";
  const session = firstParam(params.session);
  const indexParam = firstParam(params.i);
  const {
    savedVideos,
    watchLater,
    saveVideo,
    unsaveVideo,
    addToWatchLater,
    removeFromWatchLater,
    isInWatchLater,
    requirePurchase,
    isPremium,
    recordResume,
    clearVideoResume,
  } = useApp();

  const sessionIds = useMemo<string[]>(
    () => (session ?? "").split(",").filter((candidate) => VIDEO_ID_PATTERN.test(candidate)).slice(0, 3),
    [session],
  );
  const sessionIndex = useMemo<number>(() => {
    const requestedIndex = Number(indexParam ?? 0);
    const validIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < sessionIds.length
      ? requestedIndex
      : sessionIds.indexOf(id);
    return Math.max(0, validIndex);
  }, [id, indexParam, sessionIds]);
  const nextSessionId = sessionIds[sessionIndex + 1];
  const isSession = sessionIds.length > 0;

  const video = useMemo<Video | undefined>(() => {
    const stored = savedVideos.find((candidate) => candidate.id === id)
      ?? watchLater.find((candidate) => candidate.id === id)
      ?? SAMPLE_VIDEOS.find((candidate) => candidate.id === id);
    if (stored) return stored;
    if (!VIDEO_ID_PATTERN.test(id)) return undefined;

    const routeDuration = Number(firstParam(params.durationSeconds) ?? 0);
    return {
      id,
      title: optionalText(firstParam(params.title)) || "YouTube video",
      channelId: optionalText(firstParam(params.channelId)),
      channelTitle: optionalText(firstParam(params.channelTitle)),
      thumbnailUrl: optionalText(firstParam(params.thumbnailUrl)) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publishedAt: optionalText(firstParam(params.publishedAt)),
      durationSeconds: Number.isFinite(routeDuration) && routeDuration > 0 ? routeDuration : 0,
    };
  }, [id, params.channelId, params.channelTitle, params.durationSeconds, params.publishedAt, params.thumbnailUrl, params.title, savedVideos, watchLater]);

  const [startAt, setStartAt] = useState<number>(0);
  const [resumeReady, setResumeReady] = useState<boolean>(false);
  const [playbackState, setPlaybackState] = useState<YouTubePlaybackState>("unstarted");
  const [playerReady, setPlayerReady] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<YouTubePlayerError | null>(null);
  const [playerKey, setPlayerKey] = useState<number>(0);
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(video?.durationSeconds ?? 0);
  const didEndRef = useRef<boolean>(false);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  const isLandscape = width > height;
  const playerTopInset = isLandscape ? 0 : insets.top;
  const availablePlayerHeight = Math.max(180, height - playerTopInset - insets.bottom);
  const playerHeight = Math.min((width * 9) / 16, availablePlayerHeight);
  const playerWidth = Math.min(width, (playerHeight * 16) / 9);

  useEffect(() => {
    let mounted = true;
    setResumeReady(false);
    setPlayerReady(false);
    setPlayerError(null);
    setPlaybackState("unstarted");
    setStartAt(0);
    currentTimeRef.current = 0;
    durationRef.current = video?.durationSeconds ?? 0;
    didEndRef.current = false;

    if (!id || !isPremium) {
      setResumeReady(true);
      return () => { mounted = false; };
    }
    getResume(id)
      .then((resume) => {
        if (!mounted) return;
        const duration = video?.durationSeconds ?? resume?.durationSeconds ?? 0;
        const savedTime = Math.max(0, resume?.timestampSeconds ?? 0);
        const safeTime = duration > 0 && savedTime >= duration - 10 ? 0 : savedTime;
        currentTimeRef.current = safeTime;
        setStartAt(safeTime);
        setResumeReady(true);
      })
      .catch(() => {
        if (mounted) setResumeReady(true);
      });
    return () => { mounted = false; };
  }, [id, isPremium, video?.durationSeconds]);

  const persist = useCallback((): Promise<void> => {
    if (!video || !isPremium || didEndRef.current) return Promise.resolve();
    const current = currentTimeRef.current;
    const duration = durationRef.current || video.durationSeconds;
    if (current <= 5 || (duration > 0 && current >= duration - 10)) return Promise.resolve();
    const normalizedVideo = duration > 0 && duration !== video.durationSeconds
      ? { ...video, durationSeconds: Math.floor(duration) }
      : video;
    writeChainRef.current = writeChainRef.current
      .then(async () => {
        if (didEndRef.current) return;
        await recordResume(normalizedVideo, current);
      })
      .catch(() => {});
    return writeChainRef.current;
  }, [isPremium, recordResume, video]);

  const pauseAndPersist = useCallback((): void => {
    playerRef.current?.pause();
    setPlaybackState((state) => state === "playing" ? "paused" : state);
    void persist();
  }, [persist]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") pauseAndPersist();
    });
    return () => subscription.remove();
  }, [pauseAndPersist]);

  useFocusEffect(useCallback(() => {
    return () => pauseAndPersist();
  }, [pauseAndPersist]));

  useEffect(() => {
    if (playbackState !== "playing") return;
    const interval = setInterval(() => { void persist(); }, RESUME_WRITE_INTERVAL_MS);
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      clearInterval(interval);
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [persist, playbackState]);

  useEffect(() => {
    if (!resumeReady || playerReady || playerError) return;
    const timeout = setTimeout(() => {
      setPlayerError({ message: "The player is taking too long to respond. Check your connection and retry." });
    }, PLAYER_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [playerError, playerReady, playerKey, resumeReady]);

  const handleReady = useCallback((durationSeconds: number): void => {
    if (__DEV__) console.log("[player] ready", { id, durationSeconds });
    if (durationSeconds > 0) durationRef.current = durationSeconds;
    setPlayerReady(true);
    setPlayerError(null);
  }, [id]);

  const handleProgress = useCallback((currentSeconds: number, durationSeconds: number): void => {
    currentTimeRef.current = Math.max(0, currentSeconds);
    if (durationSeconds > 0) durationRef.current = durationSeconds;
  }, []);

  const handleStateChange = useCallback((state: YouTubePlaybackState): void => {
    setPlaybackState(state);
    if (state === "paused") void persist();
  }, [persist]);

  const handleFullscreenChange = useCallback((isFullscreen: boolean): void => {
    const orientationLock = isFullscreen
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.DEFAULT;
    void ScreenOrientation.lockAsync(orientationLock).catch(() => {});
  }, []);

  const handleEnded = useCallback((): void => {
    if (!video || didEndRef.current) return;
    if (__DEV__) console.log("[player] ended", { id: video.id, sessionIndex: isSession ? sessionIndex : null });
    didEndRef.current = true;
    currentTimeRef.current = 0;
    setPlaybackState("ended");
    writeChainRef.current = writeChainRef.current
      .then(() => clearVideoResume(video.id))
      .catch(() => {});
    void AccessibilityInfo.announceForAccessibility(isSession && nextSessionId ? "Video complete. Next video ready." : "Video complete.");
  }, [clearVideoResume, isSession, nextSessionId, sessionIndex, video]);

  const handlePlayerError = useCallback((error: YouTubePlayerError): void => {
    if (__DEV__) console.warn("[player] error", { id, code: error.code ?? null });
    playerRef.current?.pause();
    setPlaybackState("paused");
    setPlayerError(error);
    void persist();
  }, [id, persist]);

  const retryPlayer = useCallback((): void => {
    didEndRef.current = false;
    const retryAt = Math.max(0, Math.floor(currentTimeRef.current));
    setStartAt(retryAt);
    setPlayerReady(false);
    setPlayerError(null);
    setPlaybackState("unstarted");
    setPlayerKey((value) => value + 1);
  }, []);

  const closePlayer = useCallback((): void => {
    pauseAndPersist();
    router.back();
  }, [pauseAndPersist]);

  const playNext = useCallback((): void => {
    if (!nextSessionId) {
      closePlayer();
      return;
    }
    setResumeReady(false);
    setPlayerReady(false);
    setPlayerError(null);
    router.replace({
      pathname: "/watch/[id]",
      params: { id: nextSessionId, session: sessionIds.join(","), i: String(sessionIndex + 1) },
    });
  }, [closePlayer, nextSessionId, sessionIds, sessionIndex]);

  const rewatch = useCallback((): void => {
    didEndRef.current = false;
    setPlaybackState("playing");
    playerRef.current?.seekTo(0);
    playerRef.current?.play();
  }, []);

  const openInYouTube = useCallback((): void => {
    void Linking.openURL(`https://www.youtube.com/watch?v=${id}`).catch(() => {});
  }, [id]);

  const isSaved = video ? savedVideos.some((candidate) => candidate.id === video.id) : false;
  const inWatchLater = video ? isInWatchLater(video.id) : false;

  const toggleSave = async (): Promise<void> => {
    if (!video) return;
    if (!isSaved) {
      if (!requirePurchase()) return;
      const normalizedVideo = durationRef.current > 0
        ? { ...video, durationSeconds: Math.floor(durationRef.current) }
        : video;
      await saveVideo(normalizedVideo);
      return;
    }
    await unsaveVideo(video.id);
  };

  const toggleWatchLater = async (): Promise<void> => {
    if (!video) return;
    if (!inWatchLater) {
      if (!requirePurchase()) return;
      const normalizedVideo = durationRef.current > 0
        ? { ...video, durationSeconds: Math.floor(durationRef.current) }
        : video;
      await addToWatchLater(normalizedVideo);
      return;
    }
    await removeFromWatchLater(video.id);
  };

  if (!video) {
    return (
      <View style={styles.unavailableScreen}>
        <Text style={type.heading}>Video unavailable</Text>
        <Text style={[type.bodySoft, styles.unavailableBody]}>This link is incomplete or no longer valid.</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryLightButton} accessibilityRole="button">
          <Text style={[type.label, { color: palette.accent }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const dateLabel = formatRelativeDate(video.publishedAt);
  const durationLabel = formatDuration(durationRef.current || video.durationSeconds);
  const detailLabel = [dateLabel, durationLabel === "—" ? "" : durationLabel].filter(Boolean).join(" · ");
  const showEnded = playbackState === "ended";

  return (
    <View style={styles.screen}>
      <View style={[styles.playerArea, { marginTop: playerTopInset, height: playerHeight }]}> 
        <View style={[styles.playerStage, { width: playerWidth, height: playerHeight }]}>
          {resumeReady ? (
            <YouTubePlayer
              key={`${id}-${playerKey}`}
              ref={playerRef}
              videoId={video.id}
              startSeconds={startAt}
              onReady={handleReady}
              onProgress={handleProgress}
              onStateChange={handleStateChange}
              onEnded={handleEnded}
              onError={handlePlayerError}
              onFullscreenChange={handleFullscreenChange}
            />
          ) : null}

          {!playerReady && !playerError ? (
            <View style={styles.playerStatus} accessible accessibilityRole="progressbar" accessibilityLabel="Loading video">
              <ActivityIndicator color={palette.wall} />
              <Text style={styles.playerStatusText}>{resumeReady ? "Preparing video…" : "Finding your place…"}</Text>
            </View>
          ) : null}

          {playerError ? (
            <View style={styles.playerStatus} accessibilityViewIsModal accessible accessibilityRole="alert">
              <Text style={styles.errorTitle}>Couldn’t play this video</Text>
              <Text style={styles.errorBody}>{playerError.message}</Text>
              <View style={styles.overlayActions}>
                <Pressable onPress={retryPlayer} style={styles.darkOutlineButton} accessibilityRole="button" testID="player-retry">
                  <RotateCcw size={15} color={palette.wall} />
                  <Text style={styles.darkButtonText}>Retry</Text>
                </Pressable>
                <Pressable onPress={openInYouTube} style={styles.darkOutlineButton} accessibilityRole="link" testID="open-youtube">
                  <ExternalLink size={15} color={palette.wall} />
                  <Text style={styles.darkButtonText}>YouTube</Text>
                </Pressable>
              </View>
              {isSession ? (
                <Pressable onPress={playNext} style={styles.skipButton} accessibilityRole="button" testID="session-skip">
                  <Text style={styles.skipButtonText}>{nextSessionId ? "Skip to next" : "End session"}</Text>
                  {nextSessionId ? <ChevronRight size={15} color={palette.ink} /> : null}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {showEnded ? (
            <View style={styles.endedOverlay} accessibilityViewIsModal accessible accessibilityRole="summary">
              <Text style={styles.endEyebrow}>
                {isSession ? (nextSessionId ? `Session · ${sessionIndex + 1} of ${sessionIds.length}` : "Session complete") : "The end"}
              </Text>
              <Text style={styles.endTitle}>{nextSessionId ? "One done." : "That’s it."}</Text>
              <View style={styles.overlayActions}>
                <Pressable onPress={rewatch} style={styles.darkOutlineButton} accessibilityRole="button" testID="rewatch">
                  <RotateCcw size={15} color={palette.wall} />
                  <Text style={styles.darkButtonText}>Watch again</Text>
                </Pressable>
                <Pressable onPress={nextSessionId ? playNext : closePlayer} style={styles.lightOverlayButton} accessibilityRole="button" testID={nextSessionId ? "session-next" : "watch-done"}>
                  <Text style={styles.lightButtonText}>{nextSessionId ? "Next" : "Done"}</Text>
                  {nextSessionId ? <ChevronRight size={15} color={palette.ink} /> : null}
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={closePlayer}
          style={[styles.backButton, { top: spacing.sm, left: Math.max(spacing.sm, insets.left + spacing.sm) }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close video"
          testID="watch-back"
        >
          <BlurView intensity={Platform.OS === "ios" ? 60 : 90} tint="dark" style={styles.backButtonBlur}>
            <ChevronLeft color={palette.wall} size={23} />
          </BlurView>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {video.channelTitle ? <Text style={type.caption}>{video.channelTitle}</Text> : null}
        <Text style={[type.title, { marginTop: video.channelTitle ? spacing.sm : 0 }]}>{video.title}</Text>
        {detailLabel ? <Text style={[type.caption, styles.detailLabel]}>{detailLabel}</Text> : null}

        <View style={styles.actionRow} accessibilityRole="toolbar">
          <Pressable onPress={toggleSave} style={styles.actionButton} accessibilityRole="button" accessibilityState={{ selected: isSaved }} accessibilityLabel={isSaved ? "Remove from saved videos" : "Save video"} testID="action-save">
            <Bookmark size={17} color={isSaved ? palette.accent : palette.ink} strokeWidth={1.6} fill={isSaved ? palette.accent : "transparent"} />
            <Text style={[type.label, isSaved && { color: palette.accent }]}>{isSaved ? "Saved" : "Save"}</Text>
          </Pressable>
          <Pressable onPress={toggleWatchLater} style={styles.actionButton} accessibilityRole="button" accessibilityState={{ selected: inWatchLater }} accessibilityLabel={inWatchLater ? "Remove from Watch Later" : "Add to Watch Later"} testID="action-watchlater">
            <Clock size={17} color={inWatchLater ? palette.accent : palette.ink} strokeWidth={1.6} />
            <Text style={[type.label, inWatchLater && { color: palette.accent }]}>{inWatchLater ? "Added" : "Later"}</Text>
          </Pressable>
        </View>

        {video.description ? (
          <View style={styles.notes}>
            <Text style={type.caption}>About</Text>
            <Text style={[type.body, styles.description]}>{video.description}</Text>
          </View>
        ) : null}

        {video.channelId ? (
          <Pressable
            onPress={() => router.push({ pathname: "/channel/[id]", params: { id: video.channelId } })}
            style={styles.channelLink}
            accessibilityRole="link"
            accessibilityLabel={`View ${video.channelTitle || "video"} channel`}
          >
            <Text style={type.caption}>Channel</Text>
            <Text style={[type.heading, { marginTop: spacing.xs }]}>{video.channelTitle}</Text>
            <Text style={[type.caption, styles.channelLinkLabel]}>View channel →</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.wall },
  playerArea: { width: "100%", backgroundColor: "#000", alignItems: "center", position: "relative" },
  playerStage: { backgroundColor: "#000", position: "relative" },
  playerStatus: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  playerStatusText: { ...type.bodySoft, color: "rgba(250,249,246,0.72)", marginTop: spacing.md },
  backButton: { position: "absolute", zIndex: 20, overflow: "hidden" },
  backButtonBlur: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  errorTitle: { ...type.heading, color: palette.wall, textAlign: "center" },
  errorBody: { ...type.bodySoft, color: "rgba(250,249,246,0.72)", textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },
  overlayActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  darkOutlineButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1, borderColor: "rgba(250,249,246,0.45)", paddingHorizontal: spacing.md },
  darkButtonText: { ...type.label, color: palette.wall },
  skipButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: palette.wall, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  skipButtonText: { ...type.label, color: palette.ink },
  endedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  endEyebrow: { ...type.caption, color: "rgba(250,249,246,0.7)" },
  endTitle: { ...type.title, color: palette.wall, marginTop: spacing.sm, textAlign: "center" },
  lightOverlayButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: palette.wall, paddingHorizontal: spacing.lg },
  lightButtonText: { ...type.label, color: palette.ink },
  content: { padding: spacing.lg },
  detailLabel: { marginTop: spacing.md, color: palette.inkMuted },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  actionButton: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: palette.surface },
  notes: { marginTop: spacing.xl },
  description: { marginTop: spacing.sm, color: palette.inkSoft },
  channelLink: { marginTop: spacing.xxl, padding: spacing.lg, backgroundColor: palette.surface, minHeight: 44 },
  channelLinkLabel: { color: palette.accent, marginTop: spacing.md },
  unavailableScreen: { flex: 1, backgroundColor: palette.wall, justifyContent: "center", padding: spacing.lg },
  unavailableBody: { marginTop: spacing.sm, color: palette.inkMuted },
  primaryLightButton: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginTop: spacing.lg },
});
