import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Check, Link2, Plus, Search as SearchIcon } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { searchVideos } from "@/services/youtube";
import type { Video } from "@/types";

const { width } = Dimensions.get("window");
const LAST_STEP = 4;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { isDark, palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { interests, toggleInterest, finishOnboarding } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState<number>(0);
  const fade = useRef(new Animated.Value(1)).current;

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(LAST_STEP, i));
    setStep(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    fade.setValue(0.4);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  };

  const finish = async () => {
    await finishOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.wall }}>
      <LinearGradient
        colors={isDark ? ["#1D2022", palette.wall, "#121211"] : ["#FFFDF8", palette.wall, "#F5F0E7"]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.topRow, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={finish} hitSlop={12} testID="skip">
          <Text style={[type.caption, { color: palette.inkMuted }]}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        <StepWelcome width={width} />
        <StepPhilosophy width={width} />
        <StepBringChannels width={width} />
        <StepInterests width={width} interests={interests.map((i) => i.id)} onToggle={toggleInterest} />
        <StepCompletion width={width} />
      </ScrollView>

      <Animated.View style={[styles.bottomRow, { opacity: fade, paddingBottom: insets.bottom + spacing.md }]}>
        {step > 0 ? (
          <Pressable onPress={() => goTo(step - 1)} hitSlop={8} testID="back">
            <Text style={[type.caption, { color: palette.inkMuted }]}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          onPress={() => (step === LAST_STEP ? finish() : goTo(step + 1))}
          style={styles.nextBtn}
          testID="next"
        >
          <Text style={styles.nextText}>{step === LAST_STEP ? "Enter Frame" : "Continue"}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function StepWelcome({ width }: { width: number }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={[styles.step, { width }]}>
      <Text style={[type.caption, { color: palette.accent }]}>Frame</Text>
      <View style={styles.frameSymbol}>
        <View style={styles.frameOuter} />
      </View>
      <Text style={styles.bigTitle}>One video.{"\n"}Whole.</Text>
      <Text style={styles.bigBody}>
        A quiet way to watch YouTube. No feed scroll. No autoplay. No reasons to stay longer than you want.
      </Text>
    </View>
  );
}

function StepPhilosophy({ width }: { width: number }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const items = [
    { eyebrow: "No", title: "Recommendations." },
    { eyebrow: "No", title: "Autoplay." },
    { eyebrow: "No", title: "Rabbit holes." },
  ];
  return (
    <View style={[styles.step, { width }]}>
      <Text style={[type.caption, { color: palette.accent }]}>What Frame doesn&apos;t do</Text>
      <Text style={[styles.bigTitle, { marginTop: spacing.lg }]}>Less,{"\n"}on purpose.</Text>
      <View style={{ marginTop: spacing.xl }}>
        {items.map((it) => (
          <View key={it.title} style={{ marginBottom: spacing.lg }}>
            <Text style={type.caption}>{it.eyebrow}</Text>
            <Text style={[type.title, { marginTop: 2 }]}>{it.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StepBringChannels({ width }: { width: number }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const {
    googleConfigured,
    googleConnected,
    googleEmail,
    importing,
    signInWithGoogle,
    addChannelByLink,
    followChannel,
    isChannelFollowed,
  } = useApp();

  const [signInMsg, setSignInMsg] = useState<string | null>(null);
  const [link, setLink] = useState<string>("");
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [linkBusy, setLinkBusy] = useState<boolean>(false);
  const [term, setTerm] = useState<string>("");
  const [submitted, setSubmitted] = useState<string>("");

  const searchQuery = useQuery({
    queryKey: ["onboard-search", submitted],
    queryFn: () => searchVideos(submitted),
    enabled: submitted.length > 0,
  });

  const onSignIn = async () => {
    setSignInMsg(null);
    const result = await signInWithGoogle();
    setSignInMsg(result.message);
  };

  const onAddLink = async () => {
    if (!link.trim() || linkBusy) return;
    setLinkBusy(true);
    setLinkMsg(null);
    const result = await addChannelByLink(link.trim());
    setLinkBusy(false);
    setLinkMsg(result);
    if (result.ok) setLink("");
  };

  const runSearch = () => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
    Keyboard.dismiss();
  };

  const addFromVideo = async (v: Video) => {
    if (!v.channelId) return;
    await followChannel({ id: v.channelId, title: v.channelTitle || "Channel", thumbnailUrl: "", followedAt: Date.now(), source: "manual" });
  };

  return (
    <ScrollView
      style={[styles.step, { width }]}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[type.caption, { color: palette.accent }]}>Step three</Text>
      <Text style={[styles.bigTitle, { marginTop: spacing.lg, fontSize: 36, lineHeight: 42 }]}>Bring your{"\n"}channels.</Text>
      <Text style={[type.bodySoft, { marginTop: spacing.md, maxWidth: 320 }]}>
        Start with voices you already trust. Creator lookups use YouTube; your follows stay in your local library.
      </Text>

      <Pressable
        onPress={onSignIn}
        style={[styles.bigChoice, importing && { opacity: 0.7 }]}
        disabled={importing}
        testID="onboard-google"
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.choiceTitle}>{googleConnected ? "Subscriptions imported" : "Bring your channels"}</Text>
          <Text style={styles.choiceBody}>
            {googleConnected
              ? googleEmail ?? "Connected"
              : googleConfigured
                ? "Sign in with Google to import the channels you already follow."
                : "Google sign-in needs setup — you can still add channels yourself below."}
          </Text>
        </View>
        {importing ? (
          <ActivityIndicator color={palette.wall} />
        ) : googleConnected ? (
          <Check size={18} color={palette.wall} strokeWidth={2} />
        ) : (
          <Plus size={18} color={palette.wall} strokeWidth={2} />
        )}
      </Pressable>
      {signInMsg ? <Text style={[type.label, { marginTop: spacing.sm, color: palette.accent }]}>{signInMsg}</Text> : null}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={[type.caption, { color: palette.inkMuted }]}>or add them yourself</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.inputRow}>
        <Link2 size={16} color={palette.inkMuted} strokeWidth={1.6} />
        <TextInput
          value={link}
          onChangeText={(t) => {
            setLink(t);
            setLinkMsg(null);
          }}
          placeholder="Paste a channel or video link"
          placeholderTextColor={palette.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          onSubmitEditing={onAddLink}
          returnKeyType="done"
          testID="onboard-link-input"
        />
        <Pressable onPress={onAddLink} hitSlop={8} disabled={linkBusy}>
          {linkBusy ? <ActivityIndicator size="small" color={palette.accent} /> : <Text style={[type.label, { color: palette.accent }]}>Add</Text>}
        </Pressable>
      </View>
      {linkMsg ? (
        <Text style={[type.label, { marginTop: spacing.sm, color: linkMsg.ok ? palette.success : palette.danger }]}>{linkMsg.message}</Text>
      ) : null}

      <View style={styles.searchHeader}>
        <Text style={type.caption}>Search YouTube creators</Text>
      </View>

      <View style={styles.inputRow}>
        <SearchIcon size={16} color={palette.inkMuted} strokeWidth={1.6} />
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Search for a channel or topic"
          placeholderTextColor={palette.inkMuted}
          autoCapitalize="none"
          style={styles.input}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          testID="onboard-search-input"
        />
        <Pressable onPress={runSearch} hitSlop={8}>
          <Text style={[type.label, { color: palette.accent }]}>Go</Text>
        </Pressable>
      </View>

      {submitted.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          {searchQuery.isLoading ? (
            <Text style={[type.bodySoft, { paddingVertical: spacing.md }]}>Searching…</Text>
          ) : searchQuery.data?.status === "success" || searchQuery.data?.status === "partial" ? (
            searchQuery.data.data.slice(0, 6).map((v) => {
              const added = v.channelId ? isChannelFollowed(v.channelId) : false;
              return (
                <View key={v.id} style={styles.resultRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.caption} numberOfLines={1}>{v.channelTitle || "YouTube"}</Text>
                    <Text style={styles.resultTitle} numberOfLines={2}>{v.title}</Text>
                  </View>
                  <Pressable
                    onPress={() => addFromVideo(v)}
                    style={[styles.addChip, added && styles.addChipDone]}
                    disabled={added || !v.channelId}
                    testID={`onboard-add-${v.id}`}
                    accessibilityLabel={added ? `${v.channelTitle} already followed` : `Follow ${v.channelTitle}`}
                  >
                    {added ? <Check size={14} color={palette.active} strokeWidth={2} /> : <Plus size={14} color={palette.ink} strokeWidth={2} />}
                  </Pressable>
                </View>
              );
            })
          ) : (
            <Text style={[type.bodySoft, { color: searchQuery.data?.status === "empty" ? palette.inkMuted : palette.danger }]}>
              {searchQuery.data?.message ?? "Search is unavailable right now."}
            </Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function StepInterests({ width, interests, onToggle }: { width: number; interests: string[]; onToggle: (id: string) => void }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={[styles.step, { width }]}>
      <Text style={[type.caption, { color: palette.accent }]}>Step four</Text>
      <Text style={[styles.bigTitle, { marginTop: spacing.lg, fontSize: 36, lineHeight: 42 }]}>What do you{"\n"}care about?</Text>
      <Text style={[type.bodySoft, { marginTop: spacing.md, maxWidth: 320 }]}>
        Pick a few. These seed your Explore collections. You can change them later.
      </Text>
      <ScrollView style={{ marginTop: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={styles.chipsGrid}>
          {INTEREST_LIBRARY.map((t) => {
            const active = interests.includes(t.id);
            return (
              <Pressable
                key={t.id}
                onPress={() => onToggle(t.id)}
                style={[styles.interestChip, active && styles.interestChipActive]}
                testID={`onboard-interest-${t.id}`}
              >
                <Text style={[styles.interestLabel, active && { color: palette.active }]}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function StepCompletion({ width }: { width: number }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={[styles.step, { width }]}>
      <Text style={[type.caption, { color: palette.accent }]}>That&apos;s it</Text>
      <Text style={[styles.bigTitle, { marginTop: spacing.lg }]}>When a video{"\n"}ends, that&apos;s it.</Text>
      <Text style={[type.bodySoft, { marginTop: spacing.lg, maxWidth: 320 }]}>
        Nothing autoplays. Nothing pulls you forward. You choose what to watch next, if anything.
      </Text>
      <View style={{ marginTop: spacing.xxl }}>
        <Text style={type.caption}>A note on storage</Text>
        <Text style={[type.bodySoft, { marginTop: spacing.sm, maxWidth: 320 }]}>
          Your library stays on this device. YouTube provides playback and metadata; Google import and Premium verification are optional network services.
        </Text>
      </View>
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 18, height: 3, borderRadius: 2, backgroundColor: palette.surfaceDeep },
  dotActive: { backgroundColor: palette.accent },
  step: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, flex: 1 },
  bigTitle: { ...type.display, fontSize: 44, lineHeight: 50, marginTop: spacing.xl },
  bigBody: { ...type.body, marginTop: spacing.lg, maxWidth: 320, color: palette.inkSoft },
  frameSymbol: {
    width: 80,
    height: 80,
    marginTop: spacing.xxl,
    justifyContent: "center",
    alignItems: "center",
  },
  frameOuter: {
    width: 70,
    height: 70,
    borderWidth: 1.5,
    borderColor: palette.accent,
    borderRadius: radii.large,
  },
  bigChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.accentDeep,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: radii.card,
  },
  choiceTitle: { color: palette.onDark, fontFamily: fonts.serif, fontSize: 19 },
  choiceBody: { color: palette.onDarkSoft, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.surfaceDeep },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginTop: spacing.sm,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderSoft,
  },
  input: { flex: 1, ...type.body, padding: 0, fontSize: 15 },
  searchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceDeep,
  },
  resultTitle: { ...type.heading, fontSize: 15, lineHeight: 20, marginTop: 2 },
  addChip: {
    width: 34,
    height: 34,
    backgroundColor: palette.surface,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radii.control,
  },
  addChipDone: { backgroundColor: palette.activeSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.active },
  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.xl },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.surface,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderSoft,
    minHeight: 44,
  },
  interestChipActive: { backgroundColor: palette.activeSoft, borderColor: palette.active },
  interestLabel: { ...type.label, fontSize: 13 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  nextBtn: {
    backgroundColor: palette.accentDeep,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.control,
    minHeight: 48,
    justifyContent: "center",
  },
  nextText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
  });
}
