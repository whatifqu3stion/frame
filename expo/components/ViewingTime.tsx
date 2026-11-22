import { chartDayAt } from "@/domain/artworkGeometry";
import { compactViewingHistory, viewingChartLayout, viewingChartOffset } from "@/domain/viewingChartLayout";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
import InfoButton from "@/components/InfoButton";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import Text from "@/components/FrameText";
import ViewingBar, { VIEWING_BAR_HEIGHT } from "@/components/motion/ViewingBar";
import { useFeedback } from "@/hooks/useFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, PanResponder, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Heading from "@/components/Heading";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { formatViewingTime, viewingWeek } from "@/domain/viewingHistory";
import { viewingHistoryStore } from "@/services/viewingHistoryService";
import { PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import { previewViewingHistory } from "@/preview/viewingHistory";

/** Profile-scoped awareness, deliberately separate from allowance controls. */
export default function ViewingTime({ profileId }: { profileId: string }) {
  const { palette, type } = useFrameTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const compact = compactViewingHistory(width, height, fontScale);
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [now, setNow] = useState(Date.now);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const feedback = useFeedback();
  const [viewportWidth, setViewportWidth] = useState(0);
  const { plotWidth, dayWidth, visibleDays, overflow } = viewingChartLayout(viewportWidth, fontScale);
  const plot = useRef<ScrollView>(null);
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
  const peak = Math.max(0, ...days.map((day) => day.milliseconds ?? 0));
  const plotHeight = peak > 0 ? VIEWING_BAR_HEIGHT : spacing.lg;
  const max = Math.max(60_000, peak);
  const step = max <= 5 * 60_000 ? 60_000 : max <= 30 * 60_000 ? 5 * 60_000 : 30 * 60_000;
  const ceiling = Math.ceil(max / step) * step;
  const selectedIndex = Math.max(0, days.findIndex((day) => day.key === selected?.key));
  useEffect(() => {
    if (scrubbing || viewportWidth <= 0) return;
    const x = viewingChartOffset(selectedIndex, visibleDays, dayWidth);
    offset.current = x;
    plot.current?.scrollTo({ x, animated: false });
  }, [dayWidth, expanded, scrubbing, selectedIndex, viewportWidth, visibleDays]);
  latest.current = { days, width: plotWidth, selected: selected?.key ?? "" };
  const selectedLabel = selected?.key === days[6]?.key ? "Today" : selected?.date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  const readout = selected && !query.isError ? <Text style={styles.readout} accessibilityLiveRegion={scrubbing ? "none" : "polite"}>
    {selectedLabel} · {selected.milliseconds === null ? "Not recorded" : formatViewingTime(selected.milliseconds)}
  </Text> : null;
  return <View style={styles.section} testID="viewing-time">
    <View style={styles.headingRow}>
      <View style={styles.headingGroup}>
        <Heading style={[type.heading, { flexShrink: 1 }]}>Viewing time</Heading>
        <InfoButton label="About viewing time" expanded={infoOpen} onPress={() => setInfoOpen((open) => !open)} />
      </View>
      {compact ? <Pressable accessibilityRole="button" accessibilityLabel={expanded ? "Hide weekly viewing history" : "Show weekly viewing history"} aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.weekToggle}>
        {readout}<DisclosureIndicator expanded={expanded} color={palette.active} />
      </Pressable> : readout}
    </View>
    {infoOpen && <Text style={styles.infoText}>{PREVIEW_LIBRARY_ENABLED ? "Sample playback totals for the last seven days." : "Time spent playing videos in Frame, for this profile on this device."}{query.data && !PREVIEW_LIBRARY_ENABLED && days.some((day) => day.milliseconds === null) ? ` Tracking began ${new Date(query.data.startedAt).toLocaleDateString([], { month: "short", day: "numeric" })}.` : ""}</Text>}
    {query.isError ? <View style={styles.message}><Text style={type.bodySoft}>Viewing time couldn’t load.</Text><Pressable accessibilityRole="button" onPress={() => { void refetch(); }} style={styles.retry}><Text style={[type.label, { color: palette.active }]}>Try again</Text></Pressable></View> : !selected ? <Text style={styles.loading} accessibilityLiveRegion="polite">Loading viewing time…</Text> : compact && !expanded ? null : <>
      {peak > 0 && <View style={styles.scale}><View style={styles.guide} /><Text style={type.caption}>{formatViewingTime(ceiling)}</Text></View>}
      <View style={styles.chart}>
        <View ref={viewport} style={styles.plotViewport} {...responder.panHandlers} onTouchStart={() => viewport.current?.measureInWindow((x, _y, width) => { bounds.current = { x, width }; })} onLayout={event => { setViewportWidth(event.nativeEvent.layout.width); viewport.current?.measureInWindow((x, _y, width) => { bounds.current = { x, width }; }); }}><ScrollView ref={plot} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} onScroll={event => { offset.current = event.nativeEvent.contentOffset.x; }} scrollEventThrottle={16} contentContainerStyle={[styles.plot, { width: plotWidth }]}>
          <View pointerEvents="none" style={[styles.baseline, { top: plotHeight - StyleSheet.hairlineWidth }]} />
          {days.map((day, index) => {
            const chosen = day.key === selected.key;
            const amount = day.milliseconds;
            return <Pressable key={day.key} onPress={() => selectDay(index)} onFocus={() => { const x = viewingChartOffset(index, visibleDays, dayWidth); offset.current = x; plot.current?.scrollTo({ x, animated: false }); }} accessibilityRole="button" aria-pressed={chosen} accessibilityState={{ selected: chosen }} accessibilityLabel={`${day.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}, ${amount === null ? "not recorded" : `${formatViewingTime(amount)} recorded in Frame`}`} style={[styles.day, { width: dayWidth }]}>
              <View style={[styles.barTrack, { height: plotHeight }]}>
                {amount === null ? null : amount === 0
                  ? <View style={[styles.zero, { backgroundColor: chosen ? palette.active : palette.inkMuted }]} />
                  : <ViewingBar height={Math.max(3, amount / ceiling * VIEWING_BAR_HEIGHT)} selected={chosen} scrubbing={scrubbing} index={index} />}
              </View>
              <View style={[styles.labelWrap, chosen && styles.selectedLabel]}>
                <Text style={[styles.dayLabel, chosen && { color: palette.onDark }]}>{day.date.toLocaleDateString([], { weekday: "short" })}</Text>
              </View>
            </Pressable>;
          })}
        </ScrollView></View>
      </View>
      {overflow ? <View style={styles.dayNavigation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Show earlier days" disabled={selectedIndex === 0} accessibilityState={{ disabled: selectedIndex === 0 }} onPress={() => selectDay(Math.max(0, selectedIndex - visibleDays))} style={[styles.dayNavigationButton, selectedIndex === 0 && { opacity: 0.5 }]}><ChevronLeft size={16} color={palette.active} /><Text style={[type.label, { color: palette.active }]}>Earlier days</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Show later days" disabled={selectedIndex === days.length - 1} accessibilityState={{ disabled: selectedIndex === days.length - 1 }} onPress={() => selectDay(Math.min(days.length - 1, selectedIndex + visibleDays))} style={[styles.dayNavigationButton, selectedIndex === days.length - 1 && { opacity: 0.5 }]}><Text style={[type.label, { color: palette.active }]}>Later days</Text><ChevronRight size={16} color={palette.active} /></Pressable>
      </View> : null}
    </>}
  </View>;
}

function createStyles(p: FramePalette, t: FrameType) {
  return StyleSheet.create({
    section: { marginTop: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border },
    headingRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: spacing.sm },
    headingGroup: { flexDirection: "row", alignItems: "center", maxWidth: "100%" },
    infoText: { ...t.bodySoft, maxWidth: 440, marginBottom: spacing.sm },
    weekToggle: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", minHeight: 44, minWidth: 44, gap: spacing.xs },
    readout: { ...t.label, color: p.inkSoft, fontVariant: ["tabular-nums"], flexShrink: 1 },
    chart: { flexDirection: "row", gap: spacing.sm },
    plotViewport: { flex: 1 }, plot: { flexDirection: "row" },
    scale: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
    guide: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: p.borderSoft },
    baseline: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: p.border },
    day: { flexShrink: 0, minHeight: 48, alignItems: "center", paddingBottom: spacing.xs },
    barTrack: { width: "100%", alignItems: "center", justifyContent: "flex-end" },
    zero: { width: "45%", maxWidth: 26, height: 2 },
    dayNavigation: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: spacing.sm },
    dayNavigationButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.xs },
    labelWrap: { alignItems: "center", marginTop: spacing.xs, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 5 },
    selectedLabel: { backgroundColor: p.accentDeep },
    dayLabel: { ...t.caption, textAlign: "center" },
    message: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }, retry: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm },
    loading: { ...t.bodySoft, paddingVertical: spacing.md },
  });
}
