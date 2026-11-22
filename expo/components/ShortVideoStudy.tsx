import { studyComparisonEase, useStudyReveal } from "@/hooks/useStudyReveal";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, interpolate, Extrapolation, useAnimatedProps, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import Text from "@/components/FrameText";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import { fonts, spacing } from "@/constants/theme";
import { motion } from "@/constants/motion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { notifyUser } from "@/services/notifyUser";

const studies = {
  intentions: {
    title: "Scrolling can make you forget what you meant to do.",
    context: "Participants pressed a key when a target word appeared, before and after 10 minutes of scrolling.",
    source: "Lab study · 15 short-video viewers of 60 participants",
    url: "https://doi.org/10.1145/3544548.3580778",
  },
  recall: {
    title: "Short clips can leave you remembering less.",
    context: "Both groups watched 10 minutes of travel footage, then took a memory test.",
    source: "Randomized study · 57 students",
    url: "https://doi.org/10.1038/s41539-025-00399-y",
  },
};

const dots = Array.from({ length: 100 }, (_, i) => i);
const beforeScrolling = 80;
const afterScrolling = 49;
const dotStepMs = 65;
const dotSequenceMs = (beforeScrolling - afterScrolling) * dotStepMs;
const cueDuration = dotSequenceMs + motion.choice;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function RecedingDot({ index, color, progress }: { index: number; color: string; progress: SharedValue<number> }) {
  // Count down in reverse reading order so the highlighted block stays contiguous.
  const start = (beforeScrolling - 1 - index) * dotStepMs;
  const ink = useAnimatedProps(() => ({
    fillOpacity: interpolate(progress.value * cueDuration, [start, start + dotStepMs], [1, 0], Extrapolation.CLAMP),
  }));
  return <AnimatedCircle cx={5 + 10 * (index % 10)} cy={5 + 10 * Math.floor(index / 10)} r={3.4} fill={color} animatedProps={ink} />;
}

function dot(index: number, color: string) {
  return <Circle key={index} cx={5 + 10 * (index % 10)} cy={5 + 10 * Math.floor(index / 10)} r={3.4} fill={color} />;
}

// Chiossi et al., sections 4.1.1 and 4.1.3. Dots encode percentage points, not people.
function CueChart({ firstVisit, onComplete }: { firstVisit: boolean; onComplete(): void }) {
  const progress = useStudyReveal(firstVisit, cueDuration, 450, Easing.linear, onComplete);
  const { palette, type } = useFrameTheme();
  const resultLabel = useAnimatedStyle(() => ({ opacity: interpolate(progress.value * cueDuration, [dotSequenceMs, cueDuration], [0, 1], Extrapolation.CLAMP) }));
  return <View style={styles.chart}>
    <Text style={[type.heading, styles.center]}>Cues answered correctly</Text>
    <View style={styles.grids}>{[{ name: "Before scrolling", score: beforeScrolling }, { name: "After scrolling", score: afterScrolling }].map(({ name, score }) =>
      <View key={name} style={styles.column} accessible accessibilityLabel={`${name}, ${score} percent correct`}>
        <View style={styles.matrix} aria-hidden>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            {dots.map(i => dot(i, i < score ? palette.active : palette.surfaceDim))}
            {score === afterScrolling && dots.slice(afterScrolling, beforeScrolling).map(i =>
              <RecedingDot key={i} index={i} color={palette.active} progress={progress} />
            )}
          </Svg>
        </View>
        <Animated.View style={score === afterScrolling ? resultLabel : undefined}>
          <Text style={[styles.score, { color: palette.ink }]}>{score}%</Text>
        </Animated.View>
        <Text style={[type.label, styles.center]}>{name}</Text>
      </View>
    )}</View>
  </View>;
}

// Wei et al., Figure 1a. Both horizontal tracks represent the full 0–100% scale.
function RecallBar({ label, score, firstVisit, delay, onComplete }: { label: string; score: number; firstVisit: boolean; delay: number; onComplete?: () => void }) {
  const { palette, type } = useFrameTheme();
  const progress = useStudyReveal(firstVisit, 900, delay, studyComparisonEase, onComplete);
  const reveal = useAnimatedStyle(() => ({ transform: [{ translateX: `${(progress.value - 1) * 100}%` }] }));
  return <View style={styles.barRow} accessible accessibilityLabel={`${label}, ${score} percent accuracy`}>
    <View style={styles.barHeading}>
      <Text style={[type.bodySoft, styles.barLabel]}>{label}</Text>
      <Text style={[styles.score, { color: palette.ink }]}>{score}%</Text>
    </View>
    <View style={[styles.track, { backgroundColor: palette.surfaceDim }]}>
      <View style={[styles.barWindow, { width: `${score}%` }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.accent }, reveal]}>
          <ProgrammeGrain finish="panel" />
        </Animated.View>

      </View>
    </View>
  </View>;
}

function RecallChart({ firstVisit, onComplete }: { firstVisit: boolean; onComplete(): void }) {
  const { type } = useFrameTheme();
  return <View style={styles.chart}>
    <Text style={[type.heading, styles.center]}>Average memory test accuracy</Text>
    <RecallBar label="Seven short clips" score={43.3} firstVisit={firstVisit} delay={380} />
    <RecallBar label="One continuous film" score={66.4} firstVisit={firstVisit} delay={1050} onComplete={onComplete} />
  </View>;
}

export function ShortVideoStudy({ topic, firstVisit, onComplete }: { topic: keyof typeof studies; firstVisit: boolean; onComplete(): void }) {
  const { palette, type } = useFrameTheme();
  const study = studies[topic];
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={[type.title, styles.title, styles.center]}>{study.title}</Text>
    {topic === "intentions" ? <CueChart firstVisit={firstVisit} onComplete={onComplete} /> : <RecallChart firstVisit={firstVisit} onComplete={onComplete} />}
    <Text style={[type.bodySoft, styles.context, styles.center]}>{study.context}</Text>
    <Pressable accessibilityRole="link" accessibilityLabel={`Read the study. ${study.source}`}
      onPress={() => { void Linking.openURL(study.url).catch(() => notifyUser("Study unavailable", "Try opening the study again when you’re online.")); }} style={styles.source}>
      <Text style={[type.label, styles.center, { color: palette.active, textDecorationLine: "underline" }]}>{study.source}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  page: { paddingVertical: spacing.md, gap: spacing.md },
  title: { fontSize: 36, lineHeight: 42, maxWidth: 460 },
  center: { alignSelf: "center", textAlign: "center" },
  chart: { gap: spacing.md, paddingVertical: spacing.lg, alignSelf: "center", width: "100%", maxWidth: 360 },
  grids: { flexDirection: "row", gap: spacing.lg },
  column: { flex: 1, alignItems: "center", gap: spacing.xs },
  matrix: { width: "100%", maxWidth: 132, aspectRatio: 1, marginBottom: spacing.sm },
  score: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 38, fontVariant: ["tabular-nums"] },
  barRow: { gap: spacing.xs },
  barHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  barLabel: { flexShrink: 1 },
  track: { height: 16 },
  barWindow: { height: "100%", overflow: "hidden" },
  context: { maxWidth: 365 },
  source: { minHeight: 48, alignSelf: "center", justifyContent: "center" },
});
