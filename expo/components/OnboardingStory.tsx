import { useStudyReveal } from "@/hooks/useStudyReveal";
import Svg, { Circle, G, Path } from "react-native-svg";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedProps } from "react-native-reanimated";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import Text from "@/components/FrameText";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { fonts, spacing } from "@/constants/theme";
import { notifyUser } from "@/services/notifyUser";

export { default as ViewingContrast } from "@/components/ViewingBenefits";

const studyUrl = "https://voices.uchicago.edu/airlab/files/2025/02/netflix_autoplay.pdf";
const dailyMinutes = 21; // Baseline-adjusted treatment effect, Table 6, Schaffner et al. (2025).
// Illustrative endpoints, not measured group means.
const illustrationStart = 60 - dailyMinutes;
const dialRadius = 86;
const arcLength = 2 * Math.PI * dialRadius * dailyMinutes / 60;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedTime = Animated.createAnimatedComponent(TextInput);

function dialPoint(minute: number, radius: number) {
  const angle = minute * Math.PI / 30;
  return `${110 + radius * Math.sin(angle)} ${110 - radius * Math.cos(angle)}`;
}

const baselineArc = `M ${dialPoint(0, dialRadius)} A ${dialRadius} ${dialRadius} 0 1 1 ${dialPoint(illustrationStart, dialRadius)}`;
const arc = `M ${dialPoint(illustrationStart, dialRadius)} A ${dialRadius} ${dialRadius} 0 0 1 ${dialPoint(60, dialRadius)}`;
const minutes = Array.from({ length: 60 }, (_, i) => i);
const ticks = minutes.map(i => `M ${dialPoint(i, i % 5 === 0 ? 65 : 71)} L ${dialPoint(i, 101)}`).join(" ");
const hourMarks = minutes.filter(i => i % 5 === 0).map(i => `M ${dialPoint(i, 102)} L ${dialPoint(i, 106)}`).join(" ");

function ViewingDial({ firstVisit, onComplete }: { firstVisit: boolean; onComplete(): void }) {
  const { palette } = useFrameTheme();
  const reduced = useReducedMotion();
  const sweep = useStudyReveal(firstVisit, 1600, 750, Easing.linear, onComplete);
  const ink = useAnimatedProps(() => ({ strokeDashoffset: (1 - sweep.get()) * arcLength }));
  const time = useAnimatedProps(() => {
    const text = String(Math.round(illustrationStart + dailyMinutes * sweep.get()));
    return { text, defaultValue: text };
  });

  return <View style={styles.dial} accessible accessibilityRole="image" accessibilityLabel={`Illustrative clock increasing from 39 to 60 minutes. The study estimated ${dailyMinutes} minutes longer viewing per day on average with autoplay on compared with off; 39 and 60 are not measured group averages.`}>
    <Svg width="100%" height="100%" viewBox="0 0 220 220" aria-hidden>
      <Circle cx={110} cy={110} r={dialRadius} fill="none" stroke={palette.surfaceDim} strokeWidth={30} />
      <Path d={baselineArc} stroke={palette.accent} strokeOpacity={0.32} strokeWidth={30} fill="none" />
      <AnimatedPath d={arc} stroke={palette.accent} strokeWidth={30} fill="none" strokeDasharray={[arcLength, arcLength]} animatedProps={ink} />
      <G fill="none">
        <Path d={ticks} stroke={palette.wall} strokeWidth={1.25} />
        <Path d={hourMarks} stroke={palette.inkMuted} strokeWidth={1} />
      </G>
    </Svg>
    <View style={styles.dialLegend} aria-hidden>
      <AnimatedTime testID="autoplay-clock-minutes" editable={false} caretHidden accessible={false} pointerEvents="none" allowFontScaling={false}
        defaultValue={firstVisit && !reduced ? String(illustrationStart) : "60"} animatedProps={time}
        style={[styles.dialValue, { color: palette.ink, textAlign: "center", padding: 0, width: "100%" }]} />
      <Text allowFontScaling={false} style={[styles.dialUnit, { color: palette.inkSoft }]}>minutes</Text>
    </View>
  </View>;
}

export function ViewingStudy({ firstVisit, onComplete }: { firstVisit: boolean; onComplete(): void }) {
  const { palette, type } = useFrameTheme();
  return <View style={styles.story}>
    <Text accessibilityRole="header" style={[type.title, styles.title, styles.centered]}>Autoplay keeps you watching longer.</Text>
    <ViewingDial firstVisit={firstVisit} onComplete={onComplete} />
    <View style={{ gap: spacing.xs }}>
      <Text style={[type.heading, styles.centered]}>21 minutes longer</Text>
      <Text style={[type.bodySoft, styles.centered]}>Per day on average with autoplay on.</Text>
      <Text style={[type.caption, styles.centered]}>Clock illustrates the increase, not group averages.</Text>
    </View>
    <Pressable accessibilityRole="link" accessibilityLabel="Read the randomized study of 76 frequent viewers by Schaffner and colleagues, 2025" onPress={() => { void Linking.openURL(studyUrl).catch(() => notifyUser("Study unavailable", "Try opening the study again when you’re online.")); }} style={styles.source}>
      <Text style={[type.label, styles.centered, { color: palette.active, textDecorationLine: "underline" }]}>Randomized study · 76 frequent viewers</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  story: { gap: spacing.md, paddingVertical: spacing.md },
  title: { fontSize: 36, lineHeight: 42, maxWidth: 460 },
  centered: { alignSelf: "center", textAlign: "center" },
  dial: { width: "76%", maxWidth: 248, aspectRatio: 1, alignSelf: "center", marginVertical: 6 },
  dialLegend: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  dialValue: { fontFamily: fonts.serif, fontSize: 52, lineHeight: 62, includeFontPadding: false },
  dialUnit: { fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 20 },
  source: { minHeight: 48, alignSelf: "center", justifyContent: "center" },
});
