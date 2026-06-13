import { router } from "expo-router";
import { useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";

const { width } = Dimensions.get("window");

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { interests, toggleInterest, finishOnboarding } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState<number>(0);
  const fade = useRef(new Animated.Value(1)).current;

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(3, i));
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
      <View style={[styles.topRow, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
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
        <StepInterests
          width={width}
          interests={interests.map((i) => i.id)}
          onToggle={toggleInterest}
        />
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
          onPress={() => (step === 3 ? finish() : goTo(step + 1))}
          style={styles.nextBtn}
          testID="next"
        >
          <Text style={styles.nextText}>{step === 3 ? "Enter Frame" : "Continue"}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function StepWelcome({ width }: { width: number }) {
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
  const items = [
    { eyebrow: "No", title: "Recommendations." },
    { eyebrow: "No", title: "Autoplay." },
    { eyebrow: "No", title: "Rabbit holes." },
  ];
  return (
    <View style={[styles.step, { width }]}>
      <Text style={[type.caption, { color: palette.accent }]}>What Frame doesn't do</Text>
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

function StepInterests({ width, interests, onToggle }: { width: number; interests: string[]; onToggle: (id: string) => void }) {
  return (
    <View style={[styles.step, { width }]}>
      <Text style={[type.caption, { color: palette.accent }]}>Step three</Text>
      <Text style={[styles.bigTitle, { marginTop: spacing.lg, fontSize: 36, lineHeight: 42 }]}>What do you{"\n"}care about?</Text>
      <Text style={[type.bodySoft, { marginTop: spacing.md, maxWidth: 320 }]}>
        Pick a few. These seed your Explore tab. You can change them later.
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
                <Text style={[styles.interestEmoji, active && { color: palette.wall }]}>{t.emoji}</Text>
                <Text style={[styles.interestLabel, active && { color: palette.wall }]}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function StepCompletion({ width }: { width: number }) {
  return (
    <View style={[styles.step, { width }]}>
      <Text style={[type.caption, { color: palette.accent }]}>That's it</Text>
      <Text style={[styles.bigTitle, { marginTop: spacing.lg }]}>When a video{"\n"}ends, that's it.</Text>
      <Text style={[type.bodySoft, { marginTop: spacing.lg, maxWidth: 320 }]}>
        Nothing autoplays. Nothing pulls you forward. You choose what to watch next, if anything.
      </Text>
      <View style={{ marginTop: spacing.xxl }}>
        <Text style={type.caption}>A note on storage</Text>
        <Text style={[type.bodySoft, { marginTop: spacing.sm, maxWidth: 320 }]}>
          Frame keeps everything on this device. No cloud. No accounts. Uninstall the app and it's gone.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 18, height: 2, backgroundColor: palette.surfaceDeep },
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
  },
  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.xl },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.surface,
  },
  interestChipActive: { backgroundColor: palette.ink },
  interestEmoji: { color: palette.accent, fontSize: 14 },
  interestLabel: { ...type.label, fontSize: 13 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  nextBtn: {
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
  },
  nextText: { color: palette.wall, fontFamily: "Georgia", fontSize: 15 },
});
