import { motion } from "@/constants/motion";
import MotionView from "@/components/motion/MotionView";
import PositionedRow from "@/components/motion/PositionedRow";
import { useFeedback } from "@/hooks/useFeedback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowRight, CircleCheck, CloudOff, RotateCcw, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import SnoozeModal from "@/components/SnoozeModal";
import TodaySessionModal from "@/components/TodaySessionModal";
import TodayVideoCard from "@/components/TodayVideoCard";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { MAX_ITEMS_PER_SOURCE, PRODUCT_LIMITS, TODAY_MAX_ITEMS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { isMetadataCurrent } from "@/domain/metadataRetention";
import { getTodayPeriod, nextSnoozedReturn, performTodayAction, visibleTodayItems } from "@/domain/today";
import type { TodayDisposition, TodaySnapshotItem, TodaySourceRule } from "@/models/today";
import { useApp } from "@/providers/AppProvider";
import { todayRepository } from "@/repositories/todayRepository";
import { todayService } from "@/services/todayServiceInstance";
import { listTodaySourceRules } from "@/db/database";

export default function TodayScreen() {
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, activeProfile, followedChannels, sourcesLoading, sessions, saveVideo, updateSessionVideos, createSession, requirePurchase, getPlaybackAllowance, getManagedContentOverview, ready, profileSwitching } = useApp();
  const [clock, setClock] = useState<number>(Date.now());
  const actionLock = useRef(false);
  const handledHere = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<TodaySnapshotItem | null>(null);
  const [sessionItem, setSessionItem] = useState<TodaySnapshotItem | null>(null);
  const [undo, setUndo] = useState<{ item: TodaySnapshotItem; previous: TodayDisposition; snoozedUntil: number | null } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const checkedPeriodRef = useRef<string | null>(null);
  const activeProfileRef = useRef<string>(activeProfileId);
  activeProfileRef.current = activeProfileId;
  const period = getTodayPeriod(clock);
  const managedContentQuery = useQuery({
    queryKey: ["managed-content", activeProfileId],
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
  const sourceIdentity = sourceIds.join(",");
  const queryKey = useMemo(() => ["today", activeProfileId, period.key] as const, [activeProfileId, period.key]);
  const rulesQuery = useQuery({ queryKey: ["today-rules", activeProfileId], queryFn: () => listTodaySourceRules(activeProfileId), enabled: ready, staleTime: Infinity });
  const rules = useMemo<Map<string, TodaySourceRule>>(() => new Map((rulesQuery.data ?? []).map((rule) => [rule.sourceId, rule])), [rulesQuery.data]);
  const todayQuery = useQuery({
    queryKey,
    queryFn: () => todayService.load({ profileId: activeProfileId, followedSourceIds: sourceIds, now: clock }),
    enabled: ready && !sourcesLoading,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const snapshot = todayQuery.data?.snapshot ?? null;
  const visible = useMemo(() => visibleTodayItems(snapshot?.items ?? [], new Set(sourceIds), rules, clock), [clock, rules, snapshot?.items, sourceIds]);
  const nextReturn = nextSnoozedReturn(snapshot?.items ?? [], clock);
  const hasExpiredPending = snapshot?.items.some((item) => ["pending", "snoozed"].includes(item.disposition) && !isMetadataCurrent(item.fetchedAt, clock)) ?? false;

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkKey = snapshot ? `${activeProfileId}:${period.key}:${sourceIdentity}` : null;
    if (!checkKey || checkedPeriodRef.current === checkKey) return;
    checkedPeriodRef.current = checkKey;
    const expectedProfile = activeProfileId;
    void todayService.load({ profileId: expectedProfile, followedSourceIds: sourceIds, now: Date.now(), refreshExisting: true }).then((result) => {
      if (activeProfileRef.current === expectedProfile) queryClient.setQueryData(queryKey, result);
    }).catch(() => {});
  }, [activeProfileId, period.key, queryClient, queryKey, snapshot, sourceIdentity, sourceIds]);

  const reloadLocal = useCallback(async (): Promise<void> => {
    const result = await todayService.load({ profileId: activeProfileId, followedSourceIds: sourceIds, now: Date.now() });
    if (activeProfileRef.current === activeProfileId) queryClient.setQueryData(queryKey, result);
  }, [activeProfileId, queryClient, queryKey, sourceIds]);

  const refresh = useCallback(async (): Promise<void> => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const expectedProfile = activeProfileId;
    try {
      const result = await todayService.load({ profileId: expectedProfile, followedSourceIds: sourceIds, now: Date.now(), refreshExisting: Boolean(snapshot) });
      if (activeProfileRef.current === expectedProfile) queryClient.setQueryData(queryKey, result);
    } catch { Alert.alert("Couldn’t refresh Today", "Check your connection and try again."); } finally {
      if (activeProfileRef.current === expectedProfile) setIsRefreshing(false);
    }
  }, [activeProfileId, isRefreshing, queryClient, queryKey, snapshot, sourceIds]);

  const handle = useCallback(async (item: TodaySnapshotItem, disposition: TodayDisposition, snoozedUntil: number | null = null): Promise<boolean> => {
    if (profileSwitching || activeProfileRef.current !== activeProfileId || item.profileId !== activeProfileId) return false;
    const changed = await todayRepository.setDisposition(activeProfileId, item.periodKey, item.id, disposition, Date.now(), snoozedUntil);
    if (changed) { handledHere.current = true; await reloadLocal(); }
    return changed;
  }, [activeProfileId, reloadLocal, profileSwitching]);

  const watch = useCallback(async (item: TodaySnapshotItem): Promise<void> => {
    if (actionLock.current || !requirePurchase("library")) return;
    actionLock.current = true;
    setNotice(null);
    setBusyId(item.id);
    try {
      const allowance = await getPlaybackAllowance(activeProfileId);
      if (activeProfileRef.current !== activeProfileId || profileSwitching) return;
      if (!allowance.canPlay) {
        const title = allowance.kind === "restricted" ? "Playback isn’t available now" : allowance.kind === "ownerReview" ? "Owner review needed" : "Today’s viewing is complete";
        const message = allowance.kind === "restricted" || allowance.kind === "ownerReview" ? allowance.reason : "You’ve reached today’s viewing limit. You can still save videos, plan a session, or organize Today.";
        Alert.alert(title, message);
        return;
      }
      router.push({ pathname: FRAME_PLAYBACK_ROUTE, params: { id: item.id, title: item.title, channelId: item.sourceId, channelTitle: item.sourceTitle, thumbnailUrl: item.thumbnailUrl, publishedAt: item.publishedAt, durationSeconds: String(item.durationSeconds), cachedMetadata: "1", fetchedAt: String(item.fetchedAt), origin: "today", todayProfileId: activeProfileId, todayPeriodKey: item.periodKey } });
    } catch {
      Alert.alert("Couldn’t open video", "The player did not open. This item is still in Today.");
    } finally { actionLock.current = false; setBusyId(null); }
  }, [activeProfileId, getPlaybackAllowance, requirePurchase, profileSwitching]);

  const save = useCallback(async (item: TodaySnapshotItem): Promise<void> => {
    if (actionLock.current || !requirePurchase("save")) return;
    actionLock.current = true;
    const done = feedback.capture();
    setNotice(null);
    setBusyId(item.id);
    try {
      const changed = await performTodayAction(async () => { await saveVideo(item); return true; }, () => handle(item, "saved"));
      if (!changed) return;
      setNotice("Video saved");
      done("commit");
    } catch { Alert.alert("Couldn’t save", "Check Saved before trying again. If the video is missing, try saving it again."); }
    finally { actionLock.current = false; setBusyId(null); }
  }, [feedback, handle, requirePurchase, saveVideo]);

  const addToSession = useCallback(async (sessionId: string): Promise<void> => {
    const item = sessionItem;
    if (!item || actionLock.current || !requirePurchase("sessions")) return;
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (!session || session.orderedVideoIds.includes(item.id) || session.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems) return;
    actionLock.current = true;
    const done = feedback.capture();
    setNotice(null);
    setBusyId(item.id);
    try {
      const changed = await performTodayAction(async () => { await updateSessionVideos(session.id, [...session.orderedVideoIds, item.id]); return true; }, () => handle(item, "session"));
      if (!changed) return;
      setSessionItem(null);
      setNotice("Added to session");
      done("commit");
    } catch { Alert.alert("Couldn’t add to session", "Check your sessions in Saved before trying again."); }
    finally { actionLock.current = false; setBusyId(null); }
  }, [feedback, handle, requirePurchase, sessionItem, sessions, updateSessionVideos]);

  const createTodaySession = useCallback(async (name: string): Promise<void> => {
    const item = sessionItem;
    if (!item || actionLock.current || !requirePurchase("sessions")) return;
    actionLock.current = true;
    const done = feedback.capture();
    setNotice(null);
    setBusyId(item.id);
    try {
      const handled = await performTodayAction(async () => Boolean(await createSession(name, [item.id])), () => handle(item, "session"));
      if (!handled) return;
      setSessionItem(null);
      setNotice("Added to session");
      done("commit");
    } catch { Alert.alert("Couldn’t create session", "Check your sessions in Saved before trying again."); }
    finally { actionLock.current = false; setBusyId(null); }
  }, [createSession, feedback, handle, requirePurchase, sessionItem]);

  const showMore = useCallback((item: TodaySnapshotItem): void => {
    if (actionLock.current) return;
    Alert.alert(item.title, "Remove this video from Today, or choose when it returns.", [
      { text: "Snooze", onPress: () => setSnoozeItem(item) },
      { text: "Dismiss", style: "destructive", onPress: () => { if (actionLock.current) return; actionLock.current = true; setBusyId(item.id); setNotice(null); void handle(item, "dismissed").then((changed) => { if (changed) setUndo({ item, previous: item.disposition, snoozedUntil: item.snoozedUntil }); }).catch(() => Alert.alert("Couldn’t dismiss", "Try again when you’re ready.")).finally(() => { actionLock.current = false; setBusyId(null); }); } },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handle]);

  const snooze = useCallback(async (until: number): Promise<void> => {
    if (!snoozeItem || actionLock.current || until <= Date.now()) return;
    const item = snoozeItem;
    const done = feedback.capture();
    actionLock.current = true;
    setBusyId(item.id);
    try {
      if (await handle(item, "snoozed", until)) {
        done("commit");
        setSnoozeItem(null);
        setNotice(`Snoozed until ${new Date(until).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`);
      }
    } catch { Alert.alert("Couldn’t snooze", "Try again when you’re ready."); }
    finally { actionLock.current = false; setBusyId(null); }
  }, [feedback, handle, snoozeItem]);

  const undoDismiss = useCallback(async (): Promise<void> => {
    if (!undo || actionLock.current) return;
    const done = feedback.capture();
    actionLock.current = true;
    setBusyId(undo.item.id);
    try {
      const restored = await todayRepository.setDisposition(activeProfileId, undo.item.periodKey, undo.item.id, undo.previous, Date.now(), undo.snoozedUntil, "dismissed");
      if (restored) { done("commit"); setUndo(null); await reloadLocal(); AccessibilityInfo.announceForAccessibility("Video restored to Today."); }
    } catch { Alert.alert("Couldn’t undo", "Try again when you’re ready."); }
    finally { actionLock.current = false; setBusyId(null); }
  }, [activeProfileId, feedback, reloadLocal, undo]);

  const status = snapshot?.freshness === "offline" || todayQuery.data?.state === "network_error" ? "Offline · showing saved selection" : snapshot?.freshness === "stale" ? "Showing saved selection · refresh delayed" : isRefreshing ? "Refreshing…" : null;
  const hasOnlySnoozed = Boolean(snapshot && visible.length === 0 && nextReturn !== null);
  const initialLoading = (activeProfile?.role === "managed" && managedContentQuery.isLoading) || (!snapshot && (sourcesLoading || todayQuery.isLoading));
  let content;
  if (initialLoading) content = <VideoFeedSkeleton variant="full" count={3} accessibilityLabel="Loading today’s videos" />;
  else if (managedOverview?.policy.mode === "selectedVideos") content = managedOverview.approvedVideos.length > 0
    ? managedOverview.approvedVideos.map((video) => <VideoCard key={video.id} video={video} variant="full" />)
    : <StateBlock title="No selected videos yet" body="Ask the Owner to approve a video in Settings → Profiles & boundaries." styles={styles} success />;
  else if (activeProfile?.role === "managed" && managedOverview?.policy.mode === "approvedSources" && sourceIds.length === 0) content = <StateBlock title="No approved sources yet" body="Ask the Owner to add or approve a source in Settings → Profiles & boundaries." action="Open Sources" onPress={() => router.push("/(tabs)/sources")} styles={styles} />;
  else if (sourceIds.length === 0) content = <StateBlock title="Start with a source" body="Follow a source to see its videos here." action="Open Sources" onPress={() => router.push("/(tabs)/sources")} styles={styles} />;
  else if (visible.length > 0) content = visible.map((item) => <PositionedRow transitionKey={visible.map((video) => video.id).join(",")} key={item.id}><TodayVideoCard item={item} busy={busyId === item.id} disabled={Boolean(busyId)} onWatch={() => { void watch(item); }} onSave={() => { void save(item); }} onSession={() => setSessionItem(item)} onMore={() => showMore(item)} /></PositionedRow>);
  else if (hasOnlySnoozed) content = <StateBlock title="Snoozed for later" body={`Your next snoozed video returns ${new Date(nextReturn as number).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}.`} styles={styles} />;
  else if (hasExpiredPending) content = <StateBlock title="Details need refreshing" body="Some video details need updating. Pull to refresh. Your choices are saved." styles={styles} />;
  else if (snapshot && snapshot.items.length > 0) content = <MotionView enter={handledHere.current} duration={motion.ending} onPresented={() => { handledHere.current = false; }}><StateBlock title="You’re caught up" body="You’ve reached the end of today’s selection." styles={styles} success /></MotionView>;
  else if (snapshot) content = <StateBlock title="No new videos today" body="There are no videos from your sources that match your settings today. You can open a source directly below." styles={styles} success />;
  else if (todayQuery.data?.state === "network_error") content = <StateBlock title="Today is offline" body="Connect to the internet, then try again." action="Retry" onPress={() => { void refresh(); }} styles={styles} />;
  else if (todayQuery.data?.state === "no_cache") content = <StateBlock title="Your videos aren’t ready yet" body="Frame is still preparing videos from your sources. Try again later, or open a source directly below." action="Retry" onPress={() => { void refresh(); }} styles={styles} />;
  else content = <StateBlock title="Today couldn’t load" body="Check your connection and try again. Your sources and saved videos are still here." action="Retry" onPress={() => { void refresh(); }} styles={styles} />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { void refresh(); }} tintColor={palette.accent} />}>
        <View style={styles.page}>
          <ScreenHeader eyebrow="Today" title={"Chosen by\nyou."} subtitle="Today’s videos, from the sources you follow." />
          <View style={styles.boundaryRow} accessible accessibilityLabel={managedOverview?.policy.mode === "selectedVideos" ? "Only Owner-selected videos are available" : `Today is limited to ${TODAY_MAX_ITEMS} videos, with at most ${MAX_ITEMS_PER_SOURCE} per source`}><CircleCheck size={17} color={palette.active} /><Text style={styles.boundaryText}>{managedOverview?.policy.mode === "selectedVideos" ? "Only videos selected by the Owner" : managedOverview?.policy.mode === "approvedSources" ? `Up to ${TODAY_MAX_ITEMS} videos · approved sources only` : `Up to ${TODAY_MAX_ITEMS} videos · no more than ${MAX_ITEMS_PER_SOURCE} per source`}</Text></View>
          {status ? <View style={styles.status}><CloudOff size={14} color={palette.inkMuted} /><Text style={styles.statusText}>{status}</Text></View> : null}
          <View style={styles.content}>{content}</View>
          {sourceIds.length > 0 ? <Pressable onPress={() => router.push("/(tabs)/sources")} style={styles.secondaryLink} accessibilityRole="button"><Text style={styles.secondaryText}>Open a source directly</Text><ArrowRight size={16} color={palette.accent} /></Pressable> : null}
        </View>
      </ScrollView>
      {undo || notice ? <MotionView enter style={[styles.undo, { bottom: insets.bottom + 84 }]} accessibilityLiveRegion="polite">
        <Text style={styles.undoText}>{notice ?? "Dismissed from Today"}</Text>
        {undo ? <Pressable disabled={Boolean(busyId)} onPress={() => { void undoDismiss(); }} style={styles.undoButton} accessibilityRole="button" accessibilityLabel="Undo previous dismissal"><RotateCcw size={15} color={palette.onDark} /><Text style={styles.undoButtonText}>Undo</Text></Pressable> : notice === "Video saved" || notice === "Added to session" ? <Pressable onPress={() => router.push("/(tabs)/saved")} style={styles.undoButton} accessibilityRole="button"><Text style={styles.undoButtonText}>View Saved</Text></Pressable> : null}
        <Pressable onPress={() => { setUndo(null); setNotice(null); }} style={styles.undoButton} accessibilityRole="button" accessibilityLabel="Dismiss message"><X size={18} color={palette.onDark} /></Pressable>
      </MotionView> : null}
      <SnoozeModal busy={Boolean(busyId)} visible={Boolean(snoozeItem)} title={snoozeItem?.title ?? ""} onClose={() => setSnoozeItem(null)} onSnooze={(until) => { void snooze(until); }} />
      <TodaySessionModal visible={Boolean(sessionItem)} title={sessionItem?.title ?? ""} videoId={sessionItem?.id ?? ""} busy={Boolean(busyId)} sessions={sessions} onClose={() => setSessionItem(null)} onPick={(id) => { void addToSession(id); }} onCreate={(name) => { void createTodaySession(name); }} />
    </View>
  );
}

function StateBlock({ title, body, action, onPress, styles, success = false }: { title: string; body: string; action?: string; onPress?: () => void; styles: ReturnType<typeof createStyles>; success?: boolean }) {
  return <View accessibilityLabel={title}><EmptyState symbol={success ? "✓" : undefined} title={title} body={body} />{action && onPress ? <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} accessibilityRole="button"><Text style={styles.primaryButtonText}>{action}</Text><ArrowRight size={17} color="#FFFDF9" /></Pressable> : null}</View>;
}
function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({ screen: { flex: 1, backgroundColor: palette.wall }, page: { paddingHorizontal: spacing.page }, boundaryRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSoft }, boundaryText: { ...type.label, flex: 1, color: palette.active }, status: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.sm }, statusText: { ...type.bodySoft, color: palette.inkMuted }, content: { marginTop: spacing.lg }, primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: -spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep }, primaryButtonText: { ...type.label, color: palette.onDark }, secondaryLink: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", marginTop: spacing.md }, secondaryText: { ...type.label, color: palette.accent }, undo: { position: "absolute", left: spacing.page, right: spacing.page, minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep }, undoText: { flex: 1, ...type.label, color: palette.onDark }, undoButton: { minHeight: 48, flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingHorizontal: spacing.sm }, undoButtonText: { ...type.label, color: palette.onDark }, pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] } });
}

