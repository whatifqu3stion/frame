import { Animated, StyleSheet, Text, View } from "react-native";
import Reanimated, { useAnimatedReaction, useAnimatedStyle } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { fonts } from "@/constants/theme";
import { motion } from "@/constants/motion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { useStudyReveal } from "@/hooks/useStudyReveal";
import { previewViewingHistory } from "@/preview/viewingHistory";
import { viewingWeek } from "@/domain/viewingHistory";

// Anchor the illustrative week on a Sunday so replay always shows the same edition.
const sunday = new Date(2026, 10, 15, 12).getTime();
const days = viewingWeek(previewViewingHistory(sunday), sunday).map(day => ({
  label: day.date.toLocaleDateString(undefined, { weekday: "short" }),
  minutes: (day.milliseconds ?? 0) / 60000,
}));
const ceiling = 60;

function WeekColumn({ index, plotHeight, visible, onComplete }: { index: number; plotHeight: number; visible: boolean; onComplete(): void }) {
  const { palette } = useFrameTheme();
  const day = days[index];
  const last = index === days.length - 1;
  const height = Math.max(2, plotHeight * day.minutes / ceiling);
  const ink = useStudyReveal(visible, motion.chart, motion.reorder + index * 70);
  useAnimatedReaction(
    () => visible && last && ink.get() === 1,
    (complete, previous) => { if (complete && !previous) scheduleOnRN(onComplete); },
    [visible, last, onComplete],
  );
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: height * (1 - ink.value) }] }));
  return <View style={s.day}>
    <View style={[s.track, { height: plotHeight }]}>
      <View style={[s.mask, { height }]}>
        <Reanimated.View style={[StyleSheet.absoluteFill, { backgroundColor: last ? palette.active : palette.inkMuted }, rise]} />
      </View>
    </View>
    <View style={[s.label, last && { backgroundColor: palette.accentDeep }]}>
      <Text allowFontScaling={false} style={[s.small, { color: last ? palette.onDark : palette.inkSoft }]}>{day.label}</Text>
    </View>
  </View>;
}

export default function PreviewViewingWeek({ compact, onComplete }: { compact: boolean; onComplete(): void }) {
  const { palette } = useFrameTheme();
  const visible = useMotionVisibility();
  const { progress, reduced } = usePresentationProgress({ enter: true, duration: motion.artwork });
  const plotHeight = compact ? 88 : 120;
  return <Animated.View accessible accessibilityRole="image"
    accessibilityLabel={`Viewing time, sample week. ${days.map(d => `${d.label}, ${d.minutes} minutes`).join(". ")}.`}
    style={[StyleSheet.absoluteFill, s.sheet, { backgroundColor: palette.surface, opacity: progress,
      transform: [{ scale: reduced ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] }]}>
    <View style={s.content}>
      <Text allowFontScaling={false} style={[s.title, { color: palette.ink }]}>Viewing time</Text>
      <Text allowFontScaling={false} style={[s.meta, { color: palette.inkSoft }]}>Sample week</Text>
      <View style={s.plot}>
        {[60, 30, 0].map(value => <View key={value} style={[s.guide, { top: plotHeight * (1 - value / ceiling) }]}>
          <Text allowFontScaling={false} style={[s.tick, { color: palette.inkMuted }]}>{value === 60 ? "1 hr" : value === 30 ? "30m" : "0"}</Text>
          <View style={[s.rule, { backgroundColor: palette.border }]} />
        </View>)}
        {days.map((day, index) => <WeekColumn key={day.label} index={index} plotHeight={plotHeight} visible={visible} onComplete={onComplete} />)}
      </View>
    </View>
  </Animated.View>;
}

const s = StyleSheet.create({
  sheet: { justifyContent: "center", paddingHorizontal: 20, paddingBottom: 14 },
  content: { width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 37 },
  meta: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19 },
  plot: { marginTop: 21, paddingLeft: 29, flexDirection: "row" },
  guide: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", height: 16, transform: [{ translateY: -8 }] },
  tick: { width: 29, fontFamily: fonts.sans, fontSize: 10, lineHeight: 14 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  day: { flex: 1, alignItems: "center" },
  track: { width: "100%", alignItems: "center", justifyContent: "flex-end" },
  mask: { width: "58%", maxWidth: 33, overflow: "hidden" },
  label: { marginTop: 6, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  small: { fontFamily: fonts.sansMedium, fontSize: 10, lineHeight: 14 },
});
