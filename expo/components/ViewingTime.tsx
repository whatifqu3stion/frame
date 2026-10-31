import { chartDayAt } from "@/domain/artworkGeometry";
import Text from "@/components/FrameText";
import ViewingBar from "@/components/motion/ViewingBar";
import MotionView from "@/components/motion/MotionView";
import { useMotionTarget } from "@/hooks/useMotionTarget";
import { useFeedback } from "@/hooks/useFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, PanResponder, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Heading from "@/components/Heading";
import InlineHelp from "@/components/InlineHelp";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { formatViewingTime, viewingWeek } from "@/domain/viewingHistory";
import { viewingHistoryStore } from "@/services/viewingHistoryService";
import { PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import { previewViewingHistory } from "@/preview/viewingHistory";

/** Profile-scoped awareness, deliberately separate from allowance controls. */
export default function ViewingTime({ profileId }: { profileId: string }) {
  const { palette, type } = useFrameTheme();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(() => createStyles(palette, type, fontScale), [palette, type, fontScale]);
  const [now, setNow] = useState(Date.now);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const feedback = useFeedback();
  const [plotWidth, setPlotWidth] = useState(308);
  const [viewportWidth, setViewportWidth] = useState(0);
  const plot = useRef<ScrollView>(null);
  const positioned = useRef(false);
  const viewport = useRef<View>(null);
  const offset = useRef(0);
  const bounds = useRef({ x: 0, width: 0 });
  const [scrubbing, setScrubbing] = useState(false);
  const latest = useRef({ days: [] as { key: string }[], width: plotWidth, selected: "" });
  const selectDay = (index: number) => {
    const key = latest.current.days[index]?.key;
    if (!key || key === latest.current.selected) return;
    latest.current.selected = key;
    feedback.selection(); setSelectedKey(key);
  };
  const scrub = useRef<(pageX: number) => void>(() => {});
  scrub.current = (pageX) => {
    const x = pageX - bounds.current.x;
    const maxOffset = Math.max(0, latest.current.width - bounds.current.width);
    if (maxOffset > 0) {
      offset.current = Math.max(0, Math.min(maxOffset, maxOffset * (x - 22) / Math.max(1, bounds.current.width - 44)));
      plot.current?.scrollTo({ x: offset.current, animated: false });
    }
    selectDay(chartDayAt(x + offset.current, latest.current.width, latest.current.days.length));
  };
  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.numberActiveTouches === 1 && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
    onPanResponderGrant: (_, gesture) => { setScrubbing(true); scrub.current(gesture.moveX); },
    onPanResponderMove: (_, gesture) => { if (gesture.numberActiveTouches === 1) scrub.current(gesture.moveX); },
    onPanResponderRelease: () => setScrubbing(false),
    onPanResponderTerminate: () => setScrubbing(false),
    onPanResponderTerminationRequest: () => true,
  })).current;
  const query = useQuery({ queryKey: ["viewing-history", profileId], queryFn: () => PREVIEW_LIBRARY_ENABLED ? Promise.resolve(previewViewingHistory(Date.now())) : viewingHistoryStore.read(profileId), networkMode: "always", retry: false });
  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    const refresh = () => { setNow(Date.now()); void refetch(); };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") refresh(); }, 60_000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [refetch]));
  const days = query.data ? viewingWeek(query.data, now) : [];
  const selected = days.find((day) => day.key === selectedKey) ?? days[6];
  const max = Math.max(60_000, ...days.map((day) => day.milliseconds ?? 0));
  const step = max <= 5 * 60_000 ? 60_000 : max <= 30 * 60_000 ? 5 * 60_000 : 30 * 60_000;
  const ceiling = Math.ceil(max / step) * step;
  const selectedIndex = Math.max(0, days.findIndex((day) => day.key === selected?.key));
  useEffect(() => {
    if (scrubbing || viewportWidth <= 0) return;
    const dayWidth = plotWidth / 7;
    const x = Math.max(0, Math.min(plotWidth - viewportWidth, (selectedIndex + 0.5) * dayWidth - viewportWidth / 2));
    offset.current = x;
    plot.current?.scrollTo({ x, animated: false });
  }, [plotWidth, scrubbing, selectedIndex, viewportWidth]);
  const selectionX = useMotionTarget(selectedIndex * plotWidth / 7, scrubbing ? 0 : undefined);
  latest.current = { days, width: plotWidth, selected: selected?.key ?? "" };
  const selectedLabel = selected?.key === days[6]?.key ? "Today" : selected?.date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  return <View style={styles.section} testID="viewing-time">
    <View style={styles.headingRow}>
      <Heading style={type.heading}>Viewing time</Heading>
      <Text style={type.caption}>{PREVIEW_LIBRARY_ENABLED ? "Sample · Last 7 days" : "In Frame · Last 7 days"}</Text>
    </View>
    {query.isError ? <View style={styles.message}><Text style={type.bodySoft}>Viewing time couldn’t load.</Text><Pressable accessibilityRole="button" onPress={() => { void refetch(); }} style={styles.retry}><Text style={[type.label, { color: palette.active }]}>Try again</Text></Pressable></View> : !selected ? <Text style={styles.loading} accessibilityLiveRegion="polite">Loading viewing time…</Text> : <>
      <MotionView changeKey={selected?.key} active={!scrubbing} distance={4}><Text style={styles.readout} accessibilityLiveRegion={scrubbing ? "none" : "polite"}>{selectedLabel} · {selected.milliseconds === null ? "Not recorded" : formatViewingTime(selected.milliseconds)}</Text></MotionView>
      <View style={styles.chart}>
        <View style={styles.axis} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={styles.axisLabel}>{formatViewingTime(ceiling)}</Text><Text style={styles.axisLabel}>0</Text></View>
        <View ref={viewport} style={styles.plotViewport} {...responder.panHandlers} onTouchStart={() => viewport.current?.measureInWindow((x, _y, width) => { bounds.current = { x, width }; })} onLayout={event => { setViewportWidth(event.nativeEvent.layout.width); viewport.current?.measureInWindow((x, _y, width) => { bounds.current = { x, width }; }); }}><ScrollView ref={plot} horizontal scrollEnabled={false} onScroll={event => { offset.current = event.nativeEvent.contentOffset.x; }} scrollEventThrottle={16} contentContainerStyle={styles.plot} onContentSizeChange={(width) => { setPlotWidth(width); if (width > 0 && !positioned.current) { plot.current?.scrollToEnd({ animated: false }); positioned.current = true; } }}>
          <Animated.View pointerEvents="none" accessible={false} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: plotWidth / 7, backgroundColor: palette.activeSoft, opacity: 0.6, transform: [{ translateX: selectionX }] }} />
          <View pointerEvents="none" style={styles.grid}><View style={styles.guide} /><View style={styles.guide} /></View>
          {days.map((day, index) => {
            const chosen = day.key === selected.key;
            const amount = day.milliseconds;
            return <Pressable key={day.key} onPress={() => selectDay(index)} onFocus={() => { const x = Math.max(0, Math.min(plotWidth - viewportWidth, (index + 0.5) * plotWidth / 7 - viewportWidth / 2)); offset.current = x; plot.current?.scrollTo({ x, animated: false }); }} accessibilityRole="button" aria-pressed={chosen} accessibilityState={{ selected: chosen }} accessibilityLabel={`${day.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}, ${amount === null ? "not recorded" : `${formatViewingTime(amount)} recorded in Frame`}`} style={styles.day}>
              <View style={styles.barTrack}>
                {amount === null ? <Text style={styles.missing} accessible={false}>—</Text> : <ViewingBar height={amount === 0 ? 1 : Math.max(2, amount / ceiling * 72)} selected={chosen} scrubbing={scrubbing} index={index} />}
              </View>
              <Text style={[styles.dayLabel, chosen && { color: palette.active, textDecorationLine: "underline" }]}>{day.date.toLocaleDateString([], { weekday: "short" })}</Text>
            </Pressable>;
          })}
        </ScrollView></View>
      </View>
      <InlineHelp label="About this time">
        <Text style={type.bodySoft}>Active video playback for this profile on this device. Paused video, browsing Frame, and other apps aren’t counted. Tap or slide across the days to see each total.</Text>
        <Text style={type.bodySoft}>Recording began {new Date(query.data!.startedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}; that first day may be partial. A dash means no earlier record. Zero means no playback recorded. Daily totals stay on this device and are removed with the profile.</Text>
      </InlineHelp>
    </>}
  </View>;
}

function createStyles(p: FramePalette, t: FrameType, fontScale: number) {
  const dayWidth = Math.max(48, 32 * fontScale);
  return StyleSheet.create({
    section: { marginTop: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border },
    headingRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
    readout: { ...t.label, marginTop: spacing.sm, marginBottom: spacing.md, fontVariant: ["tabular-nums"] },
    chart: { flexDirection: "row", gap: spacing.sm },
    axis: { minWidth: 34, flexShrink: 0, height: 78, justifyContent: "space-between" }, axisLabel: { ...t.caption, fontVariant: ["tabular-nums"] },
    plotViewport: { flex: 1 }, plot: { flexGrow: 1, minWidth: dayWidth * 7, flexDirection: "row" }, grid: { position: "absolute", top: 6, left: 0, right: 0, height: 72, justifyContent: "space-between" }, guide: { height: StyleSheet.hairlineWidth, backgroundColor: p.borderSoft },
    day: { flex: 1, minWidth: dayWidth, alignItems: "center", paddingBottom: spacing.xs },
    barTrack: { height: 78, width: "100%", alignItems: "center", justifyContent: "flex-end" },
    missing: { ...t.caption, paddingBottom: 1 }, dayLabel: { ...t.caption, marginTop: spacing.sm },
    message: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }, retry: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm },
    loading: { ...t.bodySoft, paddingVertical: spacing.md },
  });
}
