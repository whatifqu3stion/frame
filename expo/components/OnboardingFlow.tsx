import { useOnboardingBack } from "@/hooks/useOnboardingBack";
import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import { providerKeyState, unavailableKeyStorageMessage } from "@/domain/providerKeyStatus";
import Text, { type FrameTextRef } from "@/components/FrameText";
import InlineHelp from "@/components/InlineHelp";
import TodaySelectionSetting from "@/components/TodaySelectionSetting";
import CustomInterestInput from "@/components/CustomInterestInput";
import GenerateWeeklyPicks from "@/components/GenerateWeeklyPicks";
import { takePendingWatch } from "@/storage/pendingWatchStorage";
import MediaMount from "@/components/MediaMount";
import { GroupedInterestChoices } from "@/components/InterestChoices";
import { onboardingPreviewPage, onboardingPreviewStatus } from "@/domain/onboardingPreview";
import { useOnboardingDraft } from "@/hooks/useOnboardingDraft";
import { formatDuration } from "@/services/youtube";
import ProgressSegment from "@/components/motion/ProgressSegment";
import TextField from "@/components/TextField";
import MotionView from "@/components/motion/MotionView";
import OnboardingIdentity from "@/components/motion/OnboardingIdentity";
import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check, Link2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingReveal from "@/components/OnboardingReveal";
import { weeklyDiscoveryPeriodKey, weeklyPickToSourceResolution } from "@/services/discovery";
import { weeklyEditionService } from "@/services/weeklyEditionInstance";
import MediaImage from "@/components/MediaImage";
import { ONBOARDING_STEPS } from "@/constants/navigation";
import { FOUNDATION_CAPABILITIES } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { interestTopicFromId } from "@/domain/interests";
import { onboardingDestination } from "@/domain/onboarding";
import { useApp } from "@/providers/AppProvider";
import type { SourceResolution } from "@/types";

const steps = ONBOARDING_STEPS;

export default function OnboardingFlow({ replay = false }: { replay?: boolean }) {
  const { activeProfileId } = useApp();
  return <ProfileOnboarding key={`${activeProfileId}:${replay}`} replay={replay} />;
}

function ProfileOnboarding({ replay }: { replay: boolean }) {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, interests, toggleInterest, followedChannels, savedVideos, finishOnboarding } = useApp();
  const feedback = useFeedback();
  const revealed = useRef(false);
  const identityPresented = useRef(false);
  const setup = useOnboardingDraft(activeProfileId, replay);
  const { step, savedIds: savedDuringSetup } = setup.draft;
  const setDraft = setup.setDraft;
  const setStep = useCallback((next: number) => setDraft((draft) => ({ ...draft, step: next })), [setDraft]);
  const [sourceInput, setSourceInput] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const sourceLock = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const stageLabel = useRef<FrameTextRef>(null);
  const lastStage = useRef<string | null>(null);
  const current = steps[step];
  useEffect(() => {
    const changed = lastStage.current !== null && lastStage.current !== current;
    lastStage.current = current;
    if (!changed || Platform.OS === "web") return;
    const frame = requestAnimationFrame(() => { const node = findNodeHandle(stageLabel.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); });
    return () => cancelAnimationFrame(frame);
  }, [current]);
  const last = step === steps.length - 1;
  const savedCount = savedDuringSetup.filter((id) => savedVideos.some((video) => video.id === id)).length;
  const destination = onboardingDestination(followedChannels.length, replay, savedCount);
  const finishLabel = replay ? "Back to Settings" : savedCount > 0 ? "Open Saved" : followedChannels.length ? "Open Today" : "Explore Sources";
  const nextLabel = last ? finishLabel : current === "source" && followedChannels.length === 0 ? (replay ? "Preview selection" : "Finish setup for now") : current === "source" ? "Reveal my selection" : interests.length === 0 ? "Choose interests later" : "Choose a source";
  const finish = async (target = destination) => {
    if (locked.current || sourceLock.current) return;
    locked.current = true; setBusy(true); Keyboard.dismiss();
    try { if (!replay) { await finishOnboarding(); await setup.clear().catch(() => {}); } const pending = replay ? null : await takePendingWatch(activeProfileId).catch(() => null); router.replace(pending ? { pathname: "/watch/[id]", params: { id: pending } } : target); }
    catch { Alert.alert("Couldn’t finish setup", "Your choices are still here. Try again."); }
    finally { locked.current = false; setBusy(false); }
  };
  const goTo = (index: number) => {
    if (locked.current || sourceLock.current) return;
    Keyboard.dismiss(); setStep(Math.max(0, Math.min(steps.length - 1, index)));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useOnboardingBack(replay, step, () => locked.current || sourceLock.current, () => {
    Keyboard.dismiss(); setStep(step - 1); scroll.current?.scrollTo({ y: 0, animated: false });
  });
  const selectInterest = async (id: string) => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    const done = feedback.capture();
    try { const changed = await toggleInterest(id); done("selection", changed); }
    catch { Alert.alert("Couldn’t save interests", "Check your selection and try again."); }
    finally { locked.current = false; setBusy(false); }
  };
  if (!setup.ready) return <View style={[styles.screen, { justifyContent: "center" }]}><ActivityIndicator color={palette.active} accessibilityLabel="Restoring setup" /></View>;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
      {step === 0 ? <OnboardingIdentity enter={setup.fresh && !identityPresented.current} onPresented={() => { identityPresented.current = true; }} /> : <Text style={styles.wordmark}>Frame</Text>}
      <Pressable disabled={busy} onPress={() => { void finish(); }} style={styles.textButton} accessibilityRole="button" accessibilityState={{ disabled: busy }}><Text style={styles.link}>{replay ? "Close setup" : "Skip setup"}</Text></Pressable>
    </View>
    <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel="Setup progress" accessibilityValue={{ min: 1, max: steps.length, now: step + 1, text: `Step ${step + 1} of ${steps.length}` }}>
      {steps.map((name, i) => <ProgressSegment key={name} complete={i <= step} />)}
    </View>
    <Text ref={stageLabel} accessible style={styles.stageLabel}>{`${step + 1} of ${steps.length} · ${["Your interests", "Your sources", "Your first selection"][step]}`}</Text>
    <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <MotionView changeKey={current} active={current !== "your-frame"} distance={6}>
      {setup.error ? <Text style={styles.note} accessibilityLiveRegion="polite">Your setup position couldn’t be saved. Your followed sources and saved videos are kept separately.</Text> : null}
      {replay ? <Text style={styles.replayNote}>Revisit setup · changes apply to this profile.</Text> : null}
      {current === "source" ? <SourceStep link={sourceInput} setLink={setSourceInput} key={interests.map((item) => item.id).sort().join(",")} scrollToSource={() => scroll.current?.scrollTo({ y: 0, animated: false })} onBusyChange={(value) => { sourceLock.current = value; setBusy(value); }} /> : null}
      {current === "interests" ? <>
        <Text style={styles.title} accessibilityRole="header">Choose your interests</Text>
        <Text style={styles.body}>A daily selection from creators you choose. Add interests for optional weekly source suggestions.</Text>
        <Text style={styles.note} accessibilityLiveRegion="polite">{interests.length} selected · optional</Text>
        <View style={styles.interestGroup}>
          <GroupedInterestChoices selectedIds={interests.map((interest) => interest.id)} onToggle={(id) => { void selectInterest(id); }} busy={busy} />
          <CustomInterestInput selectedIds={interests.map((interest) => interest.id)} onAdd={toggleInterest} disabled={busy} />
          <InlineHelp label="Daily video count"><TodaySelectionSetting firstSelection={!replay} /></InlineHelp>
        </View>
      </> : null}
      {current === "your-frame" ? <>
        <OnboardingReveal onBrowseSources={() => { void finish("/(tabs)/sources"); }} animateReveal={!revealed.current} onRevealed={() => { revealed.current = true; }} savedHere={savedDuringSetup} onSaved={(id) => setup.setDraft((draft) => ({ ...draft, savedIds: [...new Set([...draft.savedIds, id])] }))} onChooseSource={() => goTo(1)} onBusyChange={(value) => { sourceLock.current = value; setBusy(value); }} />
      </> : null}
      </MotionView>
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {step > 0 ? <Pressable disabled={busy} onPress={() => goTo(step - 1)} style={styles.textButton} accessibilityRole="button"><Text style={styles.link}>Back</Text></Pressable> : null}
      <Pressable disabled={busy} onPress={() => { if (last || (current === "source" && followedChannels.length === 0 && !replay)) void finish(); else goTo(step + 1); }} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button" accessibilityLabel={nextLabel} accessibilityState={{ busy, disabled: busy }} testID="onboarding-next">
        {busy ? <ActivityIndicator color={palette.onDark} /> : <Text style={styles.primaryText}>{nextLabel}</Text>}
      </Pressable>
    </View>
  </KeyboardAvoidingView>;
}

function SourceStep({ onBusyChange, scrollToSource, link, setLink }: { link: string; setLink(value: string): void; onBusyChange(value: boolean): void; scrollToSource(): void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const touch = useFeedback();
  const keyStatus = useProviderKeyStatus();
  const keyState = providerKeyState(keyStatus);
  const { resolveSourceInput, confirmSource, followedChannels, interests, activeProfileId, activeProfile } = useApp();
  const interestIds = interests.map((item) => item.id).sort();
  const picks = useQuery({
    queryKey: ["onboarding-picks", activeProfileId, weeklyDiscoveryPeriodKey(), interestIds.join(",")],
    networkMode: "always",
    queryFn: () => weeklyEditionService.preview(interestIds, activeProfileId),
    enabled: FOUNDATION_CAPABILITIES.weeklyDiscovery && interests.length > 0 && activeProfile?.role !== "managed",
    retry: false, staleTime: Infinity, refetchOnWindowFocus: false,
  });
  const [page, setPage] = useState(0);
  const preview = onboardingPreviewStatus({ enabled: FOUNDATION_CAPABILITIES.weeklyDiscovery, loading: picks.isLoading, failed: picks.isError, result: picks.data });
  const { items: suggestions, nextPage, previousPage, exhausted } = onboardingPreviewPage(preview.kind === "ready" ? picks.data?.items ?? [] : [], followedChannels.map((source) => source.id), page);
  const emptyMessage = preview.kind !== "ready" ? preview.message : exhausted
    ? "You follow every source in this preview. Continue to your selection, or bring another favorite below."
    : "These sources are already in your Frame. Choose another selection below.";
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<SourceResolution | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const lock = useRef(false);
  const lookup = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; lookup.current?.abort(); }; }, []);
  const submit = async () => {
    if (lock.current || (!resolution && !link.trim())) return;
    lock.current = true; setBusy(true); onBusyChange(Boolean(resolution)); setFeedback(null);
    const done = touch.capture();
    try {
      if (resolution) {
        const result = await confirmSource(resolution);
        if (!mounted.current) return;
        setFeedback(result.ok ? { ok: true, message: `${resolution.source.displayName} is followed. Continue to prepare your first selection.` } : result);
        if (result.ok) { done("commit"); setResolution(null); setLink(""); Keyboard.dismiss(); }
      } else {
        const controller = new AbortController(); lookup.current = controller;
        const result = await resolveSourceInput(link.trim(), controller.signal);
        if (!mounted.current) return;
        if (result.status === "success") setResolution(result.data);
        else setFeedback({ ok: false, message: result.message ?? "Source not found. Check the link or @handle and try again." });
      }
    } catch { if (mounted.current) setFeedback({ ok: false, message: "Couldn’t add this source. Check your connection and try again." }); }
    finally { lookup.current = null; lock.current = false; if (mounted.current) { setBusy(false); onBusyChange(false); } }
  };
  return <MotionView changeKey={resolution?.source.providerSourceId ?? "source-input"}>
    <Text style={styles.title} accessibilityRole="header">{resolution ? "A source for\nyour Frame." : suggestions.length ? "A few good places\nto begin." : "Begin with\na favorite."}</Text>
    <Text style={styles.body}>{resolution ? "Follow this source to shape future daily selections. You can browse it immediately." : "Start with one creator you enjoy. You can add more later."}</Text>
    {!resolution ? <>
    <Text style={styles.fieldLabel}>Source link or @handle</Text>
    <Text style={styles.sourceMeta}>A channel, video link, or @handle.</Text>
    {Platform.OS !== "web" && activeProfile?.role === "owner" && (keyState !== "ready" || !keyStatus.data?.youtube) ? <View style={styles.keySetup}>
      <Text style={type.bodySoft} accessibilityLiveRegion="polite">{keyState === "checking" ? "Checking YouTube setup…" : keyState === "error" ? "YouTube setup couldn’t be checked. Try again or review your key in Settings." : keyState === "unavailable" ? unavailableKeyStorageMessage(false) : "Add your YouTube API key to find creators and load videos. Your source entry will stay here."}</Text>
      {keyState === "error" || keyState === "unavailable" ? <Pressable accessibilityRole="button" disabled={keyStatus.isFetching} accessibilityState={{ disabled: keyStatus.isFetching, busy: keyStatus.isFetching }} onPress={() => { void keyStatus.refetch(); }} style={styles.textButton}><Text style={styles.link}>{keyStatus.isFetching ? "Checking…" : "Try secure storage again"}</Text></Pressable> : null}
      {keyState === "ready" || keyState === "error" ? <Pressable accessibilityRole="button" onPress={() => router.push("/settings/keys")} style={styles.textButton}><Text style={styles.link}>{keyState === "error" ? "Review YouTube key" : "Set up YouTube key"}</Text></Pressable> : null}
    </View> : null}
    <TextField containerStyle={styles.inputRow} leading={<Link2 size={18} color={palette.inkMuted} />} value={link} editable={!busy} onChangeText={(value) => { setLink(value); setResolution(null); setFeedback(null); }} placeholder="@creator" placeholderTextColor={palette.inkMuted} autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => { void submit(); }} returnKeyType="done" accessibilityLabel="Source link or @handle" testID="onboard-source-link" />
    </> : null}
    {resolution?.video ? <View style={styles.pickPreview}><MediaMount><MediaImage source={resolution.video.thumbnailUrl ? { uri: resolution.video.thumbnailUrl } : null} style={styles.heroImage} contentFit="cover" cachePolicy="none" /></MediaMount><Text style={styles.featuredTitle}>{resolution.video.title}</Text>{resolution.video.durationSeconds ? <Text style={type.caption}>{formatDuration(resolution.video.durationSeconds)}</Text> : null}</View> : null}
    {resolution ? <View style={styles.sourcePreview} testID="onboard-source-preview">
      <MediaImage source={resolution.source.thumbnailUrl ? { uri: resolution.source.thumbnailUrl } : null} style={styles.avatar} contentFit="cover" cachePolicy="none" />
      <View style={styles.flex}><Text style={type.heading}>{resolution.source.displayName}</Text><Text style={styles.sourceMeta}>{resolution.source.handle ?? "Channel"}</Text></View>
    </View> : null}
    <Pressable disabled={busy || (!resolution && !link.trim())} onPress={() => { void submit(); }} accessibilityRole="button" accessibilityState={{ busy, disabled: busy || (!resolution && !link.trim()) }} style={[styles.sourceAction, (busy || (!resolution && !link.trim())) && styles.disabled]} testID={resolution ? "onboard-confirm-source" : "onboard-resolve-source"}><Text style={styles.primaryText}>{busy ? (resolution ? "Following…" : "Finding source…") : resolution ? "Follow source" : "Find source"}</Text></Pressable>
    {resolution ? <Pressable disabled={busy} onPress={() => { setResolution(null); setLink(""); setFeedback(null); }} style={styles.textButton} accessibilityRole="button"><Text style={styles.link}>Choose another source</Text></Pressable> : null}
    {feedback ? <Text style={[styles.note, { color: feedback.ok ? palette.success : palette.danger }]} accessibilityLiveRegion="polite">{feedback.message}</Text> : null}

    {activeProfile?.role !== "managed" && interests.length > 0 && !resolution ? <View style={styles.suggestions}>
      <InlineHelp label="Find sources from my interests">
      <GenerateWeeklyPicks />
      <Text style={type.heading}>Picked for your interests</Text>
      {preview.kind === "loading" ? <ActivityIndicator color={palette.active} accessibilityLabel="Loading source suggestions" /> : suggestions.length ? suggestions.map((pick, index) => <Pressable key={pick.providerSourceId} disabled={busy} onPress={() => { setResolution(weeklyPickToSourceResolution(pick)); setFeedback(null); scrollToSource(); }} accessibilityRole="button" accessibilityLabel={`Review ${pick.displayName}${pick.featuredMedia ? `, featuring ${pick.featuredMedia.title}` : ""}`} style={[styles.pickPreview, index > 0 && styles.supportingPreview]}>
        {pick.featuredMedia ? index === 0 ? <MediaMount><MediaImage source={pick.featuredMedia.thumbnailUrl ? { uri: pick.featuredMedia.thumbnailUrl } : null} style={styles.heroImage} contentFit="cover" cachePolicy="none" /></MediaMount> : <MediaImage source={pick.featuredMedia.thumbnailUrl ? { uri: pick.featuredMedia.thumbnailUrl } : null} style={styles.supportingImage} contentFit="cover" cachePolicy="none" /> : <MediaImage source={pick.thumbnailUrl ? { uri: pick.thumbnailUrl } : null} style={styles.avatar} contentFit="cover" cachePolicy="none" />}
        <View style={[styles.pickCopy, index > 0 && styles.supportingCopy]}>
        <Text style={index === 0 ? styles.featuredTitle : type.label}>{pick.featuredMedia?.title ?? pick.displayName}</Text>
        {pick.featuredMedia ? <Text style={type.bodySoft}>{pick.displayName}</Text> : null}
        <Text style={styles.interestMatch}>{interestTopicFromId(pick.interestId)?.name ?? "From your interests"}</Text>
        {pick.featuredMedia ? <Text style={type.caption}>{pick.featuredMedia.durationSeconds ? formatDuration(pick.featuredMedia.durationSeconds) : "Duration unavailable"}</Text> : <Text style={type.caption}>Video preview unavailable for this source.</Text>}
        {index === 0 && pick.recommendationReason ? <Text style={type.bodySoft}>{pick.recommendationReason}</Text> : null}
        <Text style={styles.pickAction}>Review source</Text></View>
      </Pressable>) : <Text style={type.bodySoft} accessibilityLiveRegion="polite">{emptyMessage}</Text>}
      {preview.kind === "ready" && preview.message ? <Text style={type.caption}>{preview.message}</Text> : null}
      <View style={styles.previewNavigation}>
        {previousPage !== null ? <Pressable disabled={busy || picks.isFetching} onPress={() => { setPage(previousPage); scrollToSource(); }} accessibilityRole="button" style={styles.textButton}><Text style={styles.link}>Previous selection</Text></Pressable> : null}
        {nextPage !== null ? <Pressable disabled={busy || picks.isFetching} onPress={() => { setPage(nextPage); scrollToSource(); }} accessibilityRole="button" style={styles.textButton}><Text style={styles.link}>See another selection</Text></Pressable> : null}
      </View>
      {preview.retry ? <Pressable disabled={picks.isFetching || busy} onPress={() => { setPage(0); void picks.refetch(); }} accessibilityRole="button" accessibilityState={{ busy: picks.isFetching, disabled: picks.isFetching || busy }} style={styles.textButton}><Text style={styles.link}>{picks.isFetching ? "Trying again…" : "Try suggestions again"}</Text></Pressable> : null}
      </InlineHelp>
    </View> : null}

    {followedChannels.length > 0 ? <View style={styles.followed}><Text style={type.label}>Your sources · {followedChannels.length}</Text>{followedChannels.slice(0, 3).map((source) => <View style={styles.followedRow} key={source.id}><Check size={17} color={palette.success} /><Text style={styles.followedName}>{source.title}</Text></View>)}{followedChannels.length > 3 ? <Text style={type.bodySoft}>And {followedChannels.length - 3} more in Sources.</Text> : null}</View> : <Text style={styles.note}>You can add more sources later. Each one shapes what appears in Today.</Text>}
  </MotionView>;
}

function createStyles(p: FramePalette, t: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: "transparent" }, scroll: { flex: 1 },
    topRow: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", paddingHorizontal: spacing.page, gap: spacing.md }, wordmark: { ...t.heading },
    textButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.xs }, link: { ...t.label, color: p.active },
    progress: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.md },
    content: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, paddingTop: spacing.lg, paddingBottom: spacing.xxl }, replayNote: { ...t.caption, marginBottom: spacing.lg },
    stageLabel: { ...t.caption, width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page },
    previewNavigation: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: spacing.md },
    interestGroup: { marginTop: spacing.xl }, featuredTitle: { ...t.heading, fontSize: 24, lineHeight: 32 }, interestMatch: { ...t.caption, color: p.active },
    pickPreview: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border }, supportingPreview: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, pickCopy: { gap: spacing.sm }, supportingCopy: { flex: 1 },
    heroImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.media }, supportingImage: { width: 96, aspectRatio: 16 / 9, borderRadius: radii.media },
    keySetup: { marginTop: spacing.md, gap: spacing.xs },
    suggestions: { gap: spacing.sm, marginTop: spacing.lg }, pickAction: { ...t.label, color: p.active, marginTop: spacing.sm }, continueLink: { minHeight: 48, flexBasis: "100%", alignItems: "center", justifyContent: "center" },
    title: { ...t.title, fontSize: 36, lineHeight: 44 }, body: { ...t.bodySoft, marginTop: spacing.md }, note: { ...t.bodySoft, marginTop: spacing.lg },
    fieldLabel: { ...t.label, marginTop: spacing.xl }, inputRow: { marginTop: spacing.sm },
    sourceAction: { minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: p.accentDeep, marginTop: spacing.md }, sourcePreview: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, avatar: { width: 48, height: 48, borderRadius: radii.source }, flex: { flex: 1 }, sourceMeta: { ...t.bodySoft, marginTop: spacing.xs },
    followed: { marginTop: spacing.xl, gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, followedRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, followedName: { ...t.body, flex: 1 },
    footer: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, alignItems: "center", paddingHorizontal: spacing.page, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, primary: { flexGrow: 1, flexBasis: 180, minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", backgroundColor: p.accentDeep, borderRadius: radii.control }, primaryText: { ...t.label, color: p.onDark, textAlign: "center" }, disabled: { opacity: 0.55 },
  });
}
