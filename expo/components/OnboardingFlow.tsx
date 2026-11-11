import { onboardingPosters } from "@/constants/onboardingPosters";
import PrimaryAction from "@/components/PrimaryAction";
import { useOnboardingBack } from "@/hooks/useOnboardingBack";
import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import { providerKeyState, unavailableKeyStorageMessage } from "@/domain/providerKeyStatus";
import Text from "@/components/FrameText";
import InlineHelp from "@/components/InlineHelp";
import TodaySelectionSetting from "@/components/TodaySelectionSetting";
import CustomInterestInput from "@/components/CustomInterestInput";
import { readPendingWatch, takePendingWatch } from "@/storage/pendingWatchStorage";
import { onboardingSourceLink } from "@/domain/onboardingDraft";
import MediaMount from "@/components/MediaMount";
import { useOnboardingDraft } from "@/hooks/useOnboardingDraft";
import { parseSourceInput } from "@/domain/sourceInput";
import { formatDuration } from "@/services/youtube";
import ProgressSegment from "@/components/motion/ProgressSegment";
import TextField from "@/components/TextField";
import MotionView from "@/components/motion/MotionView";
import OnboardingIdentity from "@/components/motion/OnboardingIdentity";
import WelcomeShowcase from "@/components/WelcomeShowcase";
import IntroductionSheet from "@/components/IntroductionSheet";
import ProviderKeySettings from "@/components/ProviderKeySettings";
import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import InterestPicksReveal from "@/components/InterestPicksReveal";
import GenerateWeeklyPicks from "@/components/GenerateWeeklyPicks";
import { CuratingSelection } from "@/components/motion/CuratingSelection";
import type { DiscoveryStage } from "@/services/byokWeeklyPicks";
import { CAN_PREVIEW_LIBRARY, PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import PreviewKeySetup from "@/preview/PreviewKeySetup";
import type { KeyProvider } from "@/storage/providerKeys";
import PreviewPrintRoom from "@/preview/PreviewPrintRoom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { weeklyEditionService } from "@/services/weeklyEditionInstance";
import { weeklyDiscoveryPeriodKey } from "@/services/discovery";
import ChoiceOption from "@/components/ChoiceOption";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { router } from "expo-router";
import { Check, ChevronDown, ChevronUp, Link2, Play, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingReveal from "@/components/OnboardingReveal";
import MediaImage from "@/components/MediaImage";
import { FRAME_PLAYBACK_ROUTE, ONBOARDING_STEPS } from "@/constants/navigation";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { resolvedOnboardingFilm, interestPickWatchItem, onboardingDestination, onboardingNextAction, type OnboardingWatchItem } from "@/domain/onboarding";
import { useApp } from "@/providers/AppProvider";
import type { SourceResolution, Video } from "@/types";
import { notifyUser } from "@/services/notifyUser";

const steps = ONBOARDING_STEPS;
const starterTopicIds = ["science", "history", "design", "film", "cooking", "making"];
const starterTopics = INTEREST_LIBRARY.filter((topic) => starterTopicIds.includes(topic.id));
const otherTopics = INTEREST_LIBRARY.filter((topic) => !starterTopicIds.includes(topic.id));

export default function OnboardingFlow({ replay = false }: { replay?: boolean }) {
  const { activeProfileId } = useApp();
  return <ProfileOnboarding key={`${activeProfileId}:${replay}`} replay={replay} />;
}

function ProfileOnboarding({ replay }: { replay: boolean }) {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, activeProfile, interests, followedChannels, savedVideos, finishOnboarding, getPlaybackAllowance, requirePurchase, profileSwitching } = useApp();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const client = useQueryClient();
  const keyStatus = useProviderKeyStatus();
  const hasYouTubeKey = providerKeyState(keyStatus) === "ready" && keyStatus.data?.youtube;
  const revealed = useRef(false);
  const identityPresented = useRef(false);
  const setup = useOnboardingDraft(activeProfileId, replay);
  const { step, savedIds: savedDuringSetup } = setup.draft;
  const setDraft = setup.setDraft;
  const setStep = useCallback((next: number) => setDraft((draft) => ({ ...draft, step: next })), [setDraft]);
  const [typedSource, setTypedSource] = useState<string | null>(null);
  const sourceInput = typedSource ?? setup.draft.sourceLink ?? "";
  const setSourceInput = (value: string) => {
    setTypedSource(value);
    const sourceLink = onboardingSourceLink(value);
    setDraft((draft) => draft.sourceLink === sourceLink ? draft : { ...draft, path: "creator", sourceLink });
  };
  const [linkedVideo, setLinkedVideo] = useState<string | null>(null);
  useEffect(() => {
    if (replay) return;
    let active = true;
    void readPendingWatch(activeProfileId).then((id) => { if (active) setLinkedVideo(id); }).catch(() => {});
    return () => { active = false; };
  }, [activeProfileId, replay]);
  const [introOpen, setIntroOpen] = useState(false);
  const returnTo = setup.draft.returnTo ?? null;
  const setReturnTo = (next: "source" | "your-frame" | null) => setDraft((draft) => ({ ...draft, returnTo: next ?? undefined }));
  const manual = setup.draft.path === "creator" || activeProfile?.role !== "owner";
  const creatorOrigin = useRef(steps.indexOf("source"));
  const choosePath = (creator: boolean) => {
    if (creator) creatorOrigin.current = step;
    setDraft((draft) => ({ ...draft, path: creator ? "creator" : undefined }));
  };
  const needsTopic = steps[step] === "source" && !manual && interests.length === 0;
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const sourceLock = useRef(false);
  const onStepBusyChange = useCallback((value: boolean) => { sourceLock.current = value; setBusy(value); }, []);
  const scroll = useRef<ScrollView>(null);
  const progress = useRef<View>(null);
  const lastStage = useRef<string | null>(null);
  const current = steps[step];
  const [finding, setFinding] = useState(false);
  const [searchStage, setSearchStage] = useState<DiscoveryStage | null>(null);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => { if (finding || previewing) scroll.current?.scrollTo({ y: 0, animated: false }); }, [finding, previewing]);
  const onFinding = useCallback((value: boolean) => { setFinding(value); onStepBusyChange(value); }, [onStepBusyChange]);
  const topicIds = interests.map((topic) => topic.id).sort();
  const canGenerate = current === "source" && !manual && Boolean(hasYouTubeKey && keyStatus.data?.gemini && topicIds.length);
  const edition = useQuery({ queryKey: ["onboarding-picks", activeProfileId, weeklyDiscoveryPeriodKey(), topicIds.join(",")], queryFn: () => weeklyEditionService.preview(topicIds, activeProfileId), enabled: current === "source" && !manual && topicIds.length > 0 && !PREVIEW_LIBRARY_ENABLED, networkMode: "always", staleTime: Infinity, retry: false, refetchOnWindowFocus: false });
  const offerGeneration = canGenerate && (finding || edition.data?.reason === "configuration");
  useEffect(() => {
    const changed = lastStage.current !== null && lastStage.current !== current;
    lastStage.current = current;
    if (!changed) return;
    const frame = requestAnimationFrame(() => {
      if (Platform.OS === "web") { progress.current?.focus(); return; }
      const node = findNodeHandle(progress.current); if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [current]);
  const savedCount = savedDuringSetup.filter((id) => savedVideos.some((video) => video.id === id)).length;
  const destination = onboardingDestination(followedChannels.length, replay, savedCount);
  const nextAction = onboardingNextAction(current, followedChannels.length, replay, savedCount, returnTo, manual);
  const [sampleKeys, setSampleKeys] = useState<KeyProvider[]>([]);
  const sampleSetup = CAN_PREVIEW_LIBRARY && replay && activeProfile?.role === "owner";
  const youtubeConnected = sampleSetup ? sampleKeys.includes("youtube") : hasYouTubeKey;
  const geminiConnected = sampleSetup ? sampleKeys.includes("gemini") : keyStatus.data?.gemini;
  const missingConnection = current === "keys" && activeProfile?.role === "owner" && (sampleSetup || providerKeyState(keyStatus) === "ready") && (!youtubeConnected || !geminiConnected);
  const chooseCreatorNext = current === "keys" && youtubeConnected && !geminiConnected && !returnTo && !manual && !PREVIEW_LIBRARY_ENABLED;
  const finishWithInterests = current === "source" && !manual && !PREVIEW_LIBRARY_ENABLED && !canGenerate && edition.data?.reason === "configuration";
  const connectForPicks = finishWithInterests && providerKeyState(keyStatus) === "ready";
  const showLinkedVideo = linkedVideo && !returnTo && !(manual && sourceInput) && (current === "welcome" || current === "keys");
  const openLinkedVideo = Boolean(showLinkedVideo && youtubeConnected);
  let nextLabel = nextAction.label;
  if (missingConnection && !returnTo) nextLabel = youtubeConnected ? "Continue without Gemini" : "Set up later";
  if (chooseCreatorNext) nextLabel = "Choose a video or creator";
  if (finishWithInterests) nextLabel = connectForPicks ? (hasYouTubeKey ? "Connect Gemini for picks" : "Connect for weekly picks") : "Finish setup";
  if (returnTo === "source" && !manual && current === "keys") nextLabel = "Back to my interests";
  if (current === "keys" && manual && sourceInput && (returnTo === "source" || youtubeConnected)) nextLabel = parseSourceInput(sourceInput).kind === "video" ? "Back to my video link" : "Back to my creator";
  if (openLinkedVideo) nextLabel = "Open linked video";
  const quietNext = !openLinkedVideo && (current === "keys" ? missingConnection && !returnTo && !chooseCreatorNext : manual && current === "source" && followedChannels.length === 0);
  const finish = async (target?: typeof destination, video?: OnboardingWatchItem, requestedLink?: string) => {
    if (locked.current || sourceLock.current || profileSwitching || (video && (video.profileId !== activeProfileId || !requirePurchase("library")))) return;
    locked.current = true; setBusy(true); Keyboard.dismiss();
    try {
      if (video) {
        const allowance = await getPlaybackAllowance(activeProfileId);
        if (!mounted.current) return;
        if (!allowance.canPlay) { notifyUser("Playback isn’t available now", allowance.kind === "ownerReview" || allowance.kind === "restricted" ? allowance.reason : "Today’s viewing time is complete. You can still save this video."); return; }
      }
      if (video && !video.periodKey) {
        // A reviewed pick or resolved film already has provider metadata. The
        // player still checks freshness, duration, and profile access.
        client.setQueryData<Video>(["recovered-video", activeProfileId, video.id], (old) =>
          (old?.fetchedAt ?? 0) > video.fetchedAt ? old : {
            id: video.id, title: video.title, channelId: video.sourceId, channelTitle: video.sourceTitle,
            thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds,
            publishedAt: video.publishedAt, fetchedAt: video.fetchedAt, madeForKids: video.madeForKids,
          });
      }
      if (!replay) { await finishOnboarding(); if (!mounted.current) return; await setup.clear().catch(() => {}); }
      const storedLink = replay ? null : await takePendingWatch(activeProfileId).catch(() => null);
      const pending = requestedLink ?? (target ? null : storedLink);
      if (!mounted.current) return;
      router.replace(video ? { pathname: FRAME_PLAYBACK_ROUTE, params: { id: video.id, title: video.title, channelId: video.sourceId, channelTitle: video.sourceTitle, thumbnailUrl: video.thumbnailUrl, publishedAt: video.publishedAt, durationSeconds: String(video.durationSeconds), cachedMetadata: "1", fetchedAt: String(video.fetchedAt), ...(video.periodKey ? { origin: "today", todayProfileId: activeProfileId, todayPeriodKey: video.periodKey } : {}) } } : pending ? { pathname: FRAME_PLAYBACK_ROUTE, params: { id: pending } } : (target ?? destination));
    }
    catch { if (mounted.current) notifyUser("Couldn’t finish setup", "Your choices are still here. Try again."); }
    finally { locked.current = false; setBusy(false); }
  };
  const goTo = (index: number) => {
    if (locked.current || sourceLock.current) return;
    setPreviewing(false);
    if (index !== steps.indexOf("keys")) setReturnTo(null);
    Keyboard.dismiss(); setStep(Math.max(0, Math.min(steps.length - 1, index)));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const goBack = () => {
    if (previewing) { setPreviewing(false); return; }
    if (current === "source" && manual && activeProfile?.role === "owner") {
      choosePath(false);
      goTo(creatorOrigin.current);
    } else goTo(returnTo ? steps.indexOf(returnTo) : step - 1);
  };
  useOnboardingBack(replay, step, () => locked.current || sourceLock.current, goBack, Boolean(returnTo));
  const advance = () => {
    if (openLinkedVideo && linkedVideo) void finish(destination, undefined, linkedVideo);
    else if (chooseCreatorNext) { choosePath(true); goTo(steps.indexOf("source")); }
    else if (connectForPicks) { setReturnTo("source"); goTo(steps.indexOf("keys")); }
    else if (finishWithInterests || nextAction.finish) void finish();
    else if (previewing) goTo(steps.indexOf("your-frame"));
    else if (PREVIEW_LIBRARY_ENABLED && current === "source" && !manual) setPreviewing(true);
    else goTo(nextAction.target ? steps.indexOf(nextAction.target) : step + 1);
  };
  if (!setup.ready) return <View style={[styles.screen, { justifyContent: "center" }]}><ActivityIndicator color={palette.active} accessibilityLabel="Restoring setup" /></View>;
  return <KeyboardAvoidingView style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
      {step === 0 ? <OnboardingIdentity enter={setup.fresh && !identityPresented.current} onPresented={() => { identityPresented.current = true; }} /> : <Text style={styles.wordmark}>Frame</Text>}
      <Pressable disabled={busy} onPress={() => { if (replay && router.canGoBack()) router.back(); else void finish(); }} style={styles.textButton} accessibilityRole="button" accessibilityState={{ disabled: busy }}><Text style={styles.link}>{replay ? "Close setup" : "Skip setup"}</Text></Pressable>
    </View>
    <View ref={progress} tabIndex={-1} style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={`Setup progress: ${["Welcome", "API connections", manual ? "Video or creator" : "Your interests", "Your first selection"][step]}`} accessibilityValue={{ min: 1, max: steps.length, now: step + 1, text: `Step ${step + 1} of ${steps.length}` }}>
      {steps.map((name, i) => <ProgressSegment key={name} complete={i <= step} />)}
    </View>
    <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={[styles.content, current === "welcome" && styles.welcomeContent]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <MotionView changeKey={current} active={current !== "your-frame"} distance={6} style={current === "welcome" ? styles.welcomeBody : undefined}>
      {setup.error ? <Text style={styles.note} accessibilityLiveRegion="polite">Your setup position couldn’t be saved. Your followed sources and saved videos are kept separately.</Text> : null}
      {current === "source" && !manual ? PREVIEW_LIBRARY_ENABLED && previewing ? <PreviewPrintRoom onReady={() => goTo(steps.indexOf("your-frame"))} /> : finding && searchStage ? <CuratingSelection stage={searchStage} /> : <>
        <TasteStep finding={finding} onChooseCreator={() => choosePath(true)} onBusyChange={onStepBusyChange} />
        {finishWithInterests && <Text style={type.bodySoft}>{connectForPicks ? "Your interests are saved. Weekly picks use YouTube and Gemini." : unavailableKeyStorageMessage(Platform.OS === "web")}</Text>}
      </> : null}
      {current === "source" && manual ? <SourceStep onWatch={(video) => { void finish(destination, video); }} finishing={busy} firstSelection={!replay} link={sourceInput} setLink={setSourceInput} onFollowed={() => goTo(steps.indexOf("your-frame"))} scrollToSource={() => scroll.current?.scrollTo({ y: 0, animated: false })} onSetUpKeys={() => { setReturnTo("source"); goTo(steps.indexOf("keys")); }} onBusyChange={onStepBusyChange} /> : null}
      {current === "welcome" ? <WelcomeShowcase /> : null}
      {showLinkedVideo && <Text style={type.bodySoft} accessibilityLiveRegion="polite">
        {youtubeConnected ? "Your linked video is ready to open." : "Frame has kept your video link. Connect YouTube to open it."}
      </Text>}
      {current === "keys" ? sampleSetup
        ? <PreviewKeySetup saved={sampleKeys} onSave={(provider) => setSampleKeys((keys) => [...new Set([...keys, provider])])} />
        : <ProviderKeySettings onboarding weeklyPicksRequested={Boolean(returnTo && !manual)} onBusyChange={onStepBusyChange}
          youtubeGuide={setup.draft.youtubeGuide} onYouTubeGuideChange={(youtubeGuide) => setDraft((existing) => ({ ...existing, youtubeGuide }))} /> : null}
      {current === "your-frame" && !manual ? <InterestPicksReveal onBrowse={() => scroll.current?.scrollTo({ y: 0, animated: false })} interestIds={interests.map((interest) => interest.id)} onWatch={(pick) => { const video = interestPickWatchItem(pick, activeProfileId, Date.now()); if (video) void finish(destination, video); else notifyUser("This pick is unavailable", "Its video details need to be refreshed."); }} onChooseCreator={() => { choosePath(true); goTo(steps.indexOf("source")); }} onChooseTopics={() => goTo(steps.indexOf("source"))} onSetUpKeys={() => { setReturnTo("your-frame"); goTo(steps.indexOf("keys")); }} onBusyChange={onStepBusyChange} /> : null}
      {current === "your-frame" && manual ? <>
        <OnboardingReveal onWatch={(item) => { void finish(destination, item); }} finishing={busy} onBrowseSources={() => { void finish("/(tabs)/sources"); }} animateReveal={!revealed.current} onRevealed={() => { revealed.current = true; }} savedHere={savedDuringSetup} onSaved={(id) => setup.setDraft((draft) => ({ ...draft, savedIds: [...new Set([...draft.savedIds, id])] }))} onChooseSource={() => goTo(steps.indexOf("source"))} onBusyChange={onStepBusyChange} />
      </> : null}
      </MotionView>
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {current === "welcome" && <Pressable accessibilityRole="button" accessibilityLabel="Watch introduction, 28 seconds" onPress={() => setIntroOpen(true)} style={styles.introAction}>
        <Play size={15} color={palette.active} fill={palette.active} />
        <Text style={styles.link}>Watch intro · 0:28</Text>
      </Pressable>}
      {step > 0 || returnTo ? <Pressable disabled={busy} onPress={goBack} style={styles.textButton} accessibilityRole="button" accessibilityState={{ disabled: busy }}><Text style={styles.link}>Back</Text></Pressable> : null}
      {offerGeneration ? <View style={{ flexGrow: 1, flexBasis: 240 }}><GenerateWeeklyPicks onSetUpKeys={() => { setReturnTo("source"); goTo(steps.indexOf("keys")); }} onBusyChange={onFinding} onPresentationStage={setSearchStage} onPrepared={() => { onFinding(false); goTo(steps.indexOf("your-frame")); }} /></View> : <PrimaryAction depth={!quietNext && palette.primaryButtonDepth} disabled={busy || needsTopic} onPress={advance} style={[styles.primary, quietNext && styles.quietNext, (busy || needsTopic) && styles.disabled]} accessibilityRole="button" accessibilityLabel={previewing ? "Show sample picks now" : nextLabel} accessibilityState={{ busy, disabled: busy || needsTopic }} testID="onboarding-next">
        {busy ? <ActivityIndicator color={quietNext ? palette.active : palette.onDark} /> : <Text style={quietNext ? styles.link : styles.primaryText}>{previewing ? "Show sample picks now" : nextLabel}</Text>}
      </PrimaryAction>}
    </View>
    <IntroductionSheet visible={introOpen} onClose={() => setIntroOpen(false)} onConnect={() => { setIntroOpen(false); goTo(steps.indexOf("keys")); }} />
  </KeyboardAvoidingView>;
}

function TasteStep({ finding, onChooseCreator, onBusyChange }: { finding: boolean; onChooseCreator(): void; onBusyChange(value: boolean): void }) {
  const { type, palette } = useFrameTheme();
  const { interests, toggleInterest } = useApp();
  const feedback = useFeedback();
  const { width, fontScale } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [changing, setBusy] = useState(false);
  const busy = finding || changing;
  const lock = useRef(false);
  const ids = interests.map((topic) => topic.id);
  const shown = [
    ...starterTopics,
    ...otherTopics.filter((topic) => expanded || ids.includes(topic.id)),
    ...interests.filter((topic) => topic.id.startsWith("custom:")),
  ];
  const select = async (id: string) => {
    if (busy || lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true);
    const done = feedback.capture();
    try { const changed = await toggleInterest(id); done("selection", changed); return changed; }
    catch { notifyUser("Couldn’t save this interest", "Try again in a moment."); return false; }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  };
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return <View style={{ gap: spacing.md }}>
    <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
      <Text style={[type.title, { fontSize: 36, lineHeight: 43 }]} accessibilityRole="header">What draws you in?</Text>
      <Text style={[type.bodySoft, { fontSize: 18, lineHeight: 26, maxWidth: 470 }]}>Choose one or more topics. Your choices guide Frame’s weekly video picks.</Text>
    </View>
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.sm }}>
        <Text style={type.heading}>Topics</Text>
        <Text style={type.label} accessibilityLiveRegion="polite">{ids.length} selected</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {shown.map(({ id, name }) => <ChoiceOption key={id} role="checkbox" variant="topic" label={name}
          selected={ids.includes(id)} disabled={busy} unselectedMark={<Plus size={15} color={palette.inkMuted} />}
          onPress={() => { void select(id); }} style={{ flexGrow: 1, flexBasis: width < 360 || fontScale > 1.3 ? "100%" : "45%" }}
          testID={`setup-topic-${id}`} />)}
      </View>
      {(expanded || otherTopics.some((topic) => !ids.includes(topic.id))) && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)} style={{ alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={[type.label, { color: palette.active }]}>{expanded ? "Show fewer topics" : `Show all ${INTEREST_LIBRARY.length} topics`}</Text>
        <Chevron size={16} color={palette.active} />
      </Pressable>}
    </View>
    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft }}>
      <CustomInterestInput compact selectedIds={ids} onAdd={async (id) => Boolean(await select(id))} disabled={busy} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={onChooseCreator} style={{ minHeight: 44, justifyContent: "center" }}><Text style={[type.label, { color: palette.active }]}>Start with a creator instead</Text></Pressable>
    </View>
  </View>;
}

function SourceStep({ onWatch, finishing, onBusyChange, onSetUpKeys, onFollowed, scrollToSource, link, setLink, firstSelection }: { onWatch(video: OnboardingWatchItem): void; finishing: boolean; link: string; setLink(value: string): void; onBusyChange(value: boolean): void; onSetUpKeys(): void; onFollowed(): void; scrollToSource(): void; firstSelection: boolean }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const touch = useFeedback();
  const keyStatus = useProviderKeyStatus();
  const keyState = providerKeyState(keyStatus);
  const canLookUp = keyState === "ready" && keyStatus.data?.youtube === true;
  const { resolveSourceInput, confirmSource, followedChannels, activeProfile, activeProfileId } = useApp();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(Boolean(link));
  const [resolution, setResolution] = useState<SourceResolution | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const lock = useRef(false);
  const lookup = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; lookup.current?.abort(); }; }, []);
  const submit = async () => {
    if (lock.current || (!resolution && (!link.trim() || !canLookUp))) return;
    lock.current = true; setBusy(true); onBusyChange(Boolean(resolution)); setFeedback(null);
    const done = touch.capture();
    let followed = false;
    try {
      if (resolution) {
        const result = await confirmSource(resolution);
        if (!mounted.current) return;
        if (result.ok) { done("commit"); setLink(""); Keyboard.dismiss(); followed = true; }
        else setFeedback(result);
      } else {
        const controller = new AbortController(); lookup.current = controller;
        const result = await resolveSourceInput(link.trim(), controller.signal);
        if (!mounted.current) return;
        if (result.status === "success") setResolution(result.data);
        else setFeedback({ ok: false, message: result.message ?? "Source not found. Check the link or @handle and try again." });
      }
    } catch { if (mounted.current) setFeedback({ ok: false, message: "Couldn’t add this source. Check your connection and try again." }); }
    finally { lookup.current = null; lock.current = false; if (mounted.current) { setBusy(false); onBusyChange(false); if (followed) onFollowed(); } }
  };
  const film = resolvedOnboardingFilm(resolution, activeProfileId, Date.now());
  const isVideoLink = parseSourceInput(link).kind === "video";
  const showInput = !resolution && (adding || !followedChannels.length);
  return <MotionView changeKey={resolution?.source.providerSourceId ?? "source-input"}>
    <Text style={styles.title} accessibilityRole="header">{resolution ? film ? "Your video." : "Is this your creator?" : showInput ? "Start with a favorite." : "Your creators."}</Text>
    {showInput ? <>
    <Text style={styles.fieldLabel}>Paste a YouTube link or @handle</Text>
    {activeProfile?.role === "owner" && !canLookUp ? <View style={styles.keySetup}>
      <Text style={type.bodySoft} accessibilityLiveRegion="polite">{keyState === "checking" ? "Checking YouTube setup…" : keyState === "error" ? "YouTube setup couldn’t be checked. Try again or review your key." : keyState === "unavailable" ? unavailableKeyStorageMessage(Platform.OS === "web") : isVideoLink ? "Connect YouTube to find this video. Your link will be here when you return." : "Connect YouTube to find videos and creators."}</Text>
      {keyState === "error" || (keyState === "unavailable" && Platform.OS !== "web") ? <Pressable accessibilityRole="button" disabled={keyStatus.isFetching} accessibilityState={{ disabled: keyStatus.isFetching, busy: keyStatus.isFetching }} onPress={() => { void keyStatus.refetch(); }} style={styles.textButton}><Text style={styles.link}>{keyStatus.isFetching ? "Checking…" : "Try secure storage again"}</Text></Pressable> : null}
      {keyState === "ready" || keyState === "error" ? <Pressable accessibilityRole="button" onPress={onSetUpKeys} style={styles.textButton}><Text style={styles.link}>{keyState === "error" ? "Review YouTube key" : "Set up YouTube key"}</Text></Pressable> : null}
    </View> : !canLookUp ? <Text style={styles.note}>The Owner can add the YouTube key in Settings → YouTube & Gemini.</Text> : null}
    <TextField containerStyle={styles.inputRow} leading={<Link2 size={18} color={palette.inkMuted} />} value={link} editable={!busy} onChangeText={(value) => { setLink(value); setResolution(null); setFeedback(null); }} placeholder="@creator" placeholderTextColor={palette.inkMuted} autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => { void submit(); }} returnKeyType="done" accessibilityLabel="YouTube video link, channel link or @handle" testID="onboard-source-link" />
    </> : null}
    {resolution?.video ? <View style={styles.pickPreview}><MediaMount><MediaImage source={resolution.video.thumbnailUrl ? { uri: resolution.video.thumbnailUrl } : null} fallbackSource={onboardingPosters.owl} style={styles.heroImage} contentFit="cover" cachePolicy="none" /></MediaMount><Text style={styles.featuredTitle}>{resolution.video.title}</Text>{resolution.video.durationSeconds ? <Text style={type.caption}>{formatDuration(resolution.video.durationSeconds)}</Text> : null}</View> : null}
    {resolution ? <View style={styles.sourcePreview} testID="onboard-source-preview">
      <MediaImage source={resolution.source.thumbnailUrl ? { uri: resolution.source.thumbnailUrl } : null} style={styles.avatar} contentFit="cover" cachePolicy="none" />
      <View style={styles.flex}><Text style={type.heading}>{resolution.source.displayName}</Text><Text style={styles.sourceMeta}>{resolution.source.handle ?? "Channel"}</Text></View>
    </View> : null}
    {film ? <PrimaryAction depth={palette.primaryButtonDepth} disabled={busy || finishing} accessibilityRole="button"
      accessibilityLabel={`Watch ${film.title}`} accessibilityState={{ disabled: busy || finishing }}
      onPress={() => onWatch(film)} style={styles.sourceAction}>
      <Text style={styles.primaryText}>Watch this video</Text>
    </PrimaryAction> : null}
    {resolution || (showInput && canLookUp) ? <PrimaryAction depth={!film && palette.primaryButtonDepth} disabled={finishing || busy || (!resolution && !link.trim())} onPress={() => { void submit(); }} accessibilityRole="button" accessibilityState={{ busy, disabled: finishing || busy || (!resolution && !link.trim()) }} style={[film ? styles.textButton : styles.sourceAction, (busy || (!resolution && !link.trim())) && styles.disabled]} testID={resolution ? "onboard-confirm-source" : "onboard-resolve-source"}><Text style={film ? styles.link : styles.primaryText}>{busy ? (resolution ? "Following…" : "Looking up…") : resolution ? "Follow & see my selection" : isVideoLink ? "Find video" : "Find creator"}</Text></PrimaryAction> : null}
    {!resolution && !showInput ? <Pressable disabled={busy} onPress={() => setAdding(true)} style={styles.textButton} accessibilityRole="button"><Text style={styles.link}>Add another creator</Text></Pressable> : null}
    {resolution ? <Pressable disabled={busy} onPress={() => { setResolution(null); setLink(""); setFeedback(null); }} style={styles.textButton} accessibilityRole="button"><Text style={styles.link}>Choose another source</Text></Pressable> : null}
    {feedback ? <Text style={[styles.note, { color: feedback.ok ? palette.success : palette.danger }]} accessibilityLiveRegion="polite">{feedback.message}</Text> : null}

    {followedChannels.length > 0 && !resolution ? <View style={styles.followed}>{followedChannels.slice(0, 3).map((source) => <View style={styles.followedRow} key={source.id}><Check size={17} color={palette.success} /><Text style={styles.followedName}>{source.title}</Text></View>)}{followedChannels.length > 3 ? <Text style={type.bodySoft}>{followedChannels.length - 3} more in Sources</Text> : null}<InlineHelp label="Daily selection size"><TodaySelectionSetting firstSelection={firstSelection} /></InlineHelp></View> : null}
  </MotionView>;
}

function createStyles(p: FramePalette, t: FrameType) {
  return StyleSheet.create({
    introAction: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
    screen: { flex: 1, backgroundColor: "transparent" }, scroll: { flex: 1 },
    topRow: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", paddingHorizontal: spacing.page, gap: spacing.md }, wordmark: { ...t.heading },
    textButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.xs }, link: { ...t.label, color: p.active },
    progress: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.md },
    content: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, paddingTop: spacing.md, paddingBottom: spacing.xl },
    welcomeContent: { flexGrow: 1, paddingBottom: 0 }, welcomeBody: { flexGrow: 1 },
    quietNext: { backgroundColor: p.activeSoft },
    previewNavigation: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: spacing.md },
    interestGroup: { marginTop: spacing.lg, gap: spacing.lg }, featuredTitle: { ...t.heading, fontSize: 24, lineHeight: 32 }, interestMatch: { ...t.caption, color: p.active },
    pickPreview: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border }, supportingPreview: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, pickCopy: { gap: spacing.sm }, supportingCopy: { flex: 1 },
    heroImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.media }, supportingImage: { width: 96, aspectRatio: 16 / 9, borderRadius: radii.media },
    keySetup: { marginTop: spacing.md, gap: spacing.xs },
    suggestions: { gap: spacing.sm, marginTop: spacing.lg }, pickAction: { ...t.label, color: p.active, marginTop: spacing.sm }, continueLink: { minHeight: 48, flexBasis: "100%", alignItems: "center", justifyContent: "center" },
    title: { ...t.title, fontSize: 36, lineHeight: 44 }, body: { ...t.bodySoft, marginTop: spacing.md }, note: { ...t.bodySoft, marginTop: spacing.lg },
    introduction: { marginBottom: spacing.lg },
    fieldLabel: { ...t.label, marginTop: spacing.xl }, inputRow: { marginTop: spacing.sm },
    sourceAction: { minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: p.accentDeep, marginTop: spacing.md }, sourcePreview: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, avatar: { width: 48, height: 48, borderRadius: radii.source }, flex: { flex: 1 }, sourceMeta: { ...t.bodySoft, marginTop: spacing.xs },
    followed: { marginTop: spacing.xl, gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, followedRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, followedName: { ...t.body, flex: 1 },
    footer: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, alignItems: "center", paddingHorizontal: spacing.page, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, primary: { flexGrow: 1, flexBasis: 180, minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", backgroundColor: p.accentDeep, borderRadius: radii.control }, primaryText: { ...t.label, color: p.onDark, textAlign: "center" }, disabled: { opacity: 0.55 },
  });
}
