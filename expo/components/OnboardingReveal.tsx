import { useScreenAction } from "@/hooks/useScreenAction";
import OutcomeIcon from "@/components/motion/OutcomeIcon";
import CompletionMark from "@/components/motion/CompletionMark";
import MotionView from "@/components/motion/MotionView";
import { motion } from "@/constants/motion";
import { useFeedback } from "@/hooks/useFeedback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import MediaMount from "@/components/MediaMount";
import MediaImage from "@/components/MediaImage";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { listTodaySourceRules } from "@/db/database";
import { getTodayPeriod, performTodayAction } from "@/domain/today";
import type { TodaySnapshotItem, TodaySourceRule } from "@/models/today";
import { onboardingSelection } from "@/domain/onboarding";
import { useApp } from "@/providers/AppProvider";
import { todayRepository } from "@/repositories/todayRepository";
import { todayService } from "@/services/todayServiceInstance";
import { formatDuration } from "@/services/youtube";

type Props = { animateReveal: boolean; onRevealed(): void; savedHere: string[]; onSaved(id: string): void; onChooseSource(): void; onBrowseSources(): void; onBusyChange(value: boolean): void };

/** The same finite snapshot as Today, with a real first save and no playback bypass. */
export default function OnboardingReveal({ onBrowseSources, onChooseSource, onBusyChange, savedHere, onSaved, animateReveal, onRevealed }: Props) {
  const touch = useFeedback();
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, activeProfile, followedChannels, sourcesLoading, sourcesError, refreshLibrary, savedVideos, saveVideo, requirePurchase } = useApp();
  const client = useQueryClient();
  const { busy: retryingSources, run: retrySourceRead } = useScreenAction(activeProfileId);
  const [clock] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const lock = useRef(false);
  const period = getTodayPeriod(clock);
  const sourceIds = followedChannels.map((source) => source.id);
  const managed = activeProfile?.role === "managed";
  const enabled = !sourcesError && !sourcesLoading && sourceIds.length > 0 && !managed;
  const key = ["today", activeProfileId, period.key] as const;
  const today = useQuery({ queryKey: key, networkMode: "always", queryFn: () => todayService.load({ profileId: activeProfileId, followedSourceIds: sourceIds, now: Date.now(), refreshExisting: true }), enabled, retry: false, refetchOnWindowFocus: false });
  const rulesQuery = useQuery({ queryKey: ["today-rules", activeProfileId], networkMode: "always", queryFn: () => listTodaySourceRules(activeProfileId), enabled, staleTime: Infinity });
  const rules = new Map<string, TodaySourceRule>((rulesQuery.data ?? []).map((rule) => [rule.sourceId, rule]));
  const items = onboardingSelection(today.data?.snapshot?.items ?? [], activeProfileId, new Set(sourceIds), rules, Date.now(), new Set(savedHere));
  const save = async (item: TodaySnapshotItem) => {
    if (lock.current || (savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)) || !requirePurchase("save")) return;
    const done = touch.capture();
    lock.current = true; setBusyId(item.id); onBusyChange(true); setFeedback(null);
    try {
      const changed = await performTodayAction(async () => { await saveVideo(item); return true; }, () => todayRepository.setDisposition(activeProfileId, item.periodKey, item.id, "saved", Date.now()));
      if (!changed) throw new Error("Save did not complete");
      onSaved(item.id);
      setJustSaved(item.id);
      done(savedHere.length === 0 ? "milestone" : "commit");
      setFeedback(null);
      try {
        const result = await todayService.load({ profileId: activeProfileId, followedSourceIds: sourceIds, now: Date.now() });
        client.setQueryData(key, result);
      } catch { setFeedback("Your video is saved. The selection couldn’t refresh; reopen Today to try again."); }
    } catch { setFeedback("Couldn’t finish saving. Check Saved before trying again."); }
    finally { lock.current = false; setBusyId(null); onBusyChange(false); }
  };
  const retry = () => { void today.refetch(); void rulesQuery.refetch(); };
  return <View style={styles.root}>
    <Text style={styles.title} accessibilityRole="header">This is your{"\n"}Frame.</Text>
    {managed ? <Text style={type.bodySoft}>Your Owner’s approvals shape what appears in Today. Your profile’s viewing limits still apply.</Text>
      : sourcesLoading || (enabled && (today.isLoading || rulesQuery.isLoading)) ? <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading your selection"><ActivityIndicator color={palette.active} /><Text style={type.bodySoft}>Bringing your sources together…</Text></View>
      : sourcesError ? <><Text style={type.bodySoft}>Your sources couldn’t load. Try again to bring back your selection.</Text><Pressable disabled={retryingSources} accessibilityState={{ busy: retryingSources, disabled: retryingSources }} onPress={() => { void retrySourceRead(refreshLibrary, () => {}, () => {}); }} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>{retryingSources ? "Loading sources…" : "Try again"}</Text></Pressable></>
      : !sourceIds.length ? <><Text style={type.bodySoft}>Follow a source to see your first selection here. Your interests help you find one you’ll enjoy.</Text><Pressable onPress={onChooseSource} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Choose a source</Text></Pressable></>
      : today.isError || rulesQuery.isError || (!items.length && ["network_error", "unavailable", "no_cache"].includes(today.data?.state ?? "")) ? <><Text style={type.bodySoft}>Your choices are saved, but the videos couldn’t load. Try again, or continue into Frame.</Text><Pressable onPress={retry} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Try again</Text></Pressable></>
      : items.length === 0 ? <><Text style={type.bodySoft}>Your sources are ready. There are no new videos in today’s selection. You can browse your sources directly in Frame.</Text>{followedChannels[0] ? <View style={styles.supporting}><MediaImage source={followedChannels[0].thumbnailUrl ? { uri: followedChannels[0].thumbnailUrl } : null} style={{ width: 56, height: 56, borderRadius: radii.media }} contentFit="cover" cachePolicy="none" /><View style={styles.supportingDetails}><Text style={type.heading}>{followedChannels[0].title}</Text><Text style={type.bodySoft}>A source you chose. Open Sources to explore its videos.</Text></View></View> : null}<Pressable onPress={onBrowseSources} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Browse my sources</Text></Pressable></>
      : <MotionView enter={animateReveal} duration={motion.reveal} distance={4} onPresented={onRevealed}>
        <Text style={type.bodySoft}>Save a video for later. It will be waiting in Saved.</Text>

        <Text style={styles.summary}>{items.length} {items.length === 1 ? "video" : "videos"} · {new Set(items.map((item) => item.sourceId)).size} {new Set(items.map((item) => item.sourceId)).size === 1 ? "source" : "sources"}</Text>
        {today.data?.snapshot?.freshness !== "fresh" ? <Text style={type.caption}>Showing a previously loaded selection.</Text> : null}
        {feedback ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{feedback}</Text> : null}
        {items.map((item, index) => <View key={item.id} style={styles.video}>
          <View style={index > 0 ? styles.supporting : undefined}>
          <View style={index > 0 ? styles.thumbnail : undefined}><MediaMount><MediaImage source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : null} style={styles.image} contentFit="cover" cachePolicy="none" /></MediaMount></View>
          <View style={[styles.details, index > 0 && styles.supportingDetails]}><Text style={type.caption}>{item.sourceTitle} · {formatDuration(item.durationSeconds)}</Text>
          <Text style={index === 0 ? type.heading : type.label}>{item.title}</Text></View></View>
          <Pressable onPress={() => { void save(item); }} disabled={Boolean(busyId) || (savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id))} accessibilityRole="button" accessibilityState={{ busy: busyId === item.id, disabled: Boolean(busyId) || (savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)) }} accessibilityLabel={(savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)) ? `${item.title}, saved for later` : `Save ${item.title} for later`} style={styles.save}>
            <OutcomeIcon key={`${activeProfileId}:${item.id}`} confirmed={savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)} busy={busyId === item.id} color={palette.active} idle={<Bookmark size={18} color={palette.active} />}><Check size={18} color={palette.success} /></OutcomeIcon><Text style={styles.saveLabel}>{busyId === item.id ? "Saving…" : (savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)) ? "Saved for later" : "Save for later"}</Text>
          </Pressable>
        {savedHere[0] === item.id ? <View style={styles.firstSave} accessibilityLiveRegion="polite"><CompletionMark color={palette.onProgramme} animate={justSaved === item.id} /><Text style={styles.firstSaveTitle}>Your library has begun.</Text><Text style={styles.firstSaveBody}>{savedHere.length} {savedHere.length === 1 ? "video is" : "videos are"} saved for another day. Ready whenever you are. Find {savedHere.length === 1 ? "it" : "them"} in Saved.</Text></View> : null}
        </View>)}
        <View style={styles.ending}><Text style={type.heading}>That’s today’s selection.</Text><Text style={type.bodySoft}>You choose what plays next.</Text></View>
      </MotionView>}
  </View>;
}
function createStyles(p: FramePalette, t: FrameType) {
  return StyleSheet.create({
    firstSave: { padding: spacing.lg, borderRadius: radii.card, backgroundColor: p.programme, gap: spacing.sm }, firstSaveTitle: { ...t.heading, color: p.onProgramme }, firstSaveBody: { ...t.bodySoft, color: p.onProgrammeSoft },
    root: { gap: spacing.lg }, title: { ...t.title, fontSize: 36, lineHeight: 44 }, loading: { gap: spacing.md, paddingVertical: spacing.xl },
    action: { minHeight: 48, justifyContent: "center" }, actionText: { ...t.label, color: p.active }, summary: { ...t.label },
    supporting: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }, thumbnail: { width: 96 }, details: { gap: spacing.sm, marginTop: spacing.sm }, supportingDetails: { flex: 1 },
    video: { gap: spacing.sm, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border }, image: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.media },
    save: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48, padding: spacing.md, borderRadius: radii.control, backgroundColor: p.activeSoft }, saveLabel: { ...t.label, color: p.active, flexShrink: 1 }, ending: { gap: spacing.sm, paddingVertical: spacing.md },
  });
}
