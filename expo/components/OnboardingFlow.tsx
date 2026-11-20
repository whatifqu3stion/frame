import FirstDiscoveriesPreview from "@/preview/FirstDiscoveriesPreview";
import { onboardingPosters } from "@/constants/onboardingPosters";
import OnboardingGlimmer, { useOnboardingIdleCue } from "@/components/motion/OnboardingGlimmer";
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
import TexturedHeart from "@/components/TexturedHeart";
import Animated, { FadeIn, Easing } from "react-native-reanimated";
import { ShortVideoStudy } from "@/components/ShortVideoStudy";
import { ViewingStudy, ViewingContrast } from "@/components/OnboardingStory";
import { CUSTOM_INTEREST_LIMIT, isCustomInterest } from "@/domain/interests";
import WelcomeShowcase from "@/components/WelcomeShowcase";
import WelcomeContinueAction from "@/components/WelcomeContinueAction";
import { ConnectionHeader } from "@/components/ConnectionWalkthrough";
import type { KeyProvider } from "@/storage/providerKeys";
import ProviderKeySettings from "@/components/ProviderKeySettings";
import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import InterestPicksReveal from "@/components/InterestPicksReveal";
import GenerateWeeklyPicks from "@/components/GenerateWeeklyPicks";
import { CuratingSelection } from "@/components/motion/CuratingSelection";
import type { DiscoveryRunSnapshot } from "@/services/discoveryRun";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { weeklyEditionService } from "@/services/weeklyEditionInstance";
import { weeklyDiscoveryPeriodKey } from "@/services/discovery";
import ChoiceOption from "@/components/ChoiceOption";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { router } from "expo-router";
import { Check, Link2, Plus, X } from "lucide-react-native";
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

export default function OnboardingFlow({ replay = false, sampleReveal = false, loadingPreview = false }: { replay?: boolean; sampleReveal?: boolean; loadingPreview?: boolean }) {
  const { activeProfileId } = useApp();
  return <ProfileOnboarding key={`${activeProfileId}:${replay}`} replay={replay} sampleReveal={sampleReveal && __DEV__} loadingPreview={loadingPreview && __DEV__} />;
}

function ProfileOnboarding({ replay, sampleReveal, loadingPreview }: { replay: boolean; sampleReveal: boolean; loadingPreview: boolean }) {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, activeProfile, interests, followedChannels, finishOnboarding, getPlaybackAllowance, requirePurchase, profileSwitching } = useApp();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const client = useQueryClient();
  const onboardingTouch = useFeedback(!sampleReveal);
  const keyStatus = useProviderKeyStatus();
  const hasYouTubeKey = providerKeyState(keyStatus) === "ready" && keyStatus.data?.youtube;
  const [chosenProvider, setChosenProvider] = useState<KeyProvider | null>(null);
  const selectedProvider = chosenProvider ?? (hasYouTubeKey && !keyStatus.data?.gemini ? "gemini" : "youtube");
  const { height, fontScale } = useWindowDimensions();
  const showConnectionTitle = height / fontScale >= 600;
  const revealed = useRef(false);
  const [visitedStorySteps, setVisitedStorySteps] = useState<ReadonlySet<string>>(() => new Set());
  const [welcomeComplete, setWelcomeComplete] = useState(false);
  const [benefitsComplete, setBenefitsComplete] = useState(false);
  const setup = useOnboardingDraft(activeProfileId, replay);
  const { savedIds: savedDuringSetup } = setup.draft;
  const step = sampleReveal ? steps.indexOf("your-frame") : setup.draft.step;
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
  const returnTo = setup.draft.returnTo ?? null;
  const setReturnTo = (next: "source" | "your-frame" | null) => setDraft((draft) => ({ ...draft, returnTo: next ?? undefined }));
  const manual = setup.draft.path === "creator" || activeProfile?.role !== "owner";
  const creatorOrigin = useRef(steps.indexOf("source"));
  const choosePath = (creator: boolean) => {
    if (creator) creatorOrigin.current = step;
    setDraft((draft) => ({ ...draft, path: creator ? "creator" : undefined }));
  };
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const sourceLock = useRef(false);
  const onStepBusyChange = useCallback((value: boolean) => { sourceLock.current = value; setBusy(value); }, []);
  const scroll = useRef<ScrollView>(null);
  const progress = useRef<View>(null);
  const lastStage = useRef<string | null>(null);
  const current = steps[step];
  const [finishedStudy, setFinishedStudy] = useState<string | null>(null);
  const studyDone = useCallback(() => setFinishedStudy(current), [current]);
  const studyPage = current === "study" || current === "intentions" || current === "recall";
  const presentationDone = studyPage ? finishedStudy === current : current === "welcome" ? welcomeComplete : current === "contrast" ? benefitsComplete : true;
  const { showCue, onActivity } = useOnboardingIdleCue(current, setup.ready && presentationDone && !busy);
  const progressSteps = manual ? steps.filter(name => name !== "bespoke") : steps;
  const progressIndex = progressSteps.findIndex(name => name === current);
  const [finding, setFinding] = useState(false);
  const [searchStage, setSearchStage] = useState<DiscoveryRunSnapshot | null>(null);
  useEffect(() => { if (finding) scroll.current?.scrollTo({ y: 0, animated: false }); }, [finding]);
  const onFinding = useCallback((value: boolean) => { setFinding(value); onStepBusyChange(value); }, [onStepBusyChange]);
  const topicIds = interests.map((topic) => topic.id).sort();
  const canGenerate = current === "bespoke" && !manual && Boolean(hasYouTubeKey && keyStatus.data?.gemini && topicIds.length);
  const edition = useQuery({ queryKey: ["onboarding-picks", activeProfileId, weeklyDiscoveryPeriodKey(), topicIds.join(",")], queryFn: () => weeklyEditionService.preview(topicIds, activeProfileId), enabled: current === "bespoke" && !manual && topicIds.length > 0, networkMode: "always", staleTime: Infinity, retry: false, refetchOnWindowFocus: false });
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
  const destination = onboardingDestination(activeProfileId, !manual && topicIds.length > 0);
  const nextAction = onboardingNextAction(current, followedChannels.length, replay, returnTo, manual);
  const youtubeConnected = hasYouTubeKey;
  const geminiConnected = keyStatus.data?.gemini;
  const missingConnection = current === "keys" && activeProfile?.role === "owner" && providerKeyState(keyStatus) === "ready" && (!youtubeConnected || !geminiConnected);
  const showLinkedVideo = linkedVideo && !returnTo && !(manual && sourceInput) && (current === "welcome" || current === "keys");
  const openLinkedVideo = Boolean(showLinkedVideo && youtubeConnected);
  let nextLabel = nextAction.label;
  if (missingConnection && !returnTo) nextLabel = youtubeConnected ? "Continue without Gemini" : "Set up later";
  if (returnTo === "source" && !manual && current === "keys") nextLabel = "Back to my interests";
  if (current === "keys" && manual && sourceInput && returnTo === "source") nextLabel = parseSourceInput(sourceInput).kind === "video" ? "Back to my video link" : "Back to my creator";
  if (openLinkedVideo) nextLabel = "Open linked video";
  const quietNext = !openLinkedVideo && (current === "keys" ? missingConnection && !returnTo : manual && current === "source" && followedChannels.length === 0);
  const savingTopic = busy && current === "source" && !manual && !locked.current;
  const showFooterBusy = busy && !savingTopic;
  const finish = async (target?: "/(tabs)/sources", video?: OnboardingWatchItem, requestedLink?: string) => {
    if (locked.current || sourceLock.current || profileSwitching || (video && (video.profileId !== activeProfileId || !requirePurchase("library")))) return;
    locked.current = true; setBusy(true); Keyboard.dismiss();
    const acknowledge = onboardingTouch.capture();
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
      acknowledge(replay ? "commit" : "milestone");
      router.replace(video ? { pathname: FRAME_PLAYBACK_ROUTE, params: { id: video.id, title: video.title, channelId: video.sourceId, channelTitle: video.sourceTitle, thumbnailUrl: video.thumbnailUrl, publishedAt: video.publishedAt, durationSeconds: String(video.durationSeconds), cachedMetadata: "1", fetchedAt: String(video.fetchedAt), ...(video.periodKey ? { origin: "today", todayProfileId: activeProfileId, todayPeriodKey: video.periodKey } : {}) } } : pending ? { pathname: FRAME_PLAYBACK_ROUTE, params: { id: pending } } : (target ?? destination));
    }
    catch { if (mounted.current) notifyUser("Couldn’t finish setup", "Your choices are still here. Try again."); }
    finally { locked.current = false; setBusy(false); }
  };
  const goTo = (index: number, feedback: "selection" | "milestone" | false = "selection") => {
    if (locked.current || sourceLock.current) return;
    const next = Math.max(0, Math.min(steps.length - 1, index));
    if (next === step) return;
    if (index !== step && (current === "study" || current === "intentions" || current === "recall" || current === "contrast")) {
      setVisitedStorySteps(seen => seen.has(current) ? seen : new Set(seen).add(current));
    }
    if (index !== steps.indexOf("keys")) setReturnTo(null);
    Keyboard.dismiss(); setStep(next);
    if (feedback) onboardingTouch.capture()(feedback);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const goBack = () => {
    if (sampleReveal) { router.replace("/welcome-preview"); return; }
    if (current === "source" && manual && activeProfile?.role === "owner") {
      choosePath(false);
      goTo(creatorOrigin.current);
    } else if (current === "your-frame" && manual) goTo(steps.indexOf("source"));
    else goTo(returnTo ? steps.indexOf(returnTo) : step - 1);
  };
  useOnboardingBack(replay, step, () => locked.current || sourceLock.current, goBack, Boolean(returnTo));
  const advance = () => {
    if (openLinkedVideo && linkedVideo) void finish(undefined, undefined, linkedVideo);
    else if (nextAction.finish) void finish();
    else goTo(nextAction.target ? steps.indexOf(nextAction.target) : step + 1);
  };
  if (!setup.ready) return <View style={[styles.screen, { justifyContent: "center" }]}><ActivityIndicator color={palette.active} accessibilityLabel="Restoring setup" /></View>;
  const connectionsHeader = current === "keys" && activeProfile?.role === "owner" ? <ConnectionHeader
    provider={selectedProvider} presence={{ youtube: Boolean(hasYouTubeKey), gemini: Boolean(keyStatus.data?.gemini) }}
    storageState={providerKeyState(keyStatus)} showTitle={showConnectionTitle} busy={busy} onSelect={value => {
      Keyboard.dismiss();
      setChosenProvider(value);
      scroll.current?.scrollTo({ y: 0, animated: false });
    }} /> : null;
  const storyPage = current === "welcome" || current === "contrast";
  const StepBody = storyPage ? View : MotionView;
  return <KeyboardAvoidingView onTouchStart={onActivity} style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} enabled={Platform.OS === "ios"} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
      <OnboardingIdentity />
      <Pressable disabled={busy} onPress={() => { void finish(); }} style={styles.textButton} accessibilityRole="button" accessibilityState={{ disabled: busy }}><Text style={styles.link}>{replay ? "Close setup" : "Skip setup"}</Text></Pressable>
    </View>
    <View ref={progress} tabIndex={-1} style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={`Setup progress: ${["API connections", "Autoplay study", "Short-video break study", "Video recall study", "Welcome", "How Frame works", manual ? "Video or creator" : "Your interests", "Personal interests", "Your first selection"][step]}`} accessibilityValue={{ min: 1, max: progressSteps.length, now: progressIndex + 1, text: `Step ${progressIndex + 1} of ${progressSteps.length}` }}>
      {progressSteps.map((name, i) => <ProgressSegment key={name} complete={i <= progressIndex} />)}
    </View>
    {connectionsHeader && <View style={styles.connectionsHeader}>{connectionsHeader}</View>}
    <ScrollView onScrollBeginDrag={onActivity} onMomentumScrollEnd={onActivity} ref={scroll} style={styles.scroll} contentContainerStyle={[styles.content, storyPage && styles.welcomeContent]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <StepBody {...(storyPage ? { style: styles.welcomeBody } : { changeKey: current, active: current !== "your-frame", distance: 6 })}>
      {setup.error ? <Text style={styles.note} accessibilityLiveRegion="polite">Your setup position couldn’t be saved. Your followed sources and saved videos are kept separately.</Text> : null}
      {current === "study" && <ViewingStudy onComplete={studyDone} firstVisit={!visitedStorySteps.has(current)} />}
      {(current === "intentions" || current === "recall") && <ShortVideoStudy onComplete={studyDone} key={current} topic={current} firstVisit={!visitedStorySteps.has(current)} />}
      {current === "contrast" && <ViewingContrast firstVisit={!visitedStorySteps.has(current)} onCompletionChange={setBenefitsComplete} />}
      {current === "welcome" && <WelcomeShowcase onCompletionChange={setWelcomeComplete} />}
      {current === "source" && !manual && <TasteStep onChooseCreator={() => choosePath(true)} onBusyChange={onStepBusyChange} />}
      {current === "bespoke" && (finding && searchStage ? <CuratingSelection stage={searchStage.stage} reviewedCount={searchStage.reviewedCount} startedAt={searchStage.startedAt} /> : <BespokeStep disabled={busy} onBusyChange={onStepBusyChange} />)}
      {current === "source" && manual ? <SourceStep onWatch={(video) => { void finish(undefined, video); }} finishing={busy} firstSelection={!replay} link={sourceInput} setLink={setSourceInput} onFollowed={() => goTo(steps.indexOf("your-frame"))} scrollToSource={() => scroll.current?.scrollTo({ y: 0, animated: false })} onSetUpKeys={() => { setReturnTo("source"); goTo(steps.indexOf("keys")); }} onBusyChange={onStepBusyChange} /> : null}
      {showLinkedVideo && <Text style={type.bodySoft} accessibilityLiveRegion="polite">
        {youtubeConnected ? "Your linked video is ready to open." : "Frame has kept your video link. Connect YouTube to open it."}
      </Text>}
      {current === "keys" ? <ProviderKeySettings onboarding selectedProvider={selectedProvider} onBusyChange={onStepBusyChange}
          youtubeGuide={setup.draft.youtubeGuide} onYouTubeGuideChange={(youtubeGuide) => setDraft((existing) => ({ ...existing, youtubeGuide }))} /> : null}
      {sampleReveal ? <FirstDiscoveriesPreview loading={loadingPreview} /> : null}
      {current === "your-frame" && !manual && !sampleReveal ? <InterestPicksReveal finalReveal onBrowse={() => scroll.current?.scrollTo({ y: 0, animated: false })} interestIds={interests.map((interest) => interest.id)} onWatch={(pick) => { const video = interestPickWatchItem(pick, activeProfileId, Date.now()); if (video) void finish(undefined, video); else notifyUser("This pick is unavailable", "Its video details need to be refreshed."); }} onChooseCreator={() => { choosePath(true); goTo(steps.indexOf("source")); }} onChooseTopics={() => goTo(steps.indexOf("source"))} onSetUpKeys={() => { setReturnTo("your-frame"); goTo(steps.indexOf("keys")); }} onBusyChange={onStepBusyChange} /> : null}
      {current === "your-frame" && manual && !sampleReveal ? <>
        <OnboardingReveal onWatch={(item) => { void finish(undefined, item); }} finishing={busy} onBrowseSources={() => { void finish("/(tabs)/sources"); }} animateReveal={!revealed.current} onRevealed={() => { revealed.current = true; }} savedHere={savedDuringSetup} onSaved={(id) => setup.setDraft((draft) => ({ ...draft, savedIds: [...new Set([...draft.savedIds, id])] }))} onChooseSource={() => goTo(steps.indexOf("source"))} onBusyChange={onStepBusyChange} />
      </> : null}
      </StepBody>
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {step > 0 || returnTo ? <Pressable disabled={busy} onPress={goBack} style={styles.textButton} accessibilityRole="button" accessibilityState={{ disabled: busy }}><Text style={styles.link}>Back</Text></Pressable> : null}
      {offerGeneration ? <View style={{ flexGrow: 1, flexBasis: 240 }}><GenerateWeeklyPicks onSetUpKeys={() => { setReturnTo("source"); goTo(steps.indexOf("keys")); }} onBusyChange={onFinding} onPresentationStage={setSearchStage} onPrepared={(hasPicks) => { onFinding(false); goTo(steps.indexOf("your-frame"), hasPicks ? "milestone" : false); }} />{!busy && <Pressable accessibilityRole="button" onPress={() => { void finish(); }} style={styles.continueLink}><Text style={styles.link}>Open Today</Text>{showCue && <OnboardingGlimmer quiet />}</Pressable>}</View> : storyPage ? <WelcomeContinueAction showCue={showCue} key={current} complete={current === "welcome" ? welcomeComplete : benefitsComplete} label={nextLabel} disabled={busy} onPress={advance} style={styles.primary} /> : <PrimaryAction keepAppearance={savingTopic} textured={!quietNext} depth={!quietNext && palette.primaryButtonDepth} disabled={busy} onPress={advance} style={[styles.primary, quietNext && styles.quietNext, showFooterBusy && styles.disabled]} accessibilityRole="button" accessibilityLabel={nextLabel} accessibilityState={{ busy, disabled: busy }} testID="onboarding-next">
        {showCue && <OnboardingGlimmer quiet={Boolean(quietNext)} />}
        {showFooterBusy ? <ActivityIndicator color={quietNext ? palette.active : palette.onDark} /> : <Text style={quietNext ? styles.link : styles.primaryText}>{nextLabel}</Text>}
      </PrimaryAction>}
    </View>
  </KeyboardAvoidingView>;
}

function BespokeStep({ disabled, onBusyChange }: { disabled: boolean; onBusyChange(value: boolean): void }) {
  const { palette, type } = useFrameTheme();
  const { interests, toggleInterest } = useApp();
  const topics = interests.filter(topic => isCustomInterest(topic.id));
  const lock = useRef(false);
  const change = async (id: string) => {
    if (lock.current || disabled) return false;
    lock.current = true;
    onBusyChange(true);
    try { return await toggleInterest(id); }
    finally { lock.current = false; onBusyChange(false); }
  };
  return <View style={{ gap: spacing.lg, paddingVertical: spacing.sm }}>
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ paddingTop: spacing.xs }}><TexturedHeart size={40} /></View>
        <Text accessibilityRole="header" style={[type.title, { flex: 1, fontSize: 32, lineHeight: 40, maxWidth: 460 }]}>What could you talk about for hours?</Text>
      </View>
      <Text style={[type.bodySoft, { maxWidth: 440 }]}>Make your picks more personal with a few specifics.</Text>
    </View>
    <View style={{ gap: spacing.md }}>
      <CustomInterestInput expanded selectedIds={interests.map(topic => topic.id)} onAdd={change} disabled={disabled} />
      {topics.length > 0 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {topics.map(topic => <Animated.View key={topic.id} entering={FadeIn.duration(180).easing(Easing.bezier(0.23, 1, 0.32, 1))} style={{ maxWidth: "100%" }}><Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Remove ${topic.name}`} onPress={() => { void change(topic.id).catch(() => notifyUser("Couldn’t remove interest", "Try again in a moment.")); }} style={{ flexDirection: "row", alignItems: "center", maxWidth: "100%", minHeight: 48, gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, borderCurve: "continuous", backgroundColor: palette.activeSoft }}>
          <Text style={[type.body, { flexShrink: 1 }]}>{topic.name}</Text><X size={16} color={palette.active} />
        </Pressable></Animated.View>)}
      </View>}
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm }}>
        <Text style={type.bodySoft}>Optional</Text>
        <Text accessibilityLiveRegion="polite" style={[type.bodySoft, { fontVariant: ["tabular-nums"] }]}>{topics.length} of {CUSTOM_INTEREST_LIMIT} interests added</Text>
      </View>
    </View>
    <Text style={[type.bodySoft, { fontSize: 12, lineHeight: 18, maxWidth: 440 }]}>Topics are sent to Gemini when you generate picks. Leave out personal details.</Text>
  </View>;
}

function TasteStep({ onChooseCreator, onBusyChange }: { onChooseCreator(): void; onBusyChange(value: boolean): void }) {
  const { type, palette } = useFrameTheme();
  const { interests, toggleInterest } = useApp();
  const feedback = useFeedback();
  const { width, fontScale } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const ids = interests.map((topic) => topic.id);
  const select = async (id: string) => {
    if (busy || lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true);
    const done = feedback.capture();
    try { const changed = await toggleInterest(id); done("selection", changed); return changed; }
    catch { notifyUser("Couldn’t save this interest", "Try again in a moment."); return false; }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  };
  return <View style={{ gap: spacing.lg }}>
    <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
      <Text accessibilityRole="header" style={[type.title, tasteStyles.title]}>What draws you in?</Text>
      <Text style={type.bodySoft}>Pick the subjects you love. Add specifics next.</Text>
    </View>
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.sm }}>
        <Text style={type.label}>Choose as many as you like</Text>
        <Text style={[type.caption, { fontVariant: ["tabular-nums"] }]} accessibilityLiveRegion="polite">{ids.filter(id => !isCustomInterest(id)).length} selected</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {INTEREST_LIBRARY.map(({ id, name }) => <ChoiceOption key={id} role="checkbox" variant="topic" dimWhenDisabled={false} label={name}
          selected={ids.includes(id)} disabled={busy} unselectedMark={<Plus size={15} color={palette.inkMuted} />}
          onPress={() => { void select(id); }} style={{ flexGrow: 1, flexBasis: width < 320 || fontScale > 1.3 ? "100%" : "45%", borderCurve: "continuous" }}
          testID={`setup-topic-${id}`} />)}
      </View>
    </View>
    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft }}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onChooseCreator} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[type.label, { color: palette.active }]}>Start with a creator instead</Text></Pressable>
    </View>
  </View>;
}

const tasteStyles = StyleSheet.create({
  title: { fontSize: 32, lineHeight: 40 },
});

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
    screen: { flex: 1, backgroundColor: "transparent" }, scroll: { flex: 1 },
    topRow: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", paddingHorizontal: spacing.page, gap: spacing.md },
    textButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.xs }, link: { ...t.label, color: p.active },
    progress: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.md },
    content: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, paddingTop: spacing.md, paddingBottom: spacing.xl },
    connectionsHeader: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, paddingTop: spacing.sm, paddingBottom: spacing.xs },
    welcomeContent: { flexGrow: 1, paddingBottom: 0 }, welcomeBody: { flexGrow: 1 },
    quietNext: { backgroundColor: p.activeSoft },
    previewNavigation: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: spacing.md },
    interestGroup: { marginTop: spacing.lg, gap: spacing.lg }, featuredTitle: { ...t.heading, fontSize: 24, lineHeight: 32 }, interestMatch: { ...t.caption, color: p.active },
    pickPreview: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border }, supportingPreview: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, pickCopy: { gap: spacing.sm }, supportingCopy: { flex: 1 },
    heroImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.media }, supportingImage: { width: 96, aspectRatio: 16 / 9, borderRadius: radii.media },
    keySetup: { marginTop: spacing.md, gap: spacing.xs },
    suggestions: { gap: spacing.sm, marginTop: spacing.lg }, pickAction: { ...t.label, color: p.active, marginTop: spacing.sm }, continueLink: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    title: { ...t.title, fontSize: 36, lineHeight: 44 }, body: { ...t.bodySoft, marginTop: spacing.md }, note: { ...t.bodySoft, marginTop: spacing.lg },
    introduction: { marginBottom: spacing.lg },
    fieldLabel: { ...t.label, marginTop: spacing.xl }, inputRow: { marginTop: spacing.sm },
    sourceAction: { minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: p.accentDeep, marginTop: spacing.md }, sourcePreview: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, avatar: { width: 48, height: 48, borderRadius: radii.source }, flex: { flex: 1 }, sourceMeta: { ...t.bodySoft, marginTop: spacing.xs },
    followed: { marginTop: spacing.xl, gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, followedRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, followedName: { ...t.body, flex: 1 },
    footer: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, alignItems: "center", paddingHorizontal: spacing.page, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, primary: { flexGrow: 1, flexBasis: 180, minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", backgroundColor: p.accentDeep, borderRadius: radii.control }, primaryText: { ...t.label, color: p.onDark, textAlign: "center" }, disabled: { opacity: 0.55 },
  });
}
