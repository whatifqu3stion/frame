import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { Bookmark, ChevronLeft, ChevronRight, ExternalLink, RotateCcw } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
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
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { palette, radii, spacing, type, watchPalette } from "@/constants/theme";
import { expireVideo } from "@/domain/metadataRetention";
import { nextSessionStep } from "@/domain/sessionFlow";
import { getResume } from "@/db/database";
import { todayRepository } from "@/repositories/todayRepository";
import { useApp } from "@/providers/AppProvider";
import { clearOrientationRequest, setOrientationRequest } from "@/services/orientation";
import { formatDuration, formatRelativeDate, getVideo, parseVideoChapters, type VideoChapter } from "@/services/youtube";
import type { ViewingAllowanceStatus, ViewingAllowanceWarning } from "@/models/viewingAllowance";
import type { ManagedContentAccessStatus } from "@/models/managedContentAccess";
import type { Video } from "@/types";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const PLAYER_TIMEOUT_MS = 18000;
const RESUME_WRITE_INTERVAL_MS = 15000;
const ALLOWANCE_CHECKPOINT_INTERVAL_MS = 15000;
const FINAL_PROGRESS_DELAY_MS = 250;
const KEEP_AWAKE_TAG = "frame-video-playback";
const LANDSCAPE_RAIL_WIDTH = 64;
const CONTROL_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;
const DARK_CONTROL_RIPPLE = { color: "rgba(250,249,246,0.16)", borderless: false } as const;
const LIGHT_CONTROL_RIPPLE = { color: "rgba(21,30,27,0.12)", borderless: false } as const;

type PendingAction = "retry" | "rewatch" | "save" | null;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function firstPositiveDuration(...values: (number | null | undefined)[]): number {
  return values.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ?? 0;
}

function formatAllowanceRemaining(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.ceil(seconds))} sec`;
  return `${Math.ceil(seconds / 60)} min`;
}

function playbackRemaining(status: ViewingAllowanceStatus): number | null {
  if (!status.canPlay) return null;
  const daily = status.kind === "limited" ? status.remainingSeconds : null;
  const session = status.sessionRemainingSeconds ?? null;
  if (daily === null) return session;
  if (session === null) return daily;
  return Math.min(daily, session);
}

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{
    id: string | string[];
    session?: string | string[];
    i?: string | string[];
    savedSessionId?: string | string[];
    sessionProfileId?: string | string[];
    title?: string | string[];
    channelId?: string | string[];
    channelTitle?: string | string[];
    thumbnailUrl?: string | string[];
    publishedAt?: string | string[];
    durationSeconds?: string | string[];
    description?: string | string[];
    madeForKids?: string | string[];
    cachedMetadata?: string | string[];
    fetchedAt?: string | string[];
    origin?: string | string[];
    todayProfileId?: string | string[];
    todayPeriodKey?: string | string[];
  }>();
  const id = firstParam(params.id) ?? "";
  const session = firstParam(params.session);
  const usesCachedMetadata = firstParam(params.cachedMetadata) === "1";
  const todayProfileId = firstParam(params.todayProfileId);
  const todayPeriodKey = firstParam(params.todayPeriodKey);
  const indexParam = firstParam(params.i);
  const {
    activeProfileId,
    activeProfile,
    savedVideos,
    sessions,
    updateSessionPosition,
    saveVideo,
    unsaveVideo,
    requirePurchase,
    canUseLibrary,
    recordResume,
    clearVideoResume,
    getPlaybackAllowance,
    beginAllowancePlayback,
    checkpointAllowancePlayback,
    stopAllowancePlayback,
    authorizeProtectedAction,
    getManagedContentAccess,
    getManagedContentOverview,
    requestManagedContentAccess,
    approveManagedContent,
  } = useApp();

  const savedSessionId = firstParam(params.savedSessionId);
  const sessionProfileId = firstParam(params.sessionProfileId);
  const savedSession = savedSessionId && sessionProfileId === activeProfileId ? sessions.find((candidate) => candidate.id === savedSessionId) : undefined;
  const invalidSavedSession = Boolean(savedSessionId && (!savedSession || sessionProfileId !== activeProfileId));
  const sessionIds = useMemo<string[]>(
    () => savedSessionId ? (savedSession?.orderedVideoIds ?? []).filter((candidate) => VIDEO_ID_PATTERN.test(candidate)).slice(0, PRODUCT_LIMITS.sessionDraftMaxItems) : (session ?? "").split(",").filter((candidate) => VIDEO_ID_PATTERN.test(candidate)).slice(0, PRODUCT_LIMITS.sessionDraftMaxItems),
    [savedSessionId, savedSession?.orderedVideoIds, session],
  );
  const sessionIndex = useMemo<number>(() => {
    if (savedSessionId) return sessionIds.indexOf(id);
    const requestedIndex = Number(indexParam ?? 0);
    const validIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < sessionIds.length && sessionIds[requestedIndex] === id
      ? requestedIndex
      : sessionIds.indexOf(id);
    return validIndex;
  }, [id, indexParam, savedSessionId, sessionIds]);
  const nextSessionId = sessionIndex >= 0 ? sessionIds[sessionIndex + 1] : undefined;
  const locallyStoredVideo = useQuery({
    queryKey: ["local-playback-video", activeProfileId, id],
    queryFn: () => todayRepository.getVideo(activeProfileId, id),
    enabled: Boolean(VIDEO_ID_PATTERN.test(id) && !savedVideos.some((candidate) => candidate.id === id)),
  });
  const isSession = sessionIds.length > 0;

  const baseVideo = useMemo<Video | undefined>(() => {
    const stored = savedVideos.find((candidate) => candidate.id === id) ?? locallyStoredVideo.data;
    if (stored) return stored;
    if (!VIDEO_ID_PATTERN.test(id)) return undefined;

    const routeDuration = Number(firstParam(params.durationSeconds) ?? 0);
    return {
      id,
      fetchedAt: Number(firstParam(params.fetchedAt) ?? 0),
      title: optionalText(firstParam(params.title)) || "YouTube video",
      channelId: optionalText(firstParam(params.channelId)),
      channelTitle: optionalText(firstParam(params.channelTitle)),
      thumbnailUrl: optionalText(firstParam(params.thumbnailUrl)),
      publishedAt: optionalText(firstParam(params.publishedAt)),
      description: optionalText(firstParam(params.description)).slice(0, 5_000),
      madeForKids: firstParam(params.madeForKids) === "1" ? true : firstParam(params.madeForKids) === "0" ? false : null,
      durationSeconds: Number.isFinite(routeDuration) && routeDuration > 0 ? routeDuration : 0,
    };
  }, [id, locallyStoredVideo.data, params.fetchedAt, params.channelId, params.channelTitle, params.description, params.madeForKids, params.durationSeconds, params.publishedAt, params.thumbnailUrl, params.title, savedVideos]);

  const [allowanceStatus, setAllowanceStatus] = useState<ViewingAllowanceStatus | null>(null);
  const [contentAccessStatus, setContentAccessStatus] = useState<ManagedContentAccessStatus | null>(null);
  const managedOverviewQuery = useQuery({
    queryKey: ["managed-content", activeProfileId],
    queryFn: () => getManagedContentOverview(activeProfileId),
    enabled: activeProfile?.role === "managed",
    staleTime: Infinity,
  });
  const managedMode = activeProfile?.role === "managed" ? managedOverviewQuery.data?.policy.mode ?? null : null;
  const hasLocallyTrustedMetadata = Boolean(savedVideos.some((candidate) => candidate.id === id) || locallyStoredVideo.data);
  const needsManagedSourceVerification = managedMode === "approvedSources" && !locallyStoredVideo.isLoading && !hasLocallyTrustedMetadata;

  const metadataQuery = useQuery({
    queryKey: ["video", id],
    queryFn: () => getVideo(id),
    enabled: VIDEO_ID_PATTERN.test(id) && allowanceStatus?.canPlay === true && (needsManagedSourceVerification || (contentAccessStatus?.canPlay === true && !usesCachedMetadata)),
    staleTime: 5 * 60_000,
  });
  const verifiedVideo = metadataQuery.data?.status === "success" ? metadataQuery.data.data : null;
  const accessVideo = needsManagedSourceVerification ? verifiedVideo ?? undefined : baseVideo;
  const [retentionClock, setRetentionClock] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setRetentionClock(Date.now()), 60_000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") setRetentionClock(Date.now()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const video = useMemo<Video | undefined>(() => {
    if (!baseVideo) return undefined;
    if (!verifiedVideo) return expireVideo(baseVideo, retentionClock);
    return expireVideo({ ...baseVideo, ...verifiedVideo, description: verifiedVideo.description ?? baseVideo.description }, retentionClock);
  }, [baseVideo, verifiedVideo, retentionClock]);

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
  const allowanceEndingRef = useRef<boolean>(false);
  const chapters = useMemo(() => parseVideoChapters(video?.description, firstPositiveDuration(playerDurationSeconds, video?.durationSeconds)), [playerDurationSeconds, video?.description, video?.durationSeconds]);
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(video?.durationSeconds ?? 0);
  const didEndRef = useRef<boolean>(false);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingActionRef = useRef<PendingAction>(null);
  const navigationLockedRef = useRef<boolean>(false);
  const isFullscreenRef = useRef<boolean>(false);
  const todayWatchedRef = useRef<boolean>(false);

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

  const showAllowanceWarning = useCallback((warning: ViewingAllowanceWarning | undefined): void => {
    if (!warning) return;
    Alert.alert(warning === "fiveMinutes" ? "Five minutes left" : "One minute left", warning === "fiveMinutes" ? "Five minutes of viewing time remain today." : "One minute of viewing time remains today.");
  }, []);

  const applyAllowanceStatus = useCallback((status: ViewingAllowanceStatus): void => {
    setAllowanceStatus(status);
    showAllowanceWarning(status.kind === "limited" ? status.warning : undefined);
  }, [showAllowanceWarning]);

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
    setAllowanceStatus(null);
    setContentAccessStatus(null);
    allowanceEndingRef.current = false;
    if (activeProfile?.role === "managed" && (managedOverviewQuery.isLoading || locallyStoredVideo.isLoading)) return () => { mounted = false; };
    if (activeProfile?.role === "managed" && managedOverviewQuery.isError) {
      setContentAccessStatus({ kind: "ownerReview", canPlay: false, reason: "Managed content access could not be verified. Ask the Owner to review it." });
      void getPlaybackAllowance().then((allowance) => { if (mounted) applyAllowanceStatus(allowance); }).catch(() => {
        if (mounted) setAllowanceStatus({ kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Daily Frame time needs Owner review before playback can continue." });
      });
    } else if (needsManagedSourceVerification && !accessVideo) {
      if (metadataQuery.isError || metadataQuery.data?.status && metadataQuery.data.status !== "success") {
        setContentAccessStatus({ kind: "ownerReview", canPlay: false, reason: "Frame could not verify this video's source. Return and try again when verification is available." });
      }
      void getPlaybackAllowance().then((allowance) => { if (mounted) applyAllowanceStatus(allowance); }).catch(() => {
        if (mounted) setAllowanceStatus({ kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Daily Frame time needs Owner review before playback can continue." });
      });
    } else if (!accessVideo) {
      setContentAccessStatus({ kind: "ownerReview", canPlay: false, reason: "This video needs Owner review before playback can continue." });
      setAllowanceStatus({ kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Daily Frame time needs Owner review before playback can continue." });
    } else {
      void Promise.all([getManagedContentAccess(accessVideo), getPlaybackAllowance()]).then(([access, allowance]) => {
        if (!mounted) return;
        setContentAccessStatus(access);
        applyAllowanceStatus(allowance);
      }).catch(() => {
        if (mounted) setContentAccessStatus({ kind: "ownerReview", canPlay: false, reason: "Managed content access needs Owner review before playback can continue." });
        if (mounted) setAllowanceStatus({ kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Daily Frame time needs Owner review before playback can continue." });
      });
    }
    return () => { mounted = false; void stopAllowancePlayback(); };
  }, [accessVideo, activeProfile?.role, activeProfileId, applyAllowanceStatus, getManagedContentAccess, getPlaybackAllowance, locallyStoredVideo.isLoading, managedOverviewQuery.isError, managedOverviewQuery.isLoading, metadataQuery.data, metadataQuery.isError, needsManagedSourceVerification, stopAllowancePlayback]);

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
    todayWatchedRef.current = false;

    if (!id || !canUseLibrary) {
      setResumeReady(true);
      return () => { mounted = false; };
    }
    getResume(activeProfileId, id)
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
  }, [activeProfileId, id, canUseLibrary, setAction, video?.durationSeconds]);

  const persist = useCallback((): Promise<void> => {
    if (!video || !canUseLibrary || didEndRef.current) return Promise.resolve();
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
  }, [canUseLibrary, recordResume, video]);

  const failClosedAllowance = useCallback((): void => {
    playerRef.current?.pause();
    setPlaybackState("paused");
    setAllowanceStatus({ kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Daily Frame time couldn’t be saved safely. Ask the Owner to review it before continuing." });
    void persist();
  }, [persist]);

  const pauseAndPersist = useCallback((): void => {
    playerRef.current?.requestProgress();
    playerRef.current?.pause();
    setPlaybackState((state) => state === "playing" ? "paused" : state);
    void stopAllowancePlayback().then((status) => { if (status) applyAllowanceStatus(status); }).catch(failClosedAllowance);
    void persist();
    setTimeout(() => { void persist(); }, FINAL_PROGRESS_DELAY_MS);
  }, [applyAllowanceStatus, failClosedAllowance, persist, stopAllowancePlayback]);

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
    if (playbackState !== "playing" || !playerReady || allowanceStatus?.canPlay !== true) return;
    const resumeInterval = setInterval(() => { void persist(); }, RESUME_WRITE_INTERVAL_MS);
    const allowanceInterval = setInterval(() => {
      if (!accessVideo) return;
      void getManagedContentAccess(accessVideo).then(async (access) => {
        setContentAccessStatus(access);
        if (!access.canPlay) {
          playerRef.current?.pause();
          await stopAllowancePlayback();
          void persist();
          return;
        }
        const status = await checkpointAllowancePlayback();
        applyAllowanceStatus(status);
        if (!status.canPlay) {
          playerRef.current?.pause();
          void persist();
        }
      }).catch(failClosedAllowance);
    }, ALLOWANCE_CHECKPOINT_INTERVAL_MS);
    const countdownInterval = setInterval(() => {
      setAllowanceStatus((current) => {
        if (!current?.canPlay) return current;
        const dailyRemaining = current.kind === "limited" ? Math.max(0, current.remainingSeconds - 1) : null;
        const sessionRemaining = current.sessionRemainingSeconds === undefined ? undefined : Math.max(0, current.sessionRemainingSeconds - 1);
        if ((dailyRemaining === 0 || sessionRemaining === 0) && !allowanceEndingRef.current) {
          allowanceEndingRef.current = true;
          playerRef.current?.pause();
          void stopAllowancePlayback().then((status) => { if (status) applyAllowanceStatus(status); }).catch(failClosedAllowance);
          void persist();
        }
        if (dailyRemaining === 0 && current.kind === "limited") {
          return { kind: "complete", canPlay: false, remainingSeconds: 0, allowanceMinutes: current.allowanceMinutes, ...(current.pendingChange ? { pendingChange: current.pendingChange } : {}) };
        }
        return current.kind === "limited"
          ? { ...current, remainingSeconds: dailyRemaining as number, ...(sessionRemaining === undefined ? {} : { sessionRemainingSeconds: sessionRemaining }) }
          : { ...current, ...(sessionRemaining === undefined ? {} : { sessionRemainingSeconds: sessionRemaining }) };
      });
    }, 1000);
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      clearInterval(resumeInterval);
      clearInterval(allowanceInterval);
      clearInterval(countdownInterval);
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [accessVideo, allowanceStatus?.canPlay, applyAllowanceStatus, checkpointAllowancePlayback, failClosedAllowance, getManagedContentAccess, persist, playbackState, playerReady, stopAllowancePlayback]);

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
    if (state === "playing") {
      allowanceEndingRef.current = false;
      if (!accessVideo) {
        playerRef.current?.pause();
        return;
      }
      void getManagedContentAccess(accessVideo).then(async (access) => {
        setContentAccessStatus(access);
        if (!access.canPlay) {
          allowanceEndingRef.current = true;
          playerRef.current?.pause();
          void persist();
          return;
        }
        const status = await beginAllowancePlayback();
        applyAllowanceStatus(status);
        if (!status.canPlay) {
          allowanceEndingRef.current = true;
          playerRef.current?.pause();
          void persist();
          return;
        }
        if (!todayWatchedRef.current && todayProfileId === activeProfileId && todayPeriodKey) {
          todayWatchedRef.current = true;
          void todayRepository.setDisposition(activeProfileId, todayPeriodKey, id, "watched", Date.now()).then((changed) => {
            if (changed) void queryClient.invalidateQueries({ queryKey: ["today", activeProfileId] });
          });
        }
      }).catch(failClosedAllowance);
      return;
    }
    void stopAllowancePlayback().then((status) => { if (status) applyAllowanceStatus(status); }).catch(failClosedAllowance);
    if (state === "paused") void persist();
  }, [accessVideo, activeProfileId, applyAllowanceStatus, beginAllowancePlayback, failClosedAllowance, getManagedContentAccess, id, persist, queryClient, stopAllowancePlayback, todayPeriodKey, todayProfileId]);

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
    void stopAllowancePlayback().then((status) => { if (status) applyAllowanceStatus(status); }).catch(failClosedAllowance);
    setAction(null);
    if (isFullscreenRef.current) leaveFullscreen();
    writeChainRef.current = writeChainRef.current
      .then(async () => {
        await clearVideoResume(video.id);
        if (savedSessionId && sessionIndex >= 0) await updateSessionPosition(savedSessionId, video.id, sessionIndex, nextSessionStep(sessionIds, sessionIndex));
      })
      .catch(() => {});
    void AccessibilityInfo.announceForAccessibility(isSession && nextSessionId ? "Video complete. Next video ready." : "Video complete.");
  }, [applyAllowanceStatus, clearVideoResume, failClosedAllowance, isSession, leaveFullscreen, nextSessionId, savedSessionId, sessionIds, sessionIndex, setAction, stopAllowancePlayback, updateSessionPosition, video]);

  const handlePlayerError = useCallback((error: YouTubePlayerError): void => {
    if (__DEV__) console.warn("[player] error", { id, code: error.code ?? null });
    playerRef.current?.requestProgress();
    playerRef.current?.pause();
    setPlaybackState("paused");
    setPlayerError(error);
    setAction(null);
    if (isFullscreenRef.current) leaveFullscreen();
    void stopAllowancePlayback().then((status) => { if (status) applyAllowanceStatus(status); }).catch(failClosedAllowance);
    void persist();
  }, [applyAllowanceStatus, failClosedAllowance, id, leaveFullscreen, persist, setAction, stopAllowancePlayback]);

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

  const playNext = useCallback(async (): Promise<void> => {
    if (!nextSessionId) { closePlayer(); return; }
    if (navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    haptic();
    pauseAndPersist();
    try {
      await writeChainRef.current;
      if (savedSessionId) {
        const moved = await updateSessionPosition(savedSessionId, id, sessionIndex, sessionIndex + 1);
        if (!moved) throw new Error("Session changed");
      }
      setResumeReady(false);
      setPlayerReady(false);
      setPlayerError(null);
      router.replace({
        pathname: FRAME_PLAYBACK_ROUTE,
        params: savedSessionId ? { id: nextSessionId, savedSessionId, sessionProfileId: activeProfileId, cachedMetadata: "1" } : { id: nextSessionId, session: sessionIds.join(","), i: String(sessionIndex + 1) },
      });
    } catch {
      navigationLockedRef.current = false;
      Alert.alert("Couldn’t continue", "Your next video is still in the Session. Open it from Saved when you’re ready.");
    }
  }, [activeProfileId, closePlayer, haptic, id, nextSessionId, pauseAndPersist, savedSessionId, sessionIds, sessionIndex, updateSessionPosition]);

  const rewatch = useCallback(async (): Promise<void> => {
    if (!beginAction("rewatch")) return;
    try {
      await writeChainRef.current;
      if (savedSessionId && sessionIndex >= 0) {
        const moved = await updateSessionPosition(savedSessionId, id, sessionIndex, sessionIndex);
        if (!moved) throw new Error("Session changed");
      }
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      didEndRef.current = false;
      currentTimeRef.current = 0;
      setPlaybackState("playing");
      playerRef.current?.seekTo(0);
      playerRef.current?.play();
    } catch { Alert.alert("Couldn’t restart", "Your place is still saved in the Session."); }
    finally { setAction(null); }
  }, [beginAction, haptic, id, savedSessionId, sessionIndex, setAction, updateSessionPosition]);

  const goToToday = useCallback((): void => {
    pauseAndPersist();
    router.replace("/(tabs)");
  }, [pauseAndPersist]);

  const goToSaved = useCallback((): void => {
    pauseAndPersist();
    router.replace("/(tabs)/saved");
  }, [pauseAndPersist]);

  const openExternal = useCallback(async (url: string): Promise<void> => {
    if (!await authorizeProtectedAction(activeProfileId)) return;
    try {
      await Linking.openURL(url);
    } catch {
      void AccessibilityInfo.announceForAccessibility("Couldn’t open YouTube.");
    }
  }, [activeProfileId, authorizeProtectedAction]);

  const openInYouTube = useCallback((): void => {
    haptic();
    void openExternal(`https://www.youtube.com/watch?v=${id}`);
  }, [haptic, id, openExternal]);

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

  const requestAccess = useCallback(async (): Promise<void> => {
    if (!accessVideo) return;
    const result = await requestManagedContentAccess(accessVideo);
    Alert.alert(result.ok ? "Request saved" : "Couldn’t request access", result.message);
  }, [accessVideo, requestManagedContentAccess]);

  const ownerApproveAccess = useCallback(async (): Promise<void> => {
    if (!accessVideo) return;
    const result = await approveManagedContent(accessVideo);
    if (!result.ok) {
      Alert.alert("Approval not completed", result.message);
      return;
    }
    const access = await getManagedContentAccess(accessVideo);
    setContentAccessStatus(access);
    Alert.alert("Approved", result.message);
  }, [accessVideo, approveManagedContent, getManagedContentAccess]);

  if (!video || invalidSavedSession || (savedSessionId && sessionIndex < 0)) {
    return (
      <View style={[styles.unavailableScreen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
        <StatusBar style="dark" />
        <Text style={type.heading}>Video unavailable</Text>
        <Text style={[type.bodySoft, styles.unavailableBody]}>This link is incomplete, the Session changed, or it belongs to another profile.</Text>
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
  const contentBlocked = contentAccessStatus !== null && !contentAccessStatus.canPlay;
  const allowanceBlocked = allowanceStatus !== null && !allowanceStatus.canPlay;
  const shouldMountPlayer = resumeReady && contentAccessStatus?.canPlay === true && allowanceStatus?.canPlay === true && isScreenFocused && isAppActive && !showEnded && !playerError;
  const showPlayer = shouldMountPlayer && playerReady && !playerError;
  const playerBusy = pendingAction === "retry";
  const hasMessage = contentBlocked || allowanceBlocked || Boolean(playerError) || showEnded;

  const stage = (
    <View style={[styles.playerStage, hasMessage && styles.messageStage]}>
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
            onOpenExternal={openExternal}
          />
        </View>
      ) : null}

      {contentBlocked ? (
        <View style={styles.stateSurface} accessibilityLiveRegion="polite">
          <Text style={styles.endEyebrow}>Managed content access</Text>
          <Text style={styles.endTitle}>{contentAccessStatus.kind === "ownerReview" ? "Owner review needed." : contentAccessStatus.kind === "videoApprovalRequired" ? "This video needs approval." : "This source needs approval."}</Text>
          <Text style={styles.allowanceBody}>{contentAccessStatus.reason}</Text>
          <View style={styles.stateActions}>
            {contentAccessStatus.kind !== "ownerReview" ? <Pressable onPress={() => { void requestAccess(); }} style={styles.darkOutlineButton} accessibilityRole="button"><Text style={styles.darkButtonText}>Request</Text></Pressable> : null}
            {contentAccessStatus.kind !== "ownerReview" ? <Pressable onPress={() => { void ownerApproveAccess(); }} style={styles.lightStateButton} accessibilityRole="button"><Text style={styles.lightButtonText}>Owner approve</Text></Pressable> : null}
          </View>
          <Pressable onPress={goToToday} style={styles.skipButton} accessibilityRole="button"><Text style={styles.skipButtonText}>Return to Today</Text></Pressable>
        </View>
      ) : allowanceBlocked ? (
        <View style={styles.stateSurface} accessibilityLiveRegion="polite">
          <Text style={styles.endEyebrow}>{allowanceStatus.kind === "restricted" ? "Managed playback controls" : "Daily viewing allowance"}</Text>
          <Text style={styles.endTitle}>{allowanceStatus.kind === "ownerReview" ? "Owner review needed." : allowanceStatus.kind === "restricted" ? "Playback isn’t available now." : "Today’s viewing is complete."}</Text>
          <Text style={styles.allowanceBody}>{allowanceStatus.kind === "ownerReview" || allowanceStatus.kind === "restricted" ? allowanceStatus.reason : "Your Frame playback place is saved. Settings and the rest of Frame remain available."}</Text>
          <View style={styles.stateActions}>
            <Pressable onPress={goToToday} style={styles.darkOutlineButton} accessibilityRole="button"><Text style={styles.darkButtonText}>Today</Text></Pressable>
            <Pressable onPress={goToSaved} style={styles.lightStateButton} accessibilityRole="button"><Text style={styles.lightButtonText}>Saved</Text></Pressable>
          </View>
        </View>
      ) : null}

      {!contentBlocked && !allowanceBlocked && (!playerReady || allowanceStatus === null || contentAccessStatus === null) && !playerError ? (
        <View style={[styles.stateSurface, StyleSheet.absoluteFillObject]} accessible accessibilityRole="progressbar" accessibilityLabel={resumeReady ? "Preparing video" : "Finding your place"}>
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
            <Pressable onPress={() => { void playNext(); }} hitSlop={CONTROL_HIT_SLOP} android_ripple={LIGHT_CONTROL_RIPPLE} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]} accessibilityRole="button" testID="session-skip">
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
          <Text style={styles.endTitle} accessibilityRole="header">{nextSessionId ? "One done. Pause here?" : "That’s it."}</Text>
          <Text style={styles.allowanceBody}>{nextSessionId ? "The next video waits until you choose Continue." : "Nothing plays next. Stop here whenever you’re ready."}</Text>
          <View style={styles.stateActions}>
            <Pressable onPress={() => { void rewatch(); }} hitSlop={CONTROL_HIT_SLOP} android_ripple={DARK_CONTROL_RIPPLE} style={({ pressed }) => [styles.darkOutlineButton, pressed && styles.pressed]} accessibilityRole="button" testID="rewatch">
              <RotateCcw size={15} color={palette.wall} />
              <Text style={styles.darkButtonText}>Watch again</Text>
            </Pressable>
            <Pressable onPress={nextSessionId ? playNext : closePlayer} hitSlop={CONTROL_HIT_SLOP} android_ripple={LIGHT_CONTROL_RIPPLE} style={({ pressed }) => [styles.lightStateButton, pressed && styles.pressed]} accessibilityRole="button" testID={nextSessionId ? "session-next" : "watch-done"}>
              <Text style={styles.lightButtonText}>{nextSessionId ? "Continue" : "Done for now"}</Text>
              {nextSessionId ? <ChevronRight size={15} color={palette.ink} /> : null}
            </Pressable>
          </View>
          {nextSessionId ? <Pressable onPress={closePlayer} style={styles.darkOutlineButton} accessibilityRole="button"><Text style={styles.darkButtonText}>Done for now</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );

  if (hasMessage) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
        <StatusBar style="light" />
        <Pressable onPress={closePlayer} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close video" testID="watch-back"><ChevronLeft size={22} color={watchPalette.ink} /><Text style={styles.closeLabel}>Close</Text></Pressable>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: insets.bottom + spacing.lg }} showsVerticalScrollIndicator>{stage}<View style={styles.content}>
        {video.channelTitle ? <Text style={[type.caption, { color: watchPalette.inkSoft }]}>{video.channelTitle}</Text> : null}
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
        </View>

        </View></ScrollView>
      </View>
    );
  }

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
          {allowanceStatus && playbackRemaining(allowanceStatus) !== null ? <Text style={styles.landscapeAllowance}>{formatAllowanceRemaining(playbackRemaining(allowanceStatus) as number)}</Text> : null}
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
        {allowanceStatus && playbackRemaining(allowanceStatus) !== null ? <Text style={styles.fullscreenStatus} accessibilityLiveRegion="polite">{formatAllowanceRemaining(playbackRemaining(allowanceStatus) as number)} viewing time</Text> : isOnline === false ? <Text style={styles.fullscreenStatus} accessibilityLiveRegion="polite">Offline</Text> : isFullscreen ? <Text style={styles.fullscreenStatus}>Fullscreen</Text> : null}
      </View>

      <View style={[styles.portraitPlayerArea, { height: portraitPlayerHeight }]}>
        <View style={{ width: portraitPlayerWidth, height: portraitPlayerHeight }}>{stage}</View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {video.channelTitle ? <Text style={[type.caption, { color: watchPalette.inkSoft }]}>{video.channelTitle}</Text> : null}
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
        </View>

        {!showEnded ? <VideoChapters chapters={chapters} currentSeconds={currentSeconds} onJump={jumpToChapter} disabled={!showPlayer} /> : null}

        {video.description ? (
          <View style={styles.notes}>
            <Text style={[type.caption, { color: watchPalette.inkSoft }]}>About</Text>
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
            <Text style={[type.caption, { color: watchPalette.inkSoft }]}>Channel</Text>
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
  portraitPlayerArea: { width: "100%", backgroundColor: watchPalette.stage, alignItems: "center" },
  playerStage: { width: "100%", height: "100%", backgroundColor: watchPalette.stage, overflow: "hidden" },
  playerEmbed: { ...StyleSheet.absoluteFillObject, backgroundColor: watchPalette.stage },
  playerEmbedHidden: { opacity: 0 },
  messageStage: { height: "auto", overflow: "visible" },
  stateSurface: {
    backgroundColor: watchPalette.wall,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  playerStatusText: { ...type.bodySoft, color: "rgba(250,249,246,0.72)", marginTop: spacing.md },
  errorTitle: { ...type.heading, color: palette.wall, textAlign: "center" },
  errorBody: { ...type.bodySoft, color: "rgba(250,249,246,0.72)", textAlign: "center", marginTop: spacing.sm, maxWidth: 360 },
  allowanceBody: { ...type.bodySoft, color: "rgba(250,249,246,0.72)", textAlign: "center", marginTop: spacing.sm, maxWidth: 380 },
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
  landscapeAllowance: { ...type.caption, color: palette.wall, fontSize: 10, textAlign: "center", marginTop: spacing.md, width: 56 },
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

