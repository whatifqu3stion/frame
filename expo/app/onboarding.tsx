import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Check, Link2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { ONBOARDING_STEPS } from "@/constants/navigation";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

const { width } = Dimensions.get("window");
const LAST_STEP = ONBOARDING_STEPS.length - 1;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { isDark, palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { interests, toggleInterest, finishOnboarding } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState<number>(0);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const goTo = (index: number): void => {
    const clamped = Math.max(0, Math.min(LAST_STEP, index));
    setStep(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: !reduceMotion });
  };
  const finish = async (): Promise<void> => {
    await finishOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={isDark ? ["#1D2022", palette.wall, "#121211"] : ["#FFFDF8", palette.wall, "#F5F0E7"]} locations={[0, 0.52, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.topRow, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${ONBOARDING_STEPS.length}`}>
          {ONBOARDING_STEPS.map((name, index) => <View key={name} style={[styles.dot, index === step && styles.dotActive]} />)}
        </View>
        {step === 2 ? <Pressable onPress={() => goTo(3)} style={styles.topAction} accessibilityRole="button"><Text style={styles.mutedCaption}>Skip source</Text></Pressable> : <View style={styles.topAction} />}
      </View>
      <ScrollView ref={scrollRef} horizontal pagingEnabled scrollEnabled={false} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ApproachStep stepWidth={width} />
        <InterestsStep stepWidth={width} selectedIds={interests.map((interest) => interest.id)} onToggle={toggleInterest} />
        <SourceStep stepWidth={width} />
        <EnterTodayStep stepWidth={width} />
      </ScrollView>
      <View style={[styles.bottomRow, { paddingBottom: insets.bottom + spacing.md }]}>
        {step > 0 ? <Pressable onPress={() => goTo(step - 1)} style={styles.backButton} accessibilityRole="button"><Text style={styles.mutedCaption}>Back</Text></Pressable> : <View style={styles.backButton} />}
        <Pressable onPress={() => { if (step === LAST_STEP) void finish(); else goTo(step + 1); }} style={styles.nextButton} accessibilityRole="button" testID="onboarding-next">
          <Text style={styles.nextText}>{step === LAST_STEP ? "Enter Today" : "Continue"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ApproachStep({ stepWidth }: { stepWidth: number }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={[styles.step, { width: stepWidth }]}>
      <Text style={styles.accentCaption}>Frame</Text>
      <View style={styles.frameSymbol}><View style={styles.frameOuter} /></View>
      <Text style={styles.bigTitle}>A finite inbox.{"\n"}Then, stop.</Text>
      <Text style={styles.bigBody}>Frame gathers a small set from sources you trust. Nothing autoplays, nothing scrolls forever, and nothing invents a reason to stay.</Text>
      <View style={styles.principles}>
        <Text style={styles.principle}>01 · You choose the sources.</Text>
        <Text style={styles.principle}>02 · Today has a visible end.</Text>
        <Text style={styles.principle}>03 · Playback stays intentional.</Text>
      </View>
    </View>
  );
}

function InterestsStep({ stepWidth, selectedIds, onToggle }: { stepWidth: number; selectedIds: string[]; onToggle: (id: string) => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={[styles.step, { width: stepWidth }]}>
      <Text style={styles.accentCaption}>Your interests</Text>
      <Text style={styles.stepTitle}>What matters{"\n"}to you?</Text>
      <Text style={styles.stepBody}>Choose a few stable interests for future bounded weekly picks. Selecting one never starts a search.</Text>
      <ScrollView style={styles.chipScroll} contentContainerStyle={styles.chipGrid} showsVerticalScrollIndicator={false}>
        {INTEREST_LIBRARY.map((interest) => {
          const selected = selectedIds.includes(interest.id);
          return (
            <Pressable key={interest.id} onPress={() => onToggle(interest.id)} style={[styles.chip, selected && styles.chipActive]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} testID={`onboard-interest-${interest.id}`}>
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{interest.name}</Text>
              {selected ? <Check size={14} color={palette.active} strokeWidth={2} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SourceStep({ stepWidth }: { stepWidth: number }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { addChannelByLink, googleConnected } = useApp();
  const [link, setLink] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const addSource = async (): Promise<void> => {
    if (!link.trim() || busy) return;
    setBusy(true);
    setFeedback(null);
    const result = await addChannelByLink(link.trim());
    setBusy(false);
    setFeedback(result);
    if (result.ok) setLink("");
  };

  return (
    <ScrollView style={[styles.step, { width: stepWidth }]} contentContainerStyle={styles.sourceContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.accentCaption}>One trusted source</Text>
      <Text style={styles.stepTitle}>Start with{"\n"}someone you trust.</Text>
      <Text style={styles.stepBody}>Paste a supported channel, handle, or video link. You can skip this and add a source later.</Text>
      <View style={styles.inputRow}>
        <Link2 size={17} color={palette.inkMuted} strokeWidth={1.7} />
        <TextInput value={link} onChangeText={(value) => { setLink(value); setFeedback(null); }} placeholder="youtube.com/@source" placeholderTextColor={palette.inkMuted} autoCapitalize="none" autoCorrect={false} style={styles.input} returnKeyType="done" onSubmitEditing={() => { void addSource(); }} accessibilityLabel="Trusted source link" testID="onboard-source-link" />
      </View>
      <Pressable onPress={() => { void addSource(); }} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} disabled={busy || !link.trim()} accessibilityRole="button" testID="onboard-add-source">
        {busy ? <ActivityIndicator color={palette.onDark} /> : <Text style={styles.addButtonText}>Add source</Text>}
      </Pressable>
      {feedback ? <Text style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text> : null}
      <View style={styles.googleNotice} accessible>
        <Text style={styles.noticeTitle}>{googleConnected ? "Google connected" : "Google import unavailable"}</Text>
        <Text style={styles.noticeBody}>Selective subscription import is not available yet. Frame will not follow Google subscriptions automatically.</Text>
      </View>
    </ScrollView>
  );
}

function EnterTodayStep({ stepWidth }: { stepWidth: number }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={[styles.step, { width: stepWidth }]}>
      <Text style={styles.accentCaption}>You’re ready</Text>
      <Text style={styles.bigTitle}>Enter Today.{"\n"}Leave whole.</Text>
      <Text style={styles.bigBody}>Today may be empty until Frame’s shared service exists. That is intentional: no fake feed, no automatic polling, and no invented videos.</Text>
      <View style={styles.endMark}><View style={styles.endLine} /><Text style={styles.endLabel}>A REAL END</Text><View style={styles.endLine} /></View>
    </View>
  );
}

function createStyles(palette: FramePalette, frameType: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    topRow: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.page, paddingBottom: spacing.sm },
    dots: { flexDirection: "row", gap: 6 }, dot: { width: 22, height: 3, borderRadius: 2, backgroundColor: palette.surfaceDeep }, dotActive: { backgroundColor: palette.accent },
    topAction: { minWidth: 88, minHeight: 48, alignItems: "flex-end", justifyContent: "center" }, mutedCaption: { ...frameType.caption, color: palette.inkMuted },
    step: { flex: 1, paddingHorizontal: spacing.page, paddingTop: spacing.lg }, accentCaption: { ...frameType.caption, color: palette.accent },
    frameSymbol: { width: 78, height: 78, marginTop: spacing.xl, alignItems: "center", justifyContent: "center" }, frameOuter: { width: 68, height: 68, borderRadius: radii.large, borderWidth: 1.5, borderColor: palette.accent },
    bigTitle: { ...frameType.display, fontSize: 42, lineHeight: 49, marginTop: spacing.xl }, bigBody: { ...frameType.body, color: palette.inkSoft, maxWidth: 330, marginTop: spacing.lg },
    principles: { gap: spacing.md, marginTop: spacing.xl }, principle: { ...frameType.caption, color: palette.inkMuted },
    stepTitle: { ...frameType.display, fontSize: 36, lineHeight: 43, marginTop: spacing.lg }, stepBody: { ...frameType.bodySoft, maxWidth: 330, marginTop: spacing.md },
    chipScroll: { marginTop: spacing.lg }, chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.xl }, chip: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft }, chipActive: { backgroundColor: palette.activeSoft, borderColor: palette.active }, chipText: { ...frameType.label }, chipTextActive: { color: palette.active },
    sourceContent: { paddingBottom: spacing.xxl }, inputRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.xl, borderRadius: radii.control, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft }, input: { ...frameType.body, flex: 1, paddingVertical: 0 },
    addButton: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep }, addButtonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 }, feedback: { ...frameType.label, marginTop: spacing.sm },
    googleNotice: { padding: spacing.md, marginTop: spacing.xl, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft }, noticeTitle: { ...frameType.label }, noticeBody: { ...frameType.bodySoft, color: palette.inkMuted, marginTop: spacing.xs },
    endMark: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xxl }, endLine: { flex: 1, height: 1, backgroundColor: palette.borderSoft }, endLabel: { ...frameType.caption, color: palette.inkMuted },
    bottomRow: { minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.page, paddingTop: spacing.sm }, backButton: { minWidth: 72, minHeight: 48, justifyContent: "center" }, nextButton: { minHeight: 52, minWidth: 132, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radii.control, backgroundColor: palette.accentDeep }, nextText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
    pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  });
}
