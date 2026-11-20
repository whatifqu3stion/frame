import InterestPicksReveal from "@/components/InterestPicksReveal";
import { interestPickWatchItem } from "@/domain/onboarding";
import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import PrimaryAction from "@/components/PrimaryAction";
import CollectionPrompt, { CollectionAction } from "@/components/CollectionPrompt";
import Text from "@/components/FrameText";
import CollectionNotice from "@/components/CollectionNotice";
import { motion } from "@/constants/motion";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import { sessionPosition } from "@/domain/sessionFlow";
import { boundedCollection } from "@/constants/layout";
import MotionView from "@/components/motion/MotionView";
import PositionedRow from "@/components/motion/PositionedRow";
import { useFeedback } from "@/hooks/useFeedback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, CloudOff, RotateCcw, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { notifyUser } from "@/services/notifyUser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import ViewingTime from "@/components/ViewingTime";
import SnoozeModal from "@/components/SnoozeModal";
import TodaySessionModal from "@/components/TodaySessionModal";
import TodayVideoCard from "@/components/TodayVideoCard";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { isMetadataCurrent } from "@/domain/metadataRetention";
import { getTodayPeriod, nextSnoozedReturn, performTodayAction, visibleTodayItems } from "@/domain/today";
import { todayFeedbackReducer, todayFeedbackRoute } from "@/domain/todayFeedback";
import type { TodayDisposition, TodaySnapshotItem, TodaySourceRule } from "@/models/today";
import { useApp } from "@/providers/AppProvider";
import { todayRepository } from "@/repositories/todayRepository";
import { todayService } from "@/services/todayServiceInstance";
import { listTodaySourceRules } from "@/db/database";

export default function TodayScreen() {
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { bottomBarHeight } = useNavigationLayout();
  const [noticeHeight, setNoticeHeight] = useState(0);
  const queryClient = useQueryClient();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { prefs, interests, activeProfileId, activeProfile, followedChannels, sourcesLoading, sessions, saveVideo, updateSessionVideos, createSession, requirePurchase, getPlaybackAllowance, getManagedContentOverview, ready, profileSwitching, sourcesError, refreshLibrary } = useApp();
  const { picksFor } = useLocalSearchParams<{ picksFor?: string }>();
  const keyStatus = useProviderKeyStatus();
  const scroll = useRef<ScrollView>(null);
  const [clock, setClock] = useState<number>(Date.now());
  const actionLock = useRef(false);
  const handledHere = useRef(false);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [feedbackState, dispatchFeedback] = useReducer(todayFeedbackReducer, null);
  const notice = feedbackState?.profileId === activeProfileId ? feedbackState : null;
  const dismissCollectionNotice = useCallback(() => {
    if (notice) dispatchFeedback({ type: "expireCollection", notice });
  }, [notice]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<TodaySnapshotItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sessionItem, setSessionItem] = useState<TodaySnapshotItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const checkedPeriodRef = useRef<string | null>(null);
  const activeProfileRef = useRef<string>(activeProfileId);
  activeProfileRef.current = activeProfileId;
  const period = getTodayPeriod(clock);
  const currentSession = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).find((session) => session.orderedVideoIds.length > 0 && sessionPosition(session) < session.orderedVideoIds.length);
  const managedContentQuery = useQuery({
    queryKey: ["managed-content", activeProfileId], networkMode: "always",
    queryFn: () => getManagedContentOverview(activeProfileId),
    enabled: ready && activeProfile?.role === "managed",
    staleTime: Infinity,
  });
  const managedOverview = activeProfile?.role === "managed" ? managedContentQuery.data ?? null : null;
  const sourceIds = useMemo<string[]>(() => {
    if (activeProfile?.role !== "managed") return followedChannels.map((source) => source.id);
    if (!managedOverview || managedOverview.policy.mode === "selectedVideos") return [];
    const approved = new Set(managedOverview.approvedSources.map((source) => source.id));
    return followedChannels.filter((source) => approved.has(source.id)).map((source) => source.id);
  }, [activeProfile?.role, followedChannels, managedOverview]);
  const sourceIdentity = [...sourceIds].sort().join(",");
  const queryKey = useMemo(() => ["today", activeProfileId, period.key, sourceIdentity] as const, [activeProfileId, period.key, sourceIdentity]);
  const rulesQuery = useQuery({ queryKey: ["today-rules", activeProfileId], networkMode: "always", queryFn: () => listTodaySourceRules(activeProfileId), enabled: ready, staleTime: Infinity });
  const rules = useMemo<Map<string, TodaySourceRule>>(() => new Map((rulesQuery.data ?? []).map((rule) => [rule.sourceId, rule])), [rulesQuery.data]);
  const sourcesReady = ready && !sourcesLoading && !sourcesError && (activeProfile?.role !== "managed" || managedContentQuery.isSuccess);
  const todayQuery = useQuery({
    queryKey,
    networkMode: "always",
    queryFn: () => todayService.load({ maxItems: prefs.todayVideoCount, profileId: activeProfileId, followedSourceIds: sourceIds, periodAt: clock }),
    enabled: sourcesReady,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const snapshot = todayQuery.data?.snapshot ?? null;
  // Query completion can precede the next minute tick. Evaluate new items at read time.
  const readAt = Date.now();
  const visible = visibleTodayItems(snapshot?.items ?? [], new Set(sourceIds), rules, readAt);
  const nextReturn = nextSnoozedReturn(snapshot?.items ?? [], clock);
  const hasExpiredPending = snapshot?.items.some((item) => ["pending", "snoozed"].includes(item.disposition) && !isMetadataCurrent(item.fetchedAt, readAt)) ?? false;

  useEffect(() => {
    dispatchFeedback({ type: "clear" });
    setSnoozeItem(null); setSessionItem(null); setActionError(null);
  }, [activeProfileId]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkKey = snapshot ? `${activeProfileId}:${period.key}:${sourceIdentity}` : null;
    if (!sourcesReady || !checkKey || checkedPeriodRef.current === checkKey) return;
    checkedPeriodRef.current = checkKey;
    const expectedProfile = activeProfileId;
    void todayService.load({ maxItems: prefs.todayVideoCount, profileId: expectedProfile, followedSourceIds: sourceIds, refreshExisting: true }).then((result) => {
      if (activeProfileRef.current === expectedProfile) queryClient.setQueryData(queryKey, result);
    }).catch(() => {});
  }, [activeProfileId, period.key, queryClient, queryKey, snapshot, sourceIdentity, sourceIds, sourcesReady, prefs.todayVideoCount]);

  const reloadLocal = useCallback(async (): Promise<void> => {
    const result = await todayService.load({ maxItems: prefs.todayVideoCount, profileId: activeProfileId, followedSourceIds: sourceIds });
    if (activeProfileRef.current === activeProfileId) queryClient.setQueryData(queryKey, result);
  }, [activeProfileId, queryClient, queryKey, sourceIds, prefs.todayVideoCount]);

  const refresh = useCallback(async (): Promise<void> => {
    if (isRefreshing || !sourcesReady) return;
    setIsRefreshing(true);
    const expectedProfile = activeProfileId;
    try {
      const result = await todayService.load({ maxItems: prefs.todayVideoCount, profileId: expectedProfile, followedSourceIds: sourceIds, refreshExisting: true });
      if (activeProfileRef.current === expectedProfile) queryClient.setQueryData(queryKey, result);
    } catch { notifyUser("Couldn’t refresh Today", "Check your connection and try again."); } finally {
      if (activeProfileRef.current === expectedProfile) setIsRefreshing(false);
    }
  }, [activeProfileId, isRefreshing, queryClient, queryKey, sourceIds, sourcesReady, prefs.todayVideoCount]);

  const handle = useCallback(async (item: TodaySnapshotItem, disposition: TodayDisposition, snoozedUntil: number | null = null): Promise<boolean> => {
    if (profileSwitching || activeProfileRef.current !== activeProfileId || item.profileId !== activeProfileId) return false;
    const changed = await todayRepository.setDisposition(activeProfileId, item.periodKey, item.id, disposition, Date.now(), snoozedUntil);
    if (changed) { handledHere.current = true; await reloadLocal(); }
    return changed;
  }, [activeProfileId, reloadLocal, profileSwitching]);

  const watch = useCallback(async (item: TodaySnapshotItem): Promise<void> => {
    if (actionLock.current || !requirePurchase("library")) return;
    actionLock.current = true;
    dispatchFeedback({ type: "clear" });
    setBusyId(item.id);
    try {
      const allowance = await getPlaybackAllowance(activeProfileId);
      if (activeProfileRef.current !== activeProfileId || profileSwitching) return;
      if (!allowance.canPlay) {
        const title = allowance.kind === "restricted" ? "Playback isn’t available now" : allowance.kind === "ownerReview" ? "Owner review needed" : "Today’s viewing is complete";
        const message = allowance.kind === "restricted" || allowance.kind === "ownerReview" ? allowance.reason : "You’ve reached today’s viewing limit. You can still save videos, plan a session, or organize Today.";
        notifyUser(title, message);
        return;
      }
      router.push({ pathname: FRAME_PLAYBACK_ROUTE, params: { id: item.id, title: item.title, channelId: item.sourceId, channelTitle: item.sourceTitle, thumbnailUrl: item.thumbnailUrl, publishedAt: item.publishedAt, durationSeconds: String(item.durationSeconds), cachedMetadata: "1", fetchedAt: String(item.fetchedAt), origin: "today", todayProfileId: activeProfileId, todayPeriodKey: item.periodKey } });
    } catch {
      notifyUser("Couldn’t open video", "The player did not open. This item is still in Today.");
    } finally { actionLock.current = false; setBusyId(null); }
  }, [activeProfileId, getPlaybackAllowance, requirePurchase, profileSwitching]);

  const save = useCallback(async (item: TodaySnapshotItem): Promise<void> => {
    if (actionLock.current || !requirePurchase("save")) return;
    actionLock.current = true;
    const done = feedback.capture();
    dispatchFeedback({ type: "clear" });
    setBusyId(item.id);
    try {
      const changed = await performTodayAction(async () => { await saveVideo(item); return true; }, () => handle(item, "saved"));
      if (!changed) return;
      dispatchFeedback({ type: "saved", profileId: item.profileId, videoId: item.id });
      done("commit");
    } catch { notifyUser("Couldn’t save", "Check Saved before trying again. If the video is missing, try saving it again."); }
    finally { actionLock.current = false; setBusyId(null); }
  }, [feedback, handle, requirePurchase, saveVideo]);

  const addToSession = useCallback(async (sessionId: string) => {
    const item = sessionItem;
    if (!item || actionLock.current || !requirePurchase("sessions")) return null;
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (!session || session.orderedVideoIds.includes(item.id) || session.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems) return null;
    actionLock.current = true;
    const done = feedback.capture();
    dispatchFeedback({ type: "clear" });
    setBusyId(item.id);
    try {
      const changed = await performTodayAction(async () => { await updateSessionVideos(session.id, [...session.orderedVideoIds, item.id]); return true; }, () => handle(item, "session"));
      if (!changed) return null;
      dispatchFeedback({ type: "session", profileId: item.profileId, sessionId: session.id, name: session.name });
      done("commit");
      return { id: session.id, name: session.name, count: session.orderedVideoIds.length + 1 };
    } catch { notifyUser("Couldn’t add to session", "Check your sessions in Saved before trying again."); return null; }
    finally { actionLock.current = false; setBusyId(null); }
  }, [feedback, handle, requirePurchase, sessionItem, sessions, updateSessionVideos]);

  const createTodaySession = useCallback(async (name: string) => {
    const item = sessionItem;
    if (!item || actionLock.current || !requirePurchase("sessions")) return null;
    actionLock.current = true;
    const done = feedback.capture();
    dispatchFeedback({ type: "clear" });
    setBusyId(item.id);
    try {
      const createdSession = await createSession(name, [item.id]);
      if (!createdSession) return null;
      const handled = await handle(item, "session");
      if (!handled) return null;
      dispatchFeedback({ type: "session", profileId: item.profileId, sessionId: createdSession.id, name: createdSession.name });
      done("commit");
      return { id: createdSession.id, name: createdSession.name, count: createdSession.orderedVideoIds.length };
    } catch { notifyUser("Couldn’t create session", "Check your sessions in Saved before trying again."); return null; }
    finally { actionLock.current = false; setBusyId(null); }
  }, [createSession, feedback, handle, requirePurchase, sessionItem]);

  const showMore = useCallback((item: TodaySnapshotItem): void => {
    if (actionLock.current) return;
    setActionError(null); setSnoozeItem(item);
  }, []);

  const dismiss = useCallback(async (): Promise<void> => {
    if (!snoozeItem || actionLock.current || profileSwitching) return;
    const item = snoozeItem;
    actionLock.current = true;
    setBusyId(item.id); setActionError(null);
    dispatchFeedback({ type: "clear" });
    try {
      const changed = await handle(item, "dismissed");
      if (activeProfileRef.current !== item.profileId) return;
      if (changed) { setSnoozeItem(null); dispatchFeedback({ type: "dismissed", item }); }
      else setActionError("This video has changed. Close these options and refresh Today.");
    } catch {
      if (activeProfileRef.current === item.profileId) setActionError("Couldn’t dismiss. Try again when you’re ready.");
    } finally { actionLock.current = false; setBusyId(null); }
  }, [handle, profileSwitching, snoozeItem]);

  const snooze = useCallback(async (until: number): Promise<void> => {
    if (!snoozeItem || actionLock.current || until <= Date.now()) return;
    const item = snoozeItem;
    const done = feedback.capture();
    actionLock.current = true;
    setBusyId(item.id);
    setActionError(null);
    dispatchFeedback({ type: "clear" });
    try {
      const changed = await handle(item, "snoozed", until);
      if (activeProfileRef.current !== item.profileId) return;
      if (changed) {
        done("commit");
        setSnoozeItem(null);
        dispatchFeedback({ type: "snoozed", profileId: item.profileId, videoId: item.id, until });
      } else setActionError("This video has changed. Close these options and refresh Today.");
    } catch { if (activeProfileRef.current === item.profileId) setActionError("Couldn’t snooze. Try again when you’re ready."); }
    finally { actionLock.current = false; setBusyId(null); }
  }, [feedback, handle, snoozeItem]);

  const undoDismiss = useCallback(async (): Promise<void> => {
    if (notice?.action !== "undoDismiss" || actionLock.current || profileSwitching) return;
    const undo = notice.target;
    const done = feedback.capture();
    actionLock.current = true;
    setBusyId(undo.item.id);
    try {
      const restored = await todayRepository.setDisposition(activeProfileId, undo.item.periodKey, undo.item.id, undo.previous, Date.now(), undo.snoozedUntil, "dismissed");
      if (restored) { setRestoredId(undo.item.id); done("commit"); dispatchFeedback({ type: "clear" }); await reloadLocal(); AccessibilityInfo.announceForAccessibility("Video restored to Today."); }
    } catch { notifyUser("Couldn’t undo", "Try again when you’re ready."); }
    finally { actionLock.current = false; setBusyId(null); }
  }, [activeProfileId, feedback, notice, profileSwitching, reloadLocal]);

  const compactHeader = sourceIds.length > 0 || Boolean(managedOverview?.approvedVideos.length);
  const isOffline = todayQuery.data?.state === "network_error";
  const status = isRefreshing ? "Refreshing…" : snapshot && isOffline ? "Offline · showing saved selection" : snapshot && (snapshot.freshness === "stale" || snapshot.freshness === "offline") ? "Showing saved selection · refresh delayed" : null;
  const hasOnlySnoozed = Boolean(snapshot && visible.length === 0 && nextReturn !== null);
  const initialLoading = rulesQuery.isLoading || (activeProfile?.role === "managed" && managedContentQuery.isLoading) || (!snapshot && (sourcesLoading || todayQuery.isLoading));
  const showWeeklyPicks = sourcesReady && !profileSwitching && activeProfile?.role === "owner" && interests.length > 0
    && (picksFor === activeProfileId || !sourceIds.length);
  let showOpenSources = sourceIds.length > 0;
  let content;
  if (initialLoading) content = <VideoFeedSkeleton variant="full" count={3} accessibilityLabel="Loading today’s videos" />;
  else if (activeProfile?.role === "managed" && managedContentQuery.isError) content = <StateBlock title="Approvals couldn’t load" body="Try again to see this profile’s selection." action="Try again" onPress={() => { void managedContentQuery.refetch(); }} styles={styles} />;
  else if (sourcesError) content = <StateBlock title="Sources couldn’t load" body="Reload your sources to bring back your selection." action="Try again" onPress={() => { void refreshLibrary().catch(() => notifyUser("Sources unavailable", "Try again in a moment.")); }} styles={styles} />;
  else if (rulesQuery.isError) content = <StateBlock title="Selection settings couldn’t load" body="Try again before viewing today’s selection." action="Try again" onPress={() => { void rulesQuery.refetch(); }} styles={styles} />;
  else if (managedOverview?.policy.mode === "selectedVideos") {
    showOpenSources = managedOverview.approvedVideos.length > 0;
    content = showOpenSources
      ? managedOverview.approvedVideos.map((video) => <VideoCard key={video.id} video={video} variant="full" />)
      : <StateBlock title="No selected videos yet" body="Request a video for the Owner to review." action="Request a video" onPress={() => router.push({ pathname: "/(tabs)/sources", params: { requestVideo: "1" } })} styles={styles} success />;
  } else if (sourceIds.length === 0) {
    showOpenSources = !showWeeklyPicks;
    content = showWeeklyPicks ? null : activeProfile?.role === "managed"
      ? <StateBlock title="No approved sources yet" body="Ask the Owner to add or approve a source in Settings → Profiles & viewing limits." styles={styles} />
      : <CollectionPrompt caption="Follow a source to see videos here." />;
  } else if (sourceIds.filter((id) => (rules.get(id)?.mutedUntil ?? 0) <= Date.now()).length > PRODUCT_LIMITS.sourceFeedMaxSources) {
    showOpenSources = false;
    content = <StateBlock title="Choose 100 sources for Today" body="Keep extra sources in your library using their Include in Today setting. You don’t need to unfollow them." action="Manage sources" onPress={() => router.push("/(tabs)/sources")} styles={styles} />;
  } else if (sourceIds.length > 0 && sourceIds.every((id) => rules.get(id)?.mutedUntil === Number.MAX_SAFE_INTEGER) && visible.length === 0) content = <StateBlock title="Your sources are library only" body="Browse them in Sources, or include a source in Today from its channel page." styles={styles} />;
  else if (visible.length > 0) content = visible.map((item) => <PositionedRow transitionKey={visible.map((video) => video.id).join(",")} key={item.id}><MotionView enter={restoredId === item.id} distance={16} duration={motion.reorder}><TodayVideoCard item={item} busy={busyId === item.id} disabled={Boolean(busyId)} onWatch={() => { void watch(item); }} onSave={() => { void save(item); }} onSession={() => setSessionItem(item)} onMore={() => showMore(item)} /></MotionView></PositionedRow>);
  else if (hasOnlySnoozed) content = <StateBlock title="Snoozed for later" body={`Your next snoozed video returns ${new Date(nextReturn as number).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}.`} styles={styles} />;
  else if (hasExpiredPending) content = <StateBlock title="Details need refreshing" body="Some video details need updating. Refresh to try again. Your choices are saved." action={isRefreshing ? "Refreshing…" : "Refresh"} onPress={() => { void refresh(); }} busy={isRefreshing} styles={styles} />;
  else if (snapshot && snapshot.items.length > 0) content = <StateBlock gallery animateCompletion={handledHere.current} onPresented={() => { handledHere.current = false; }} title="You’re caught up" body="You’ve reached the end of today’s selection." styles={styles} success />;
  else if (todayQuery.data?.state === "empty" && !snapshot) content = <StateBlock title="No matching videos yet" body={todayQuery.data.message ?? "Check again for recent uploads from your sources."} action={isRefreshing ? "Checking…" : "Check again"} onPress={() => { void refresh(); }} busy={isRefreshing} styles={styles} />;
  else if (snapshot) content = <StateBlock gallery title="No new videos today" body="There are no videos from your sources that match your settings today. You can open a source directly below." styles={styles} success />;
  else if (activeProfile?.role === "owner" && keyStatus.isSuccess && keyStatus.data.available && !keyStatus.data.youtube) content = <StateBlock title="Connect YouTube" body="Use your YouTube key to load videos from the creators you follow." action="Connect YouTube" onPress={() => router.push("/settings/keys")} styles={styles} />;
  else if (todayQuery.data?.state === "network_error") content = <StateBlock title="Today is offline" body="Connect to the internet, then try again." action="Retry" onPress={() => { void refresh(); }} styles={styles} />;
  else if (todayQuery.data?.state === "no_cache") content = <StateBlock title="Your videos aren’t ready yet" body="Frame is still preparing videos from your sources. Try again later, or open a source directly below." action="Retry" onPress={() => { void refresh(); }} styles={styles} />;
  else content = <StateBlock title="Today couldn’t load" body={todayQuery.data?.message ?? "Check your connection and try again. Your sources and saved videos are still here."} action="Retry" onPress={() => { void refresh(); }} styles={styles} />;

  return (
    <View style={styles.screen}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + Math.max(120, notice ? noticeHeight + spacing.lg : 0) }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { void refresh(); }} tintColor={palette.accent} />}>
        <View style={styles.page}>
          <ScreenHeader editorial compact={compactHeader} eyebrow="Today" title="Today" />

          {showWeeklyPicks && <View style={styles.content}><InterestPicksReveal key={activeProfileId}
            interestIds={interests.map(topic => topic.id)}
            onChooseTopics={() => router.push("/settings/interests")}
            onSetUpKeys={() => router.push("/settings/keys")}
            onBrowse={() => scroll.current?.scrollTo({ y: 0, animated: false })}
            onWatch={pick => {
              if (!requirePurchase("library")) return;
              const video = interestPickWatchItem(pick, activeProfileId, Date.now());
              if (!video) { notifyUser("This pick is unavailable", "Its video details need to be refreshed."); return; }
              router.push({ pathname: FRAME_PLAYBACK_ROUTE, params: { id: video.id, title: video.title, channelId: video.sourceId, channelTitle: video.sourceTitle, thumbnailUrl: video.thumbnailUrl, durationSeconds: String(video.durationSeconds), publishedAt: video.publishedAt, fetchedAt: String(video.fetchedAt), cachedMetadata: "1" } });
            }} /></View>}
          {!initialLoading && activeProfile?.role !== "managed" && visible.length > 0 ? <Text style={styles.statusText} accessibilityLiveRegion="polite">{visible.length} {visible.length === 1 ? "video" : "videos"} in today’s selection</Text> : null}
          {status ? <View style={styles.status} accessibilityLiveRegion="polite">{isRefreshing ? <RotateCcw size={14} color={palette.inkMuted} /> : isOffline ? <CloudOff size={14} color={palette.inkMuted} /> : null}<Text style={styles.statusText}>{status}</Text></View> : null}
          {currentSession ? <Pressable onPress={() => router.push({ pathname: "/session/[id]", params: { id: currentSession.id } })} style={styles.boundaryRow} accessibilityRole="button"><View style={{ flex: 1 }}><Text style={styles.secondaryText}>Open {currentSession.name}</Text><Text style={styles.statusText}>Video {sessionPosition(currentSession) + 1} of {currentSession.orderedVideoIds.length}</Text></View><ArrowRight size={18} color={palette.active} /></Pressable> : null}
          {ready && !profileSwitching ? <ViewingTime key={activeProfileId} profileId={activeProfileId} /> : null}
          <View style={[styles.content, compactHeader && { marginTop: spacing.md }]}>{content}</View>
          {showOpenSources ? <CollectionAction label="Open Sources" onPress={() => router.push("/(tabs)/sources")} /> : null}
        </View>
      </ScrollView>
      {notice ? <View pointerEvents="box-none" style={{ position: "absolute", left: insets.left, right: insets.right, bottom: Math.max(insets.bottom, bottomBarHeight) + spacing.sm }}><View pointerEvents="box-none" style={styles.page} onLayout={(event) => setNoticeHeight(event.nativeEvent.layout.height)}>{notice.action === "viewSaved" || notice.action === "openSession" ? (
        !sessionItem && <CollectionNotice key={notice.action === "viewSaved" ? notice.target.videoId : notice.target.sessionId}
          message={notice.message} actionLabel={notice.action === "viewSaved" ? "View Saved" : "Open session"} onDismiss={dismissCollectionNotice}
          onOpen={() => {
            dismissCollectionNotice();
            if (notice.action === "viewSaved") router.push({ pathname: "/(tabs)/saved", params: { section: "videos", savedVideoId: notice.target.videoId, arrivalProfile: activeProfileId } });
            else { const route = todayFeedbackRoute(notice); if (route) router.push(route); }
          }} />
      ) : <MotionView enter distance={18} duration={motion.confirm} changeKey={notice.action === "undoDismiss" ? notice.target.item.id : notice.target.videoId} style={styles.undo} accessibilityLiveRegion="polite">
        <Text style={styles.undoText}>{notice.message}</Text>
        {notice.action === "undoDismiss" ? <Pressable disabled={Boolean(busyId)} onPress={() => { void undoDismiss(); }} style={styles.undoButton} accessibilityRole="button" accessibilityLabel="Undo previous dismissal"><RotateCcw size={15} color={palette.onDark} /><Text style={styles.undoButtonText}>Undo</Text></Pressable> : null}
        <Pressable onPress={() => dispatchFeedback({ type: "clear" })} style={styles.undoButton} accessibilityRole="button" accessibilityLabel="Dismiss message"><X size={18} color={palette.onDark} /></Pressable>
      </MotionView>}</View></View> : null}
      <SnoozeModal busy={Boolean(busyId)} visible={Boolean(snoozeItem) && snoozeItem?.profileId === activeProfileId && !profileSwitching} title={snoozeItem?.title ?? ""} error={actionError} onClose={() => setSnoozeItem(null)} onDismiss={dismiss} onSnooze={(until) => { void snooze(until); }} />
      {sessionItem?.profileId === activeProfileId && !profileSwitching && <TodaySessionModal key={sessionItem.id} title={sessionItem.title} videoId={sessionItem.id} busy={Boolean(busyId)} sessions={sessions} onClose={() => { setSessionItem(null); if (notice?.action === "openSession") dismissCollectionNotice(); }}
        onOpen={(id, addedVideoId) => { setSessionItem(null); dismissCollectionNotice(); router.push({ pathname: "/session/[id]", params: { id, addedVideoId } }); }} onPick={addToSession} onCreate={createTodaySession} />}
    </View>
  );
}

function StateBlock({ title, body, action, onPress, styles, success = false, busy = false, gallery = false, animateCompletion = false, onPresented }: { title: string; body: string; action?: string; onPress?: () => void; styles: ReturnType<typeof createStyles>; success?: boolean; busy?: boolean; gallery?: boolean; animateCompletion?: boolean; onPresented?(): void }) {
  return <View accessibilityLabel={title}><EmptyState gallery={gallery} compact={gallery && !success} complete={success} animateCompletion={animateCompletion} onPresented={onPresented} symbol={success ? "✓" : undefined} title={title} body={body} />{action && onPress ? <PrimaryAction depth={styles.primaryDepth} onPress={onPress} disabled={busy} accessibilityState={{ busy, disabled: busy }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} accessibilityRole="button"><Text style={styles.primaryButtonText}>{action}</Text><ArrowRight size={17} color="#FFFDF9" /></PrimaryAction> : null}</View>;
}
function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({ primaryDepth: palette.primaryButtonDepth, screen: { flex: 1, backgroundColor: "transparent" }, page: { ...boundedCollection, paddingHorizontal: spacing.page }, boundaryRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSoft }, status: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.sm }, statusText: { ...type.bodySoft, flex: 1, color: palette.inkMuted }, content: { marginTop: spacing.lg }, primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: -spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep }, primaryButtonText: { ...type.label, color: palette.onDark }, secondaryText: { ...type.label, color: palette.accent }, undo: { minHeight: 56, flexDirection: "row", columnGap: spacing.sm, alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep }, undoText: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingVertical: spacing.sm, ...type.label, color: palette.onDark }, undoButton: { minHeight: 48, flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingHorizontal: spacing.sm }, undoButtonText: { ...type.label, color: palette.onDark }, pressed: { opacity: 0.74 } });
}
