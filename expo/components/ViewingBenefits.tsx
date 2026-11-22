import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle, Path } from "react-native-svg";
import { RotateCcw } from "lucide-react-native";
import Text from "@/components/FrameText";
import { fonts, spacing } from "@/constants/theme";
import { motion } from "@/constants/motion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useReducedMotionPreference } from "@/hooks/useReducedMotion";

const title = "Great videos, minus the rabbit holes.";
const benefits = [
  { pain: "I spend longer scrolling than watching.", detail: "A finite daily selection from creators you follow." },
  { pain: "I came for one thing and got lost in clips.", detail: "Full videos on your interests, without a Shorts feed." },
  { pain: "I meant to stop a video ago.", detail: "Another video starts only when you choose it." },
];
const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
const ease = easeOut.factory();
// Authored reading beats, not UI transition durations. One UI-runtime clock
// owns every glyph, strike and fade; React only hears about completion.
const titleHold = 2250;
const titleEnd = titleHold + motion.state;
const glyphMs = 36;
const ringMs = 340;
const badgeMs = ringMs + 200;
let nextStart = titleEnd + 120;
const beats = benefits.map(item => {
  const start = nextStart;
  const typed = start + (item.pain.length + 2) * glyphMs;
  const strike = typed + 850;
  const struck = strike + motion.confirm;
  const quoteOut = struck + 240;
  const answerIn = quoteOut + motion.state + 100;
  const checkIn = answerIn + motion.confirm + 1550;
  const end = checkIn + badgeMs + 650;
  nextStart = end + motion.state + 120;
  return { start, typed, strike, struck, quoteOut, answerIn, checkIn, end };
});
const duration = beats[beats.length - 1].end;

function fade(time: number, start: number, end: number) {
  "worklet";
  return ease(interpolate(time, [start, end], [0, 1], Extrapolation.CLAMP));
}

function Letter({ letter, at, clock }: { letter: string; at: number; clock: SharedValue<number> }) {
  const { palette } = useFrameTheme();
  const reveal = useAnimatedStyle(() => ({ opacity: clock.get() >= at ? 1 : 0 }));
  return <Animated.Text style={[styles.thought, { color: palette.ink }, reveal]}>{letter}</Animated.Text>;
}

function ThoughtWord({ word, offset, beat, clock }: { word: string; offset: number; beat: typeof beats[number]; clock: SharedValue<number> }) {
  const { palette } = useFrameTheme();
  const line = useAnimatedStyle(() => ({
    opacity: clock.get() >= beat.strike ? 0.75 : 0,
    transform: [{ scaleX: fade(clock.get(), beat.strike, beat.struck) }],
  }));
  return <View style={styles.word}>
    {Array.from(word).map((letter, index) => <Letter key={index} letter={letter} at={beat.start + (offset + index) * glyphMs} clock={clock} />)}
    <Animated.View style={[styles.strike, { backgroundColor: palette.active }, line]} />
  </View>;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const circumference = 2 * Math.PI * 12;

function BenefitCheck({ clock, start }: { clock: SharedValue<number>; start: number }) {
  const { palette } = useFrameTheme();
  const ring = useAnimatedProps(() => {
    const progress = interpolate(clock.get(), [start, start + ringMs], [0, 1], Extrapolation.CLAMP);
    return { opacity: progress > 0 ? 1 : 0, strokeDashoffset: circumference * (1 - progress) };
  });
  const disc = useAnimatedProps(() => ({ opacity: fade(clock.get(), start + ringMs, start + ringMs + 150) }));
  const tick = useAnimatedProps(() => ({ opacity: fade(clock.get(), start + ringMs + 80, start + badgeMs) }));
  return <View style={styles.check}>
    <Svg width={28} height={28} viewBox="0 0 28 28" aria-hidden>
      <AnimatedPath d="M14 2a12 12 0 0 1 0 24a12 12 0 0 1 0-24" fill="none" stroke={palette.accentDeep}
        strokeWidth={2} strokeLinecap="round" strokeDasharray={[circumference, circumference]} animatedProps={ring} />
      <AnimatedCircle cx={14} cy={14} r={12} fill={palette.accentDeep} animatedProps={disc} />
      <AnimatedPath d="m8.5 14 3.6 3.6 7.5-8" fill="none" stroke="#fff" strokeWidth={2.8}
        strokeLinecap="round" strokeLinejoin="round" animatedProps={tick} />
    </Svg>
  </View>;
}

function Benefit({ index, clock, onMeasure }: { index: number; clock: SharedValue<number>; onMeasure(height: number): void }) {
  const { palette, type } = useFrameTheme();
  const beat = beats[index];
  const item = benefits[index];
  const quoteStyle = useAnimatedStyle(() => ({
    opacity: clock.get() < beat.start ? 0 : 1 - fade(clock.get(), beat.quoteOut, beat.quoteOut + motion.state),
  }));
  const answerStyle = useAnimatedStyle(() => ({
    opacity: fade(clock.get(), beat.answerIn, beat.answerIn + motion.confirm) * (index === benefits.length - 1 ? 1 : 1 - fade(clock.get(), beat.end, beat.end + motion.state)),
  }));
  let offset = 0;
  return <>
    <Animated.View style={[styles.layer, quoteStyle]}>
      <View style={styles.thoughtWrap} onLayout={event => onMeasure(event.nativeEvent.layout.height)}>
        {`“${item.pain}”`.split(" ").map((word, i) => {
          const start = offset; offset += word.length + 1;
          return <ThoughtWord key={i} word={word} offset={start} beat={beat} clock={clock} />;
        })}
      </View>
    </Animated.View>
    <Animated.View style={[styles.layer, answerStyle]}>
      <View style={styles.resolution}>
        <Text onLayout={event => onMeasure(event.nativeEvent.layout.height)} style={[type.heading, styles.answer, { color: palette.active }]}>{item.detail}</Text>
        <BenefitCheck clock={clock} start={beat.checkIn} />
      </View>
    </Animated.View>
  </>;
}

type BenefitsProps = { firstVisit: boolean; onCompletionChange(complete: boolean): void };
export default function ViewingBenefits({ firstVisit, onCompletionChange }: BenefitsProps) {
  const [run, setRun] = useState(0);
  return <BenefitsSequence key={run} firstVisit={firstVisit || run > 0} onCompletionChange={onCompletionChange}
    onReplay={() => { onCompletionChange(false); setRun(value => value + 1); }} />;
}

function BenefitsSequence({ firstVisit, onCompletionChange, onReplay }: BenefitsProps & { onReplay(): void }) {
  const { palette, type } = useFrameTheme();
  const reduced = useReducedMotionPreference();
  const visible = useMotionVisibility();
  const [screenReader, setScreenReader] = useState<boolean | null>(Platform.OS === "web" ? false : null);
  const [finished, setFinished] = useState(!firstVisit);
  const [textHeight, setTextHeight] = useState(0);
  const measure = useCallback((height: number) => setTextHeight(previous => Math.max(previous, height)), []);
  const clock = useSharedValue(firstVisit ? 0 : duration);
  const generation = useRef(0);
  const staticReading = reduced === true || screenReader === true;
  const ready = reduced !== null && screenReader !== null;
  const complete = useCallback((run: number) => { if (generation.current === run) setFinished(true); }, []);
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true, observed = false;
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", value => { observed = true; setScreenReader(value); });
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (active && !observed) setScreenReader(value); }).catch(() => { if (active) setScreenReader(true); });
    return () => { active = false; subscription.remove(); };
  }, []);
  useLayoutEffect(() => {
    generation.current += 1;
    clock.set(firstVisit ? 0 : duration);
    setFinished(!firstVisit);
    return () => { generation.current += 1; cancelAnimation(clock); };
  }, [firstVisit, clock]);
  useEffect(() => { onCompletionChange(ready && (finished || staticReading)); }, [ready, finished, staticReading, onCompletionChange]);
  useEffect(() => {
    if (!ready || !visible || staticReading || finished) return;
    const run = generation.current;
    clock.set(withTiming(duration, { duration: Math.max(0, duration - clock.get()), easing: Easing.linear, reduceMotion: ReduceMotion.Never }, done => {
      if (done) scheduleOnRN(complete, run);
    }));
    return () => cancelAnimation(clock);
  }, [ready, visible, staticReading, finished, clock, complete]);
  const titleStyle = useAnimatedStyle(() => ({ opacity: 1 - fade(clock.get(), titleHold, titleEnd) }));
  const repeat = () => { cancelAnimation(clock); onReplay(); };
  return <View style={styles.story}>
    {staticReading ? <View style={styles.staticStory}>
      <Text accessibilityRole="header" style={[type.title, styles.title]}>{title}</Text>
      {benefits.map(item => <View key={item.pain} style={styles.staticPoint}>
        <Text style={[type.bodySoft, styles.staticThought]}>“{item.pain}”</Text>
        <Text style={[type.heading, styles.staticAnswer, { color: palette.active }]}>{item.detail}</Text>
      </View>)}
    </View> : <View collapsable={false} style={[styles.stage, { minHeight: Math.max(360, textHeight + 96) }]} accessible={Platform.OS === "web"} accessibilityLabel={`${title} ${benefits.map(item => `You: ${item.pain} With Frame: ${item.detail}`).join(" ")}`}>
      <View pointerEvents="none" style={[styles.visuals, { minHeight: Math.max(280, textHeight) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <Animated.View style={[styles.layer, titleStyle]}><Text onLayout={event => measure(event.nativeEvent.layout.height)} style={[type.title, styles.title]}>{title}</Text></Animated.View>
        {benefits.map((item, index) => <Benefit key={item.pain} index={index} clock={clock} onMeasure={measure} />)}
      </View>
    </View>}
    {!staticReading && <Pressable accessibilityRole="button" accessibilityLabel="Replay benefits" onPress={repeat} testID="benefits-replay"
      style={({ pressed }) => [styles.repeat, { opacity: pressed ? 0.8 : 0.42 }]}>
      <RotateCcw size={19} strokeWidth={1.5} color={palette.active} />
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  story: { flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center", paddingBottom: 80 },
  stage: { flexGrow: 1, minHeight: 360, justifyContent: "center" },
  visuals: { minHeight: 280, width: "100%" },
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 36, lineHeight: 46, textAlign: "center", maxWidth: 440 },
  thoughtWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 7, maxWidth: 440 },
  word: { flexDirection: "row", alignItems: "center" },
  thought: { fontFamily: fonts.serifItalic, fontSize: 28, lineHeight: 42 },
  strike: { position: "absolute", left: -2, right: -2, height: 1.5, top: "53%", transformOrigin: "left center" },
  resolution: { width: "100%", alignItems: "center", maxWidth: 440 },
  answer: { fontSize: 30, lineHeight: 40, textAlign: "center" },
  check: { position: "absolute", top: "100%", paddingTop: spacing.lg, alignSelf: "center" },
  repeat: { position: "absolute", bottom: spacing.md, zIndex: 1, alignSelf: "center", width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  staticStory: { gap: spacing.xl, paddingVertical: spacing.lg },
  staticPoint: { gap: spacing.sm, alignItems: "center" },
  staticThought: { textAlign: "center", fontFamily: fonts.serifItalic },
  staticAnswer: { textAlign: "center", fontSize: 24, lineHeight: 32 },
});
