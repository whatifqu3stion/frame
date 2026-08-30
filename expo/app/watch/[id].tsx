import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { Bookmark, ChevronLeft, ChevronRight, Clock, ExternalLink, RotateCcw } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  BackHandler,
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
import VideoChapters from "@/components/VideoChapters";
import YouTubePlayer from "@/components/YouTubePlayer";
import type { YouTubePlaybackState, YouTubePlayerError, YouTubePlayerHandle } from "@/components/YouTubePlayer.types";
import { palette, radii, spacing, type, watchPalette } from "@/constants/theme";
import { getResume } from "@/db/database";
import { useApp } from "@/providers/AppProvider";
import { clearOrientationRequest, setOrientationRequest } from "@/services/orientation";
import { formatDuration, formatRelativeDate, getVideo, parseVideoChapters, type VideoChapter } from "@/services/youtube";
import type { Video } from "@/types";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const PLAYER_TIMEOUT_MS = 18000;
const RESUME_WRITE_INTERVAL_MS = 15000;
const FINAL_PROGRESS_DELAY_MS = 250;
const KEEP_AWAKE_TAG = "frame-video-playback";
const LANDSCAPE_RAIL_WIDTH = 64;
const CONTROL_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;
const DARK_CONTROL_RIPPLE = { color: "rgba(250,249,246,0.16)", borderless: false } as const;
const LIGHT_CONTROL_RIPPLE = { color: "rgba(21,30,27,0.12)", borderless: false } as const;

type PendingAction = "retry" | "rewatch" | "save" | "later" | null;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function firstPositiveDuration(...values: (number | null | undefined)[]): number {
  return values.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ?? 0;
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

  const baseVideo = useMemo<Video | undefined>(() => {
    const stored = savedVideos.find((candidate) => candidate.id === id)
      ?? watchLater.find((candidate) => candidate.id === id);
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

  const metadataQuery = useQuery({
    queryKey: ["video", id],
    queryFn: () => getVideo(id),
    enabled: VIDEO_ID_PATTERN.test(id),
    staleTime: 5 * 60_000,
  });
  const verifiedVideo = metadataQuery.data?.status === "success" ? metadataQuery.data.data : null;
  const video = useMemo<Video | undefined>(() => {
    if (!baseVideo) return undefined;
    if (!verifiedVideo) return baseVideo;
    return { ...baseVideo, ...verifiedVideo, description: verifiedVideo.description ?? baseVideo.description };
  }, [baseVideo, verifiedVideo]);

  const [startAt, setStartAt] = useState<number>(0);
  const [resumeReady, setResumeReady] = useState<boolean>(false);
  const [playbackState, setPlaybackState] = useState<YouTubePlaybackState>("unstarted");
  const [playerReady, setPlayerReady] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<YouTubePlayerError | null>(null);
  const [playerKey, setPlayerKey] = useState<number>(0);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isScreenFocused, setIsScreenFocused] = useState<boolean>(true);
  const [isAppActive, setIsAppActive] = useState<boolean>(AppState.currentState === "active");
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const [playerDurationSeconds, setPlayerDurationSeconds] = useState<number>(video?.durationSeconds ?? 0);
  const chapters = useMemo(() => parseVideoChapters(video?.description, firstPositiveDuration(playerDurationSeconds, video?.durationSeconds)), [playerDurationSeconds, video?.description, video?.durationSeconds]);
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(video?.durationSeconds ?? 0);
  const didEndRef = useRef<boolean>(false);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingActionRef = useRef<PendingAction>(null);
  const navigationLockedRef = useRef<boolean>(false);
  const isFullscreenRef = useRef<boolean>(false);

  const isLandscape = width > height;
  const isImmersiveLandscape = isLandscape && (Platform.OS !== "web" || width < 900);
  const landscapeAvailableWidth = Math.max(
    160,
    width - insets.left - insets.right - LANDSCAPE_RAIL_WIDTH - spacing.sm,
  );
  const landscapeAvailableHeight = Math.max(90, height - insets.top - insets.bottom);
  const landscapePlayerHeight = Math.min(landscapeAvailableHeight, (landscapeAvailableWidth * 9) / 16);
  const landscapePlayerWidth = Math.min(landscapeAvailableWidth, (landscapePlayerHeight * 16) / 9);
  const portraitPlayerHeight = Math.max(180, Math.min((width * 9) / 16, height * 0.52));
  const portraitPlayerWidth = Math.min(width, (portraitPlayerHeight * 16) / 9);

  const haptic = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void => {
    void Haptics.impactAsync(style).catch(() => {});
  }, []);

  const setAction = useCallback((action: PendingAction): void => {
    pendingActionRef.current = action;
    setPendingAction(action);
  }, []);

  const beginAction = useCallback((action: Exclude<PendingAction, null>): boolean => {
    if (pendingActionRef.current !== null || navigationLockedRef.current) return false;
    setAction(action);
    return true;
  }, [setAction]);

  useEffect(() => {
    let mounted = true;
    setResumeReady(false);
    setPlayerReady(false);
    setPlayerError(null);
    setPlaybackState("unstarted");
    setStartAt(0);
    setAction(null);
    currentTimeRef.current = 0;
    setCurrentSeconds(0);
    setPlayerDurationSeconds(video?.durationSeconds ?? 0);
    durationRef.current = video?.durationSeconds ?? 0;
    didEndRef.current = false;
    navigationLockedRef.current = false;

    if (!id || !isPremium) {
      setResumeReady(true);
      return () => { mounted = false; };
    }
    getResume(id)
      .then((resume) => {
        if (!mounted) return;
        const duration = firstPositiveDuration(video?.durationSeconds, resume?.durationSeconds);
        const savedTime = Math.max(0, resume?.timestampSeconds ?? 0);
        const safeTime = duration > 0 && savedTime >= duration - 10 ? 0 : savedTime;
        durationRef.current = duration;
        currentTimeRef.current = safeTime;
        setCurrentSeconds(safeTime);
        setStartAt(safeTime);
        setResumeReady(true);
      })
      .catch(() => {
        if (mounted) setResumeReady(true);
      });
    return () => { mounted = false; };
  }, [id, isPremium, setAction, video?.durationSeconds]);

  const persist = useCallback((): Promise<void> => {
    if (!video || !isPremium || didEndRef.current) return Promise.resolve();
    const current = currentTimeRef.current;
    const duration = firstPositiveDuration(durationRef.current, video.durationSeconds);
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
    playerRef.current?.requestProgress();
    playerRef.current?.pause();
    setPlaybackState((state) => state === "playing" ? "paused" : state);
    void persist();
    setTimeout(() => { void persist(); }, FINAL_PROGRESS_DELAY_MS);
  }, [persist]);

  const leaveFullscreen = useCallback((): void => {
    playerRef.current?.exitFullscreen();
    isFullscreenRef.current = false;
    setIsFullscreen(false);
    void clearOrientationRequest("fullscreen");
  }, []);

  useFocusEffect(useCallback(() => {
    setIsScreenFocused(true);
    void setOrientationRequest("watch", ScreenOrientation.OrientationLock.DEFAULT);
    return () => {
      playerRef.current?.exitFullscreen();
      isFullscreenRef.current = false;
      setIsFullscreen(false);
      pauseAndPersist();
      setStartAt(Math.max(0, Math.floor(currentTimeRef.current)));
      setPlayerReady(false);
      setIsScreenFocused(false);
      void clearOrientationRequest("fullscreen");
      void clearOrientationRequest("watch");
    };
  }, [pauseAndPersist]));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const nextActive = state === "active";
      if (!nextActive) {
        leaveFullscreen();
        pauseAndPersist();
        setStartAt(Math.max(0, Math.floor(currentTimeRef.current)));
        setPlayerReady(false);
      }
      setIsAppActive(nextActive);
    });
    return () => subscription.remove();
  }, [leaveFullscreen, pauseAndPersist]);

  useEffect(() => {
    if (playbackState !== "playing" || !playerReady) return;
    const interval = setInterval(() => { void persist(); }, RESUME_WRITE_INTERVAL_MS);
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      clearInterval(interval);
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [persist, playbackState, playerReady]);

  useEffect(() => {
    if (!resumeReady || playerReady || playerError || !isScreenFocused || !isAppActive) return;
    const timeout = setTimeout(() => {
      setPlayerError({ message: isOnline === false ? "You’re offline. Reconnect, then retry this video." : "The player is taking too long to respond. Check your connection and retry." });
      setAction(null);
    }, PLAYER_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [isAppActive, isOnline, isScreenFocused, playerError, playerReady, playerKey, resumeReady, setAction]);

  useEffect(() => {
    if (playerError) void AccessibilityInfo.announceForAccessibility(`Couldn’t play this video. ${playerError.message}`);
  }, [playerError]);

  const handleReady = useCallback((durationSeconds: number): void => {
    if (__DEV__) console.log("[player] ready", { id, durationSeconds });
    if (durationSeconds > 0) {
      durationRef.current = durationSeconds;
      setPlayerDurationSeconds(durationSeconds);
    }
    setPlayerReady(true);
    setPlayerError(null);
    setAction(null);
  }, [id, setAction]);

  const handleProgress = useCallback((nextCurrentSeconds: number, durationSeconds: number): void => {
    const safeCurrentSeconds = Math.max(0, nextCurrentSeconds);
    currentTimeRef.current = safeCurrentSeconds;
    setCurrentSeconds(safeCurrentSeconds);
    if (durationSeconds > 0) {
      durationRef.current = durationSeconds;
      setPlayerDurationSeconds(durationSeconds);
    }
  }, []);

  const jumpToChapter = useCallback((chapter: VideoChapter): void => {
    if (!playerReady || playerError) return;
    currentTimeRef.current = chapter.startSeconds;
    setCurrentSeconds(chapter.startSeconds);
    playerRef.current?.seekTo(chapter.startSeconds);
    void Haptics.selectionAsync().catch(() => {});
    void AccessibilityInfo.announceForAccessibility(`Jumped to ${formatDuration(chapter.startSeconds)}. ${chapter.title}`);
  }, [playerError, playerReady]);

  const handleStateChange = useCallback((state: YouTubePlaybackState): void => {
    setPlaybackState(state);
    if (state === "paused") void persist();
  }, [persist]);

  const handleConnectivityChange = useCallback((nextOnline: boolean): void => {
    setIsOnline(nextOnline);
  }, []);

  const handleFullscreenChange = useCallback((nextFullscreen: boolean): void => {
    isFullscreenRef.current = nextFullscreen;
    setIsFullscreen(nextFullscreen);
    if (nextFullscreen) {
      void setOrientationRequest("fullscreen", ScreenOrientation.OrientationLock.LANDSCAPE);
    } else {
      void clearOrientationRequest("fullscreen");
    }
  }, []);

  const handleEnded = useCallback((): void => {
    if (!video || didEndRef.current) return;
    if (__DEV__) console.log("[player] ended", { id: video.id, sessionIndex: isSession ? sessionIndex : null });
    didEndRef.current = true;
    currentTimeRef.current = 0;
    setPlaybackState("ended");
    setAction(null);
    if (isFullscreenRef.current) leaveFullscreen();
    writeChainRef.current = writeChainRef.current
      .then(() => clearVideoResume(video.id))
      .catch(() => {});
    void AccessibilityInfo.announceForAccessibility(isSession && nextSessionId ? "Video complete. Next video ready." : "Video complete.");
  }, [clearVideoResume, isSession, leaveFullscreen, nextSessionId, sessionIndex, setAction, video]);

  const handlePlayerError = useCallback((error: YouTubePlayerError): void => {
    if (__DEV__) console.warn("[player] error", { id, code: error.code ?? null });
    playerRef.current?.requestProgress();
    playerRef.current?.pause();
    setPlaybackState("paused");
    setPlayerError(error);
    setAction(null);
    if (isFullscreenRef.current) leaveFullscreen();
    void persist();
  }, [id, leaveFullscreen, persist, setAction]);

  const retryPlayer = useCallback((): void => {
    if (!beginAction("retry")) return;
    haptic();
    if (isFullscreenRef.current) leaveFullscreen();
    didEndRef.current = false;
    const retryAt = Math.max(0, Math.floor(currentTimeRef.current));
    setStartAt(retryAt);
    setPlayerReady(false);
    setPlayerError(null);
    setPlaybackState("unstarted");
    setPlayerKey((value) => value + 1);
  }, [beginAction, haptic, leaveFullscreen]);

  const closePlayer = useCallback((): void => {
    if (navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    haptic();
    leaveFullscreen();
    pauseAndPersist();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [haptic, leaveFullscreen, pauseAndPersist]);

  const playNext = useCallback((): void => {
    if (!nextSessionId) {
      closePlayer();
      return;
    }
    if (navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    haptic();
    pauseAndPersist();
    setResumeReady(false);
    setPlayerReady(false);
    setPlayerError(null);
    router.replace({
      pathname: "/watch/[id]",
      params: { id: nextSessionId, session: sessionIds.join(","), i: String(sessionIndex + 1) },
    });
  }, [closePlayer, haptic, nextSessionId, pauseAndPersist, sessionIds, sessionIndex]);

  const rewatch = useCallback((): void => {
    if (!beginAction("rewatch")) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    didEndRef.current = false;
    currentTimeRef.current = 0;
    setPlaybackState("playing");
    playerRef.current?.seekTo(0);
    playerRef.current?.play();
    setAction(null);
  }, [beginAction, haptic, setAction]);

  const openInYouTube = useCallback((): void => {
    haptic();
    void Linking.openURL(`https://www.youtube.com/watch?v=${id}`).catch(() => {
      void AccessibilityInfo.announceForAccessibility("Couldn’t open YouTube.");
    });
  }, [haptic, id]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isFullscreenRef.current) {
        leaveFullscreen();
        return true;
      }
      closePlayer();
      return true;
    });
    return () => subscription.remove();
  }, [closePlayer, leaveFullscreen]);

  const isSaved = video ? savedVideos.some((candidate) => candidate.id === video.id) : false;
  const inWatchLater = video ? isInWatchLater(video.id) : false;

  const toggleSave = useCallback(async (): Promise<void> => {
    if (!video || !beginAction("save")) return;
    try {
      if (!isSaved) {
        if (!requirePurchase("save")) return;
        const duration = firstPositiveDuration(durationRef.current, video.durationSeconds);
        const normalizedVideo = duration > 0 ? { ...video, durationSeconds: Math.floor(duration) } : video;
        await saveVideo(normalizedVideo);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        await unsaveVideo(video.id);
        haptic();
      }
    } catch {
      void AccessibilityInfo.announceForAccessibility("Couldn’t update saved videos. Please try again.");
    } finally {
      setAction(null);
    }
  }, [beginAction, haptic, isSaved, requirePurchase, saveVideo, setAction, unsaveVideo, video]);

  const toggleWatchLater = useCallback(async (): Promise<void> => {
    if (!video || !beginAction("later")) return;
    try {
      if (!inWatchLater) {
        if (!requirePurchase("watchLater")) return;
        const duration = firstPositiveDuration(durationRef.current, video.durationSeconds);
        const normalizedVideo = duration > 0 ? { ...video, durationSeconds: Math.floor(duration) } : video;
        await addToWatchLater(normalizedVideo);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        await removeFromWatchLater(video.id);
        haptic();
      }
    } catch {
      void AccessibilityInfo.announceForAccessibility("Couldn’t update Watch Later. Please try again.");
    } finally {
      setAction(null);
    }
  }, [addToWatchLater, beginAction, haptic, inWatchLater, removeFromWatchLater, requirePurchase, setAction, video]);

  if (!video) {
    return (
      <View style={[styles.unavailableScreen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
        <StatusBar style="dark" />
        <Text style={type.heading}>Video unavailable</Text>
        <Text style={[type.bodySoft, styles.unavailableBody]}>This link is incomplete or no longer valid.</Text>
        <Pressable onPress={closePlayer} hitSlop={CONTROL_HIT_SLOP} android_ripple={LIGHT_CONTROL_RIPPLE} style={({ pressed }) => [styles.primaryLightButton, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={[type.label, { color: palette.accent }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const dateLabel = formatRelativeDate(video.publishedAt);
  const durationLabel = formatDuration(firstPositiveDuration(durationRef.current, video.durationSeconds));
  const detailLabel = [dateLabel, durationLabel === "—" ? "" : durationLabel].filter(Boolean).join(" · ");
  const showEnded = playbackState === "ended";
  const shouldMountPlayer = resumeReady && isScreenFocused && isAppActive && !showEnded;
  const showPlayer = shouldMountPlayer && playerReady && !playerError;
  const playerBusy = pendingAction === "retry";

  const stage = (
    <View style={styles.playerStage}>
      {shouldMountPlayer ? (
        <View
          style={[styles.playerEmbed, !showPlayer && styles.playerEmbedHidden]}
          pointerEvents={showPlayer ? "auto" : "none"}
          accessibilityElementsHidden={!showPlayer}
          importantForAccessibility={showPlayer ? "auto" : "no-hide-descendants"}
        >
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
            onConnectivityChange={handleConnectivityChange}
          />
        </View>
      ) : null}

      {!playerReady && !playerError ? (
        <View style={styles.stateSurface} accessible accessibilityRole="progressbar" accessibilityLabel={resumeReady ? "Preparing video" : "Finding your place"}>
          <ActivityIndicator color={palette.wall} />
          <Text style={styles.playerStatusText}>{isOnline === false ? "You’re offline" : resumeReady ? "Preparing video…" : "Finding your place…"}</Text>
        </View>
      ) : null}

      {playerError ? (
        <View style={styles.stateSurface} accessibilityLiveRegion="assertive">
          <Text style={styles.errorTitle} accessibilityRole="alert">Couldn’t play this video</Text>
          <Text style={styles.errorBody}>{isOnline === false ? "You’re offline. Reconnect, then retry this video." : playerError.message}</Text>
          <View style={styles.stateActions}>
            <Pressable
              onPress={retryPlayer}
              hitSlop={CONTROL_HIT_SLOP}
              android_ripple={DARK_CONTROL_RIPPLE}
              disabled={playerBusy}
              style={({ pressed }) => [styles.darkOutlineButton, (pressed || playerBusy) && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ busy: playerBusy, disabled: playerBusy }}
              testID="player-retry"
            >
              {playerBusy ? <ActivityIndicator size="small" color={palette.wall} /> : <RotateCcw size={15} color={palette.wall} />}
              <Text style={styles.darkButtonText}>{playerBusy ? "Retrying" : "Retry"}</Text>
            </Pressable>
            <Pressable onPress={openInYouTube} hitSlop={CONTROL_HIT_SLOP} android_ripple={DARK_CONTROL_RIPPLE} style={({ pressed }) => [styles.darkOutlineButton, pressed && styles.pressed]} accessibilityRole="link" testID="open-youtube">
              <ExternalLink size={15} color={palette.wall} />
              <Text style={styles.darkButtonText}>YouTube</Text>
            </Pressable>
          </View>
          {isSession ? (
            <Pressable onPress={playNext} hitSlop={CONTROL_HIT_SLOP} android_ripple={LIGHT_CONTROL_RIPPLE} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]} accessibilityRole="button" testID="session-skip">
              <Text style={styles.skipButtonText}>{nextSessionId ? "Skip to next" : "End session"}</Text>
              {nextSessionId ? <ChevronRight size={15} color={palette.ink} /> : null}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showEnded ? (
        <View style={styles.stateSurface} accessibilityLiveRegion="polite">
          <Text style={styles.endEyebrow}>
            {isSession ? (nextSessionId ? `Session · ${sessionIndex + 1} of ${sessionIds.length}` : "Session complete") : "The end"}
          </Text>
          <Text style={styles.endTitle} accessibilityRole="header">{nextSessionId ? "One done." : "That’s it."}</Text>
          <View style={styles.stateActions}>
            <Pressable onPress={rewatch} hitSlop={CONTROL_HIT_SLOP} android_ripple={DARK_CONTROL_RIPPLE} style={({ pressed }) => [styles.darkOutlineButton, pressed && styles.pressed]} accessibilityRole="button" testID="rewatch">
              <RotateCcw size={15} color={palette.wall} />
              <Text style={styles.darkButtonText}>Watch again</Text>
            </Pressable>
            <Pressable onPress={nextSessionId ? playNext : closePlayer} hitSlop={CONTROL_HIT_SLOP} android_ripple={LIGHT_CONTROL_RIPPLE} style={({ pressed }) => [styles.lightStateButton, pressed && styles.pressed]} accessibilityRole="button" testID={nextSessionId ? "session-next" : "watch-done"}>
              <Text style={styles.lightButtonText}>{nextSessionId ? "Next" : "Done"}</Text>
              {nextSessionId ? <ChevronRight size={15} color={palette.ink} /> : null}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );

  if (isImmersiveLandscape) {
    return (
      <View style={[styles.landscapeScreen, { paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left }]}>
        <StatusBar style="light" hidden={isFullscreen} />
        <View style={styles.landscapeRail}>
          <Pressable
            onPress={closePlayer}
            hitSlop={CONTROL_HIT_SLOP}
            android_ripple={DARK_CONTROL_RIPPLE}
            style={({ pressed }) => [styles.landscapeClose, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close video"
            testID="watch-back"
          >
            <ChevronLeft color={palette.wall} size={23} />
          </Pressable>
        </View>
        <View style={styles.landscapeStageArea}>
          <View style={{ width: landscapePlayerWidth, height: landscapePlayerHeight }}>{stage}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" hidden={isFullscreen} />
      <View style={[styles.watchChrome, { paddingTop: insets.top }]}>
        <Pressable
          onPress={closePlayer}
          hitSlop={CONTROL_HIT_SLOP}
          android_ripple={DARK_CONTROL_RIPPLE}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Close video"
          testID="watch-back"
        >
          <ChevronLeft color={palette.wall} size={22} />
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
        {isOnline === false ? <Text style={styles.fullscreenStatus} accessibilityLiveRegion="polite">Offline</Text> : isFullscreen ? <Text style={styles.fullscreenStatus}>Fullscreen</Text> : null}
      </View>

      <View style={[styles.portraitPlayerArea, { height: portraitPlayerHeight }]}>
        <View style={{ width: portraitPlayerWidth, height: portraitPlayerHeight }}>{stage}</View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {video.channelTitle ? <Text style={type.caption}>{video.channelTitle}</Text> : null}
        <Text style={[type.title, styles.videoTitle, { marginTop: video.channelTitle ? spacing.sm : 0 }]}>{video.title}</Text>
        {detailLabel ? <Text style={[type.caption, styles.detailLabel]}>{detailLabel}</Text> : null}

        <View style={styles.actionRow} accessibilityRole="toolbar">
          <Pressable
            onPress={toggleSave}
            hitSlop={CONTROL_HIT_SLOP}
            android_ripple={DARK_CONTROL_RIPPLE}
            disabled={pendingAction === "save"}
            style={({ pressed }) => [styles.actionButton, (pressed || pendingAction === "save") && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSaved, busy: pendingAction === "save", disabled: pendingAction === "save" }}
            accessibilityLabel={isSaved ? "Remove from saved videos" : "Save video"}
            testID="action-save"
          >
            {pendingAction === "save" ? <ActivityIndicator size="small" color={palette.accentSoft} /> : <Bookmark size={17} color={isSaved ? palette.accentSoft : palette.wall} strokeWidth={1.6} fill={isSaved ? palette.accentSoft : "transparent"} />}
            <Text style={[type.label, styles.actionLabel, isSaved && { color: palette.accentSoft }]}>{pendingAction === "save" ? "Saving…" : isSaved ? "Saved" : "Save"}</Text>
          </Pressable>
          <Pressable
            onPress={toggleWatchLater}
            hitSlop={CONTROL_HIT_SLOP}
            android_ripple={DARK_CONTROL_RIPPLE}
            disabled={pendingAction === "later"}
            style={({ pressed }) => [styles.actionButton, (pressed || pendingAction === "later") && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: inWatchLater, busy: pendingAction === "later", disabled: pendingAction === "later" }}
            accessibilityLabel={inWatchLater ? "Remove from Watch Later" : "Add to Watch Later"}
            testID="action-watchlater"
          >
            {pendingAction === "later" ? <ActivityIndicator size="small" color={palette.accentSoft} /> : <Clock size={17} color={inWatchLater ? palette.accentSoft : palette.wall} strokeWidth={1.6} />}
            <Text style={[type.label, styles.actionLabel, inWatchLater && { color: palette.accentSoft }]}>{pendingAction === "later" ? "Updating…" : inWatchLater ? "Added" : "Later"}</Text>
          </Pressable>
        </View>

        {!showEnded ? <VideoChapters chapters={chapters} currentSeconds={currentSeconds} onJump={jumpToChapter} disabled={!showPlayer} /> : null}

        {video.description ? (
          <View style={styles.notes}>
            <Text style={type.caption}>About</Text>
            <Text style={[type.body, styles.description]}>{video.description}</Text>
          </View>
        ) : null}

        {video.channelId ? (
          <Pressable
            onPress={() => router.push({ pathname: "/channel/[id]", params: { id: video.channelId } })}
            style={({ pressed }) => [styles.channelLink, pressed && styles.pressed]}
            accessibilityRole="link"
            accessibilityLabel={`View ${video.channelTitle || "video"} channel`}
          >
            <Text style={type.caption}>Channel</Text>
            <Text style={[type.heading, styles.channelTitle, { marginTop: spacing.xs }]}>{video.channelTitle}</Text>
            <Text style={[type.caption, styles.channelLinkLabel]}>View channel →</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: watchPalette.wall },
  watchChrome: {
    minHeight: 52,
    backgroundColor: watchPalette.wall,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  closeButton: {
    minWidth: 96,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    overflow: "hidden",
  },
  closeLabel: { ...type.label, color: palette.wall },
  fullscreenStatus: { ...type.caption, color: palette.wall, marginRight: spacing.sm },
  portraitPlayerArea: { width: "100%", backgroundColor: watchPalette.stage, alignItems: "center", shadowColor: watchPalette.accent, shadowOpacity: 0.12, shadowRadius: 28, shadowOffset: { width: 0, height: 12 } },
  playerStage: { width: "100%", height: "100%", backgroundColor: watchPalette.stage, overflow: "hidden" },
  playerEmbed: { ...StyleSheet.absoluteFillObject, backgroundColor: watchPalette.stage },
  playerEmbedHidden: { opacity: 0 },
  stateSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: watchPalette.wall,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  playerStatusText: { ...type.bodySoft, color: "rgba(250,249,246,0.72)", marginTop: spacing.md },
  errorTitle: { ...type.heading, color: palette.wall, textAlign: "center" },
  errorBody: { ...type.bodySoft, color: "rgba(250,249,246,0.72)", textAlign: "center", marginTop: spacing.sm, maxWidth: 360 },
  stateActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  darkOutlineButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1, borderColor: watchPalette.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.control, backgroundColor: watchPalette.surface, overflow: "hidden" },
  darkButtonText: { ...type.label, color: palette.wall },
  skipButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: watchPalette.ink, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, marginTop: spacing.md, borderRadius: radii.control, overflow: "hidden" },
  skipButtonText: { ...type.label, color: palette.ink },
  endEyebrow: { ...type.caption, color: "rgba(250,249,246,0.7)" },
  endTitle: { ...type.title, color: palette.wall, marginTop: spacing.sm, textAlign: "center" },
  lightStateButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: watchPalette.ink, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radii.control, overflow: "hidden" },
  lightButtonText: { ...type.label, color: palette.ink },
  landscapeScreen: { flex: 1, backgroundColor: watchPalette.stage, flexDirection: "row" },
  landscapeRail: { width: LANDSCAPE_RAIL_WIDTH, alignItems: "center", paddingTop: spacing.sm },
  landscapeClose: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: watchPalette.border, backgroundColor: watchPalette.surface, borderRadius: radii.control, overflow: "hidden" },
  landscapeStageArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingRight: spacing.sm },
  content: { padding: spacing.page, backgroundColor: watchPalette.wall },
  videoTitle: { color: palette.wall },
  detailLabel: { marginTop: spacing.md, color: "rgba(250,249,246,0.62)" },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  actionButton: { minHeight: 56, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: watchPalette.surface, borderRadius: radii.control, borderWidth: 1, borderColor: watchPalette.border, overflow: "hidden" },
  actionLabel: { color: palette.wall },
  notes: { marginTop: spacing.xl },
  description: { marginTop: spacing.sm, color: "rgba(250,249,246,0.76)" },
  channelLink: { marginTop: spacing.xxl, padding: spacing.lg, backgroundColor: watchPalette.surface, minHeight: 44, borderRadius: radii.card, borderWidth: 1, borderColor: watchPalette.border },
  channelTitle: { color: palette.wall },
  channelLinkLabel: { color: palette.accentSoft, marginTop: spacing.md },
  unavailableScreen: { flex: 1, backgroundColor: palette.wall, justifyContent: "center", paddingHorizontal: spacing.lg },
  unavailableBody: { marginTop: spacing.sm, color: palette.inkMuted },
  primaryLightButton: { alignSelf: "flex-start", minHeight: 48, justifyContent: "center", marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radii.control, overflow: "hidden" },
  pressed: { opacity: 0.58 },
});
