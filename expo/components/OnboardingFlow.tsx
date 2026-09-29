import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check, Link2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingReveal from "@/components/OnboardingReveal";
import { weeklyDiscoveryPeriodKey, weeklyPickToSourceResolution } from "@/services/discovery";
import { weeklyEditionService } from "@/services/weeklyEditionInstance";
import DemoPaywall from "@/components/DemoPaywall";
import MediaImage from "@/components/MediaImage";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { ONBOARDING_STEPS } from "@/constants/navigation";
import { FOUNDATION_CAPABILITIES, ONBOARDING_INTEREST_MAX } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { isInterestOptionDisabled, toggleInterestId } from "@/domain/interests";
import { onboardingDestination } from "@/domain/onboarding";
import { useApp } from "@/providers/AppProvider";
import type { SourceResolution } from "@/types";

const showDemo = FOUNDATION_CAPABILITIES.demoPaywall && !FOUNDATION_CAPABILITIES.paidAccess;
const steps = ONBOARDING_STEPS;

export default function OnboardingFlow({ replay = false }: { replay?: boolean }) {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { interests, replaceInterests, followedChannels, finishOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [savedDuringSetup, setSavedDuringSetup] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const sourceLock = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const current = premiumOpen ? "premium-preview" : steps[step];
  const last = step === steps.length - 1;
  const destination = onboardingDestination(followedChannels.length, replay);
  const finishLabel = replay ? "Back to Settings" : followedChannels.length ? "Open Today" : "Explore Sources";
  const finish = async () => {
    if (locked.current || sourceLock.current) return;
    locked.current = true; setBusy(true); Keyboard.dismiss();
    try { if (!replay) await finishOnboarding(); router.replace(destination); }
    catch { Alert.alert("Couldn’t finish setup", "Your choices are still here. Try again."); }
    finally { locked.current = false; setBusy(false); }
  };
  const goTo = (index: number) => {
    if (locked.current || sourceLock.current) return;
    Keyboard.dismiss(); setPremiumOpen(false); setStep(Math.max(0, Math.min(steps.length - 1, index)));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (locked.current || sourceLock.current) return true;
      if (premiumOpen) { setPremiumOpen(false); scroll.current?.scrollTo({ y: 0, animated: false }); return true; }
      if (step > 0) { setStep(step - 1); scroll.current?.scrollTo({ y: 0, animated: false }); return true; }
      return !replay;
    });
    return () => handler.remove();
  }, [replay, step, premiumOpen]);
  const selectInterest = async (id: string) => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    const ids = toggleInterestId(interests.map((item) => item.id), id, new Set(INTEREST_LIBRARY.map((item) => item.id)), ONBOARDING_INTEREST_MAX);
    try { await replaceInterests(INTEREST_LIBRARY.filter((item) => ids.includes(item.id))); }
    catch { Alert.alert("Couldn’t save interests", "Check your selection and try again."); }
    finally { locked.current = false; setBusy(false); }
  };
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.wordmark}>Frame</Text>
      <Pressable disabled={busy} onPress={() => { void finish(); }} style={styles.textButton} accessibilityRole="button" accessibilityState={{ disabled: busy }}><Text style={styles.link}>{replay ? "Close preview" : "Skip setup"}</Text></Pressable>
    </View>
    <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel="Setup progress" accessibilityValue={{ min: 1, max: steps.length, now: step + 1, text: `Step ${step + 1} of ${steps.length}` }}>
      {steps.map((name, i) => <View key={name} style={[styles.progressPart, i <= step && styles.progressComplete]} />)}
    </View>
    <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {replay ? <Text style={styles.replayNote}>Welcome preview · source and interest changes are saved to this profile.</Text> : null}
      {current === "welcome" ? <>
        <Text style={styles.title} accessibilityRole="header">Watch with{"\n"}intention.</Text>
        <Text style={styles.body}>Your YouTube sources, brought into a quieter space. A small selection each day, with a clear place to stop.</Text>
        <View style={styles.introduction}>
          <Text style={styles.introTitle}>Start with what you enjoy.</Text>
          <Text style={styles.introBody}>Follow a source you already love. Save a video for later, or bring a few together in a session.</Text>
        </View>
        <Text style={styles.note}>No account needed. Your library stays on this device.</Text>
      </> : null}
      {current === "source" ? <SourceStep scrollToSource={() => scroll.current?.scrollTo({ y: 0, animated: false })} onBusyChange={(value) => { sourceLock.current = value; setBusy(value); }} /> : null}
      {current === "interests" ? <>
        <Text style={styles.title} accessibilityRole="header">What draws{"\n"}you in?</Text>
        <Text style={styles.body}>Choose up to {ONBOARDING_INTEREST_MAX} interests for weekly source suggestions. You can change these in Settings.</Text>
        <Text style={styles.note} accessibilityLiveRegion="polite">{interests.length} of {ONBOARDING_INTEREST_MAX} selected · optional</Text>
        <View style={styles.chips}>
          {INTEREST_LIBRARY.map((item) => {
            const ids = interests.map((interest) => interest.id);
            const selected = ids.includes(item.id);
            const atLimit = isInterestOptionDisabled(ids, item.id, ONBOARDING_INTEREST_MAX);
            return <Pressable key={item.id} onPress={() => { void selectInterest(item.id); }} disabled={busy || atLimit} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: busy || atLimit }} accessibilityHint={atLimit ? "Remove an interest before choosing another." : undefined} style={[styles.chip, atLimit && styles.chipUnavailable, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && { color: palette.active }]}>{item.name}</Text>{selected ? <Check size={16} color={palette.active} /> : null}</Pressable>;
          })}
        </View>
      </> : null}
      {current === "your-frame" ? <>
        <OnboardingReveal savedHere={savedDuringSetup} onSaved={(id) => setSavedDuringSetup((ids) => [...new Set([...ids, id])])} onChooseSource={() => goTo(2)} onBusyChange={(value) => { sourceLock.current = value; setBusy(value); }} />
        {showDemo ? <View style={styles.followed}><Text style={type.heading}>Keep making it yours.</Text><Text style={type.bodySoft}>Explore how Frame Premium could bring your library together.</Text><Pressable disabled={busy} onPress={() => { setPremiumOpen(true); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={styles.textButton} accessibilityRole="button"><Text style={styles.link}>Preview Premium · no charge</Text></Pressable></View> : null}
      </> : null}
      {current === "premium-preview" ? <DemoPaywall /> : null}
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {step > 0 ? <Pressable disabled={busy} onPress={() => { if (premiumOpen) { setPremiumOpen(false); scroll.current?.scrollTo({ y: 0, animated: false }); } else goTo(step - 1); }} style={styles.textButton} accessibilityRole="button"><Text style={styles.link}>Back</Text></Pressable> : null}
      <Pressable disabled={busy} onPress={() => { if (last) void finish(); else goTo(step + 1); }} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} testID="onboarding-next">
        {busy ? <ActivityIndicator color={palette.onDark} /> : <Text style={styles.primaryText}>{last ? finishLabel : current === "welcome" ? "Make it yours" : current === "source" && followedChannels.length === 0 ? "Add a source later" : current === "source" ? "See my Frame" : current === "interests" && interests.length === 0 ? "Choose interests later" : "Continue"}</Text>}
      </Pressable>
    </View>
  </KeyboardAvoidingView>;
}

function SourceStep({ onBusyChange, scrollToSource }: { onBusyChange(value: boolean): void; scrollToSource(): void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { resolveSourceInput, confirmSource, followedChannels, interests, activeProfileId, activeProfile } = useApp();
  const picks = useQuery({
    queryKey: ["weekly-picks", activeProfileId, weeklyDiscoveryPeriodKey(), interests.map((item) => item.id).join(","), followedChannels.map((item) => item.id).sort().join(",")],
    queryFn: () => weeklyEditionService.get(activeProfileId, interests.map((item) => item.id), followedChannels.map((item) => item.id)),
    enabled: FOUNDATION_CAPABILITIES.weeklyDiscovery && interests.length > 0 && activeProfile?.role !== "managed",
    retry: false, staleTime: Infinity, refetchOnWindowFocus: false,
  });
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<SourceResolution | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submit = async () => {
    if (lock.current || (!resolution && !link.trim())) return;
    lock.current = true; setBusy(true); onBusyChange(true); setFeedback(null);
    try {
      if (resolution) {
        const result = await confirmSource(resolution);
        if (!mounted.current) return;
        setFeedback(result.ok ? { ok: true, message: `${resolution.source.displayName} is now in your sources.` } : result);
        if (result.ok) { setResolution(null); setLink(""); Keyboard.dismiss(); }
      } else {
        const result = await resolveSourceInput(link.trim());
        if (!mounted.current) return;
        if (result.status === "success") setResolution(result.data);
        else setFeedback({ ok: false, message: result.message ?? "Source not found. Check the link or @handle and try again." });
      }
    } catch { if (mounted.current) setFeedback({ ok: false, message: "Couldn’t add this source. Check your connection and try again." }); }
    finally { lock.current = false; if (mounted.current) { setBusy(false); onBusyChange(false); } }
  };
  return <>
    <Text style={styles.title} accessibilityRole="header">Begin with{"\n"}a favorite.</Text>
    <Text style={styles.body}>Add a YouTube channel you enjoy. Use a channel or video link, an @handle, or a channel ID.</Text>
    <Text style={styles.fieldLabel}>Source link or @handle</Text>
    <View style={styles.inputRow}><Link2 size={18} color={palette.inkMuted} /><TextInput value={link} editable={!busy} onChangeText={(value) => { setLink(value); setResolution(null); setFeedback(null); }} placeholder="youtube.com/@source" placeholderTextColor={palette.inkMuted} autoCapitalize="none" autoCorrect={false} style={styles.input} onSubmitEditing={() => { void submit(); }} returnKeyType="done" accessibilityLabel="Source link or @handle" testID="onboard-source-link" /></View>
    {resolution ? <View style={styles.sourcePreview} testID="onboard-source-preview">
      <MediaImage source={resolution.source.thumbnailUrl ? { uri: resolution.source.thumbnailUrl } : null} style={styles.avatar} contentFit="cover" cachePolicy="none" />
      <View style={styles.flex}><Text style={type.heading}>{resolution.source.displayName}</Text><Text style={styles.sourceMeta}>{resolution.source.handle ?? "YouTube channel"}</Text>{resolution.video ? <Text style={styles.sourceMeta}>From video: {resolution.video.title}</Text> : null}</View>
    </View> : null}
    <Pressable disabled={busy || (!resolution && !link.trim())} onPress={() => { void submit(); }} accessibilityRole="button" accessibilityState={{ busy, disabled: busy || (!resolution && !link.trim()) }} style={[styles.sourceAction, (busy || (!resolution && !link.trim())) && styles.disabled]} testID={resolution ? "onboard-confirm-source" : "onboard-resolve-source"}><Text style={styles.primaryText}>{busy ? (resolution ? "Following…" : "Finding source…") : resolution ? "Follow source" : "Find source"}</Text></Pressable>
    {feedback ? <Text style={[styles.note, { color: feedback.ok ? palette.success : palette.danger }]} accessibilityLiveRegion="polite">{feedback.message}</Text> : null}
    {activeProfile?.role !== "managed" && interests.length > 0 && !resolution ? <View style={styles.followed}>
      <Text style={type.heading}>A few you might enjoy</Text><Text style={type.bodySoft}>This week’s picks, matched to your interests. Choose one to review before following.</Text>
      {picks.isLoading ? <ActivityIndicator color={palette.active} accessibilityLabel="Loading source suggestions" /> : picks.data?.items.length ? picks.data.items.map((pick) => <Pressable key={pick.providerSourceId} disabled={busy} onPress={() => { setResolution(weeklyPickToSourceResolution(pick)); setFeedback(null); scrollToSource(); }} accessibilityRole="button" accessibilityLabel={`Review ${pick.displayName}`} style={styles.sourcePreview}>
        <MediaImage source={pick.thumbnailUrl ? { uri: pick.thumbnailUrl } : null} style={styles.avatar} contentFit="cover" cachePolicy="none" /><View style={styles.flex}><Text style={type.label}>{pick.displayName}</Text><Text style={styles.sourceMeta}>{INTEREST_LIBRARY.find((item) => item.id === pick.interestId)?.name ?? "From your interests"}</Text></View>
      </Pressable>) : <><Text style={type.bodySoft}>No suggestions are available right now. Add a source above, or try again.</Text><Pressable disabled={picks.isFetching} onPress={() => { void picks.refetch(); }} accessibilityRole="button" style={styles.textButton}><Text style={styles.link}>Try suggestions again</Text></Pressable></>}
    </View> : null}
    {followedChannels.length > 0 ? <View style={styles.followed}><Text style={type.label}>Your sources · {followedChannels.length}</Text>{followedChannels.slice(0, 3).map((source) => <View style={styles.followedRow} key={source.id}><Check size={17} color={palette.success} /><Text style={styles.followedName}>{source.title}</Text></View>)}{followedChannels.length > 3 ? <Text style={type.bodySoft}>And {followedChannels.length - 3} more in Sources.</Text> : null}</View> : <Text style={styles.note}>You can add more sources later. Each one shapes what appears in Today.</Text>}
  </>;
}

function createStyles(p: FramePalette, t: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.wall }, scroll: { flex: 1 },
    topRow: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", paddingHorizontal: spacing.page, gap: spacing.md }, wordmark: { ...t.heading },
    textButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.xs }, link: { ...t.label, color: p.active },
    progress: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.md }, progressPart: { flex: 1, height: 3, backgroundColor: p.borderSoft, borderRadius: 2 }, progressComplete: { backgroundColor: p.active },
    content: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page, paddingTop: spacing.lg, paddingBottom: spacing.xxl }, replayNote: { ...t.caption, marginBottom: spacing.lg },
    title: { ...t.title, fontSize: 36, lineHeight: 44 }, body: { ...t.bodySoft, marginTop: spacing.md }, note: { ...t.bodySoft, marginTop: spacing.lg },
    introduction: { padding: spacing.lg, marginTop: spacing.xl, borderRadius: radii.card, backgroundColor: p.programme, gap: spacing.md }, introTitle: { ...t.heading, color: p.onProgramme }, introBody: { ...t.body, color: p.onProgrammeSoft },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg }, chip: { minHeight: 48, maxWidth: "100%", flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: p.borderSoft, borderRadius: radii.control, backgroundColor: p.surface }, chipUnavailable: { borderStyle: "dashed" }, chipSelected: { borderColor: p.active, backgroundColor: p.activeSoft }, chipText: { ...t.label, flexShrink: 1 },
    fieldLabel: { ...t.label, marginTop: spacing.xl }, inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border }, input: { ...t.body, flex: 1, paddingVertical: spacing.md },
    sourceAction: { minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: p.accentDeep, marginTop: spacing.md }, sourcePreview: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, avatar: { width: 48, height: 48, borderRadius: radii.media }, flex: { flex: 1 }, sourceMeta: { ...t.bodySoft, marginTop: spacing.xs },
    followed: { marginTop: spacing.xl, gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, followedRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, followedName: { ...t.body, flex: 1 },
    footer: { width: "100%", maxWidth: 640, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, alignItems: "center", paddingHorizontal: spacing.page, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }, primary: { flexGrow: 1, flexBasis: 180, minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", backgroundColor: p.accentDeep, borderRadius: radii.control }, primaryText: { ...t.label, color: p.onDark, textAlign: "center" }, disabled: { opacity: 0.55 },
  });
}
