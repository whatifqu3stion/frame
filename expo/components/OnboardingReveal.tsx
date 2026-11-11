import GlassPlayMark from "@/components/GlassPlayMark";
import { posterForTopic } from "@/constants/onboardingPosters";
import { PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import { sampleVideoTopic } from "@/preview/interestPicks";
import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import SelectionArtwork from "@/components/motion/SelectionArtwork";
import { motion } from "@/constants/motion";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import { useScreenAction } from "@/hooks/useScreenAction";
import OutcomeIcon from "@/components/motion/OutcomeIcon";
import CompletionMark from "@/components/motion/CompletionMark";
import PersonalizedPreview from "@/components/motion/PersonalizedPreview";
import { useFeedback } from "@/hooks/useFeedback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
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

type Props = { animateReveal: boolean; onRevealed(): void; savedHere: string[]; onSaved(id: string): void; onChooseSource(): void; onBrowseSources(): void; onBusyChange(value: boolean): void; onWatch(item: TodaySnapshotItem): void; finishing: boolean };

/** The same finite snapshot as Today, with a real first save and no playback bypass. */
export default function OnboardingReveal({ onBrowseSources, onChooseSource, onBusyChange, onWatch, finishing, savedHere, onSaved, animateReveal, onRevealed }: Props) {
  const touch = useFeedback();
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
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
  const previewItems = items.slice(0, showMore ? 3 : 1);
  const save = async (item: TodaySnapshotItem) => {
    if (finishing || lock.current || (savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)) || !requirePurchase("save")) return;
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
    <Text style={styles.title} accessibilityRole="header">{sourceIds.length ? "Your first selection." : "Your selection."}</Text>
    {managed ? <Text style={type.bodySoft}>Your Owner’s approvals shape what appears in Today. Your profile’s viewing limits still apply.</Text>
      : sourcesLoading || (enabled && (today.isLoading || rulesQuery.isLoading)) ? <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading your selection"><ActivityIndicator color={palette.active} /><Text style={type.bodySoft}>Bringing your sources together…</Text></View>
      : sourcesError ? <><Text style={type.bodySoft}>Your sources couldn’t load. Try again to bring back your selection.</Text><Pressable disabled={retryingSources} accessibilityState={{ busy: retryingSources, disabled: retryingSources }} onPress={() => { void retrySourceRead(refreshLibrary, () => {}, () => {}); }} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>{retryingSources ? "Loading sources…" : "Try again"}</Text></Pressable></>
      : !sourceIds.length ? <><Text style={type.bodySoft}>Follow a creator to see videos here, or finish setup and add one in Sources.</Text><Pressable onPress={onChooseSource} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Choose a source</Text></Pressable></>
      : today.data?.state === "source_limit" ? <><Text style={type.bodySoft}>Today includes up to 100 sources. Keep extra creators in your library using their Include in Today setting.</Text><Pressable onPress={onBrowseSources} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Manage sources</Text></Pressable></>
      : today.isError || rulesQuery.isError || (!items.length && ["network_error", "unavailable", "no_cache"].includes(today.data?.state ?? "")) ? <><Text style={type.bodySoft}>Your choices are saved, but the videos couldn’t load. Try again, or continue into Frame.</Text><Pressable onPress={retry} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Try again</Text></Pressable></>
      : items.length === 0 ? <><Text style={type.bodySoft}>No new picks today. Your creators are still in Sources.</Text>{followedChannels[0] ? <View style={styles.supporting}><MediaImage source={followedChannels[0].thumbnailUrl ? { uri: followedChannels[0].thumbnailUrl } : null} style={{ width: 56, height: 56, borderRadius: radii.source }} contentFit="cover" cachePolicy="none" /><View style={styles.supportingDetails}><Text style={type.heading}>{followedChannels[0].title}</Text></View></View> : null}<Pressable onPress={onBrowseSources} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Browse my sources</Text></Pressable></>
      : <View>
        {today.data?.snapshot?.freshness !== "fresh" ? <Text style={type.caption}>Showing a previously loaded selection.</Text> : null}
        {feedback ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{feedback}</Text> : null}
        {previewItems.map((item, index) => {
          const sampleTopic = PREVIEW_LIBRARY_ENABLED ? sampleVideoTopic(item.id) : undefined;
          return <View key={item.id} style={styles.video}><SelectionArtwork selected={savedHere.includes(item.id)}>
          {index === 0 ? <PersonalizedPreview animate={animateReveal} onPresented={onRevealed} image={<Pressable accessibilityRole="button" accessibilityLabel={`Watch ${item.title}`} accessibilityState={{ disabled: finishing }} disabled={finishing} onPress={() => onWatch(item)} testID="onboard-watch-first">
            <MediaImage source={item.thumbnailUrl && !sampleTopic ? { uri: item.thumbnailUrl } : undefined} fallbackSource={posterForTopic(sampleTopic)} style={styles.image} contentFit="cover" cachePolicy="none" />
            <GlassPlayMark />
          </Pressable>}>
            <View style={styles.details}><Text style={type.caption}>{item.sourceTitle} · {formatDuration(item.durationSeconds)}</Text><Text style={styles.featuredTitle}>{item.title}</Text></View>
          </PersonalizedPreview> : <View style={styles.supporting}>
            <Pressable accessibilityRole="button" disabled={finishing} accessibilityLabel={`Watch ${item.title}`} onPress={() => onWatch(item)} style={styles.thumbnail}><MediaImage source={item.thumbnailUrl && !sampleTopic ? { uri: item.thumbnailUrl } : undefined} fallbackSource={posterForTopic(sampleTopic)} style={styles.image} contentFit="cover" cachePolicy="none" /><GlassPlayMark /></Pressable>
            <View style={[styles.details, styles.supportingDetails]}><Text style={type.caption}>{item.sourceTitle} · {formatDuration(item.durationSeconds)}</Text><Text style={type.label}>{item.title}</Text></View>
          </View>}
          </SelectionArtwork><Pressable onPress={() => { void save(item); }} disabled={Boolean(busyId) || (savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id))} accessibilityRole="button" accessibilityState={{ busy: busyId === item.id, disabled: Boolean(busyId) || (savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)) }} accessibilityLabel={(savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)) ? `${item.title}, saved for later` : `Save ${item.title} for later`} style={styles.save}>
            <OutcomeIcon key={`${activeProfileId}:${item.id}`} confirmed={savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)} busy={busyId === item.id} color={palette.active} idle={<Bookmark size={18} color={palette.active} />}><Check size={18} color={palette.success} /></OutcomeIcon><Text style={styles.saveLabel}>{busyId === item.id ? "Saving…" : (savedHere.includes(item.id) || savedVideos.some((video) => video.id === item.id)) ? "Saved for later" : "Save for later"}</Text>
          </Pressable>
        {savedHere[0] === item.id ? <MotionView enter={justSaved === item.id} distance={12} duration={motion.artwork} style={styles.firstSave} accessibilityLiveRegion="polite">
          <ProgrammeGrain />
          <View style={styles.firstSaveHeading}><CompletionMark color={palette.onProgramme} animate={justSaved === item.id} /><Text style={styles.firstSaveTitle}>Kept for you.</Text></View>
        </MotionView> : null}
        </View>; })}
        {items.length > 1 ? <Pressable onPress={() => setShowMore(!showMore)} style={styles.action} accessibilityRole="button" aria-expanded={showMore} accessibilityState={{ expanded: showMore }}><Text style={styles.actionText}>{showMore ? "Show just the first video" : "More from your selection"}</Text></Pressable> : null}
      </View>}
  </View>;
}
function createStyles(p: FramePalette, t: FrameType) {
  return StyleSheet.create({
    firstSave: { padding: spacing.lg, marginTop: spacing.sm, borderRadius: radii.card, backgroundColor: p.programme, gap: spacing.md, overflow: "hidden" }, firstSaveHeading: { flexDirection: "row", alignItems: "center", gap: spacing.md }, firstSaveTitle: { ...t.heading, fontSize: 26, lineHeight: 34, color: p.onProgramme, flex: 1 }, featuredTitle: { ...t.heading, fontSize: 24, lineHeight: 32 }, firstSaveBody: { ...t.bodySoft, color: p.onProgrammeSoft },
    root: { gap: spacing.lg }, title: { ...t.title, fontSize: 36, lineHeight: 44 }, loading: { gap: spacing.md, paddingVertical: spacing.xl },
    action: { minHeight: 48, justifyContent: "center" }, actionText: { ...t.label, color: p.active },
    supporting: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }, thumbnail: { width: 96 }, details: { gap: spacing.sm, marginTop: spacing.sm }, supportingDetails: { flex: 1 },
    video: { gap: spacing.sm, marginBottom: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border }, image: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.media },
    save: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48, padding: spacing.md, borderRadius: radii.control, backgroundColor: p.activeSoft }, saveLabel: { ...t.label, color: p.active, flexShrink: 1 }, ending: { gap: spacing.sm, paddingVertical: spacing.lg, alignItems: "center" }, endingTitle: { ...t.heading, textAlign: "center" }, endingBody: { ...t.bodySoft, textAlign: "center" },
  });
}
