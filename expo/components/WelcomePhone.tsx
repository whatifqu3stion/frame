import { useEffect, useLayoutEffect, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Reanimated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useEvent, useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { BatteryFull, Check, Plus, RotateCcw, Signal, Wifi } from "lucide-react-native";
import { fonts, watchPalette } from "@/constants/theme";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useReducedMotionPreference } from "@/hooks/useReducedMotion";
import { useMotionTarget } from "@/hooks/useMotionTarget";
import { useRoomLighting } from "@/hooks/useRoomLighting";
import { ViewingRoomSurface } from "@/components/motion/ViewingRoom";
import { useApp } from "@/providers/AppProvider";
import PreviewViewingWeek from "@/components/PreviewViewingWeek";
import { motion } from "@/constants/motion";

// Silent excerpt, 00:30–00:36. NASA Goddard Scientific Visualization Studio, Ernie Wright.
// Tour of the Moon 4K Redux, https://svs.gsfc.nasa.gov/4619/
const poster = require("../assets/welcome/moon-tour.jpg");
const discoverPicks = [
  // Spring © Blender Foundation, CC BY 4.0. https://studio.blender.org/projects/spring/
  { source: "Blender Studio", title: "Spring", poster: require("../assets/welcome/spring.jpg") },
  // https://www.youtube.com/watch?v=3uiUHvET_jg
  { source: "NPR Music", title: "Yo-Yo Ma: Tiny Desk", poster: require("../assets/welcome/yo-yo-ma.jpg") },
  // https://www.youtube.com/watch?v=ltiskoXIK2I
  { source: "V&A", title: "How a linocut is made", poster: require("../assets/welcome/linocut.jpg") },
  { source: "NASA Goddard", title: "Tour of the Moon", poster },
];
const topics = INTEREST_LIBRARY.filter(topic => ["science", "tech", "design", "film", "music", "history"].includes(topic.id));
const choices = ["science", "design", "music"];
type Scene = "interests" | "closeup" | "art" | "music" | "science" | "settle" | "discover" | "browsing" | "opening" | "theatre" | "ending" | "week";
const browseEase = Easing.bezier(0.77, 0, 0.175, 1);
const moonPreviewSeconds = 3.8;

const beats: Partial<Record<Scene, { next: Scene; hold: number }>> = {
  interests: { next: "closeup", hold: 420 },
  closeup: { next: "science", hold: motion.artwork },
  science: { next: "art", hold: 600 },
  art: { next: "music", hold: 600 },
  music: { next: "settle", hold: motion.ending },
  settle: { next: "discover", hold: motion.reorder },
  discover: { next: "browsing", hold: 850 },
  browsing: { next: "opening", hold: motion.reveal + 900 },
  opening: { next: "theatre", hold: motion.choice },

};
const sceneDescriptions: Record<Scene, string> = {
  interests: "Choosing topics for Frame’s weekly picks.",
  closeup: "A closer look at six interests.",
  science: "Science & Nature selected.",
  art: "Arts & Design added to Science & Nature.",
  music: "Music added. Three interests selected.",
  settle: "Three interests selected. Opening weekly picks.",
  discover: `Sources, Discover. Weekly picks: ${discoverPicks.map(pick => `${pick.title} from ${pick.source}`).join(". ")}.`,
  browsing: "Scrolling through weekly picks to Tour of the Moon at the bottom.",
  opening: "Opening the featured film, Tour of the Moon.",
  theatre: "Tour of the Moon playing in Frame’s viewing room.",
  ending: "The film has ended. Nothing else plays automatically.",
  week: "Viewing time for a sample week.",
};

function TopicChip({ name, chosen }: { name: string; chosen: boolean }) {
  const { palette } = useFrameTheme();
  const selection = useMotionTarget(chosen ? 1 : 0, motion.choice);
  const Mark = chosen ? Check : Plus;
  return <View style={[s.chip, { borderColor: chosen ? palette.active : palette.border }]}>
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: selection, backgroundColor: palette.activeSoft }]} />
    <Animated.View style={{ transform: [{ scale: selection.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0.87, 1] }) }] }}>
      <Mark size={12} color={chosen ? palette.active : palette.inkMuted} />
    </Animated.View>
    <Text allowFontScaling={false} style={[s.chipText, { color: chosen ? palette.active : palette.ink }]}>{name}</Text>
  </View>;
}

function PhoneStory({ reduced, requested, onCompletionChange }: { reduced: boolean; requested: boolean; onCompletionChange(complete: boolean): void }) {
  const { palette } = useFrameTheme();
  const { width, height } = useWindowDimensions();
  const visible = useMotionVisibility();
  const { prefs } = useApp();
  const run = !reduced || requested;
  const [scene, setScene] = useState<Scene>(run ? "interests" : "discover");
  const [hasFrame, setHasFrame] = useState(false);
  const [listHeight, setListHeight] = useState(0);
  useLayoutEffect(() => { onCompletionChange(!run); }, [run, onCompletionChange]);
  const player = useVideoPlayer(require("../assets/welcome/moon-tour.mp4"), p => {
    p.muted = true;
    p.loop = false;
    p.audioMixingMode = "mixWithOthers";
    p.keepScreenOnWhilePlaying = false;
    p.timeUpdateEventInterval = 0.1;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEventListener(player, "playToEnd", () => setScene(current => current === "theatre" ? "ending" : current));
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (currentTime >= moonPreviewSeconds) setScene(current => current === "theatre" ? "ending" : current);
  });
  const failed = status === "error";
  useEffect(() => {
    if (!run || !visible) return;
    const beat = scene === "ending"
      ? { next: "week" as const, hold: prefs.houseLights && !reduced ? motion.roomRise + motion.confirm : 950 }
      : beats[scene];
    if (beat) {
      const timer = setTimeout(() => setScene(beat.next), beat.hold);
      return () => clearTimeout(timer);
    }
    if (scene === "theatre") {
      const timer = setTimeout(() => setScene("ending"), failed ? 2400 : 10000);
      return () => clearTimeout(timer);
    }
  }, [scene, run, visible, failed, prefs.houseLights, reduced]);
  useEffect(() => {
    if (visible && run && scene === "theatre" && status === "readyToPlay") player.play();
    else player.pause();
  }, [player, scene, run, status, visible]);
  const compact = height < 740 || width < 360;
  const ending = scene === "ending" || scene === "week";
  const inTheatre = scene === "theatre" || ending;
  const showDiscover = inTheatre || scene === "discover" || scene === "browsing" || scene === "opening";
  const listViewportHeight = compact ? 126 : 170;
  const scrolled = scene === "browsing" || scene === "opening" || inTheatre;
  const listOffset = useSharedValue(0);
  useEffect(() => {
    const target = scrolled ? Math.max(0, listHeight - listViewportHeight) : 0;
    listOffset.set(reduced || !visible ? target : withTiming(target, { duration: motion.reveal, easing: browseEase }));
    return () => cancelAnimation(listOffset);
  }, [scrolled, listHeight, listViewportHeight, reduced, visible, listOffset]);
  const listStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -listOffset.get() }] }));
  const choiceCount = scene === "science" ? 1 : scene === "art" ? 2 : scene === "music" || scene === "settle" || showDiscover ? 3 : 0;
  const closeup = scene !== "interests" && scene !== "settle" && !showDiscover;
  const zoom = useMotionTarget(closeup && !reduced ? 1.26 : 1, closeup ? motion.artwork : motion.reorder);
  const discovery = useMotionTarget(showDiscover ? 1 : 0, motion.confirm);
  const press = useMotionTarget(scene === "opening" || inTheatre ? 0.975 : 1, reduced ? 0 : motion.choice);
  const darkness = useRoomLighting(inTheatre, ending, prefs.houseLights);
  const statusInk = inTheatre ? watchPalette.inkSoft : palette.ink;
  return <>
    <Animated.View accessible={scene !== "week"} accessibilityElementsHidden={scene === "week"} aria-hidden={scene === "week"} importantForAccessibility={scene === "week" ? "no-hide-descendants" : "auto"} accessibilityRole="image" accessibilityLabel={sceneDescriptions[scene]}
    style={[s.device, { width: compact ? "70%" : "73%", maxWidth: compact ? 238 : 280, top: compact ? 12 : 18, transformOrigin: "center top", transform: [{ scale: zoom }] }]}>
    <View style={[s.hardwareKey, s.volumeUp]} />
    <View style={[s.hardwareKey, s.volumeDown]} />
    <View style={[s.hardwareKey, s.power]} />
    <View style={[s.glass, { backgroundColor: palette.surface }]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={s.page}>
        <View style={s.topicHeading}>
          <Text allowFontScaling={false} style={[s.miniHeading, { color: palette.ink }]}>Topics</Text>
          <Text allowFontScaling={false} style={[s.meta, { color: palette.inkSoft }]}>{choiceCount} selected</Text>
        </View>
        <View style={s.topicGrid}>
          {topics.map(topic => <TopicChip key={topic.id} name={topic.name} chosen={choices.slice(0, choiceCount).includes(topic.id)} />)}
        </View>
      </View>
      {showDiscover && <Animated.View style={[StyleSheet.absoluteFill, s.page, { backgroundColor: palette.surface, opacity: discovery }]}>
        <Text allowFontScaling={false} style={[s.title, { color: palette.ink }]}>Sources</Text>
        <View style={[s.tabs, { backgroundColor: palette.surfaceDeep }]}>
          <Text allowFontScaling={false} style={[s.tabLabel, { color: palette.inkMuted }]}>Followed</Text>
          <Text allowFontScaling={false} style={[s.tabLabel, { color: palette.active, backgroundColor: palette.surfaceHigh }]}>Discover</Text>
        </View>
        <Text allowFontScaling={false} style={[s.edition, { color: palette.inkSoft }]}>Weekly picks</Text>
        <View style={{ height: listViewportHeight, overflow: "hidden" }}>
        <Reanimated.View onLayout={event => setListHeight(event.nativeEvent.layout.height)} style={listStyle}>
        {discoverPicks.map((pick, index) => <Animated.View key={pick.source} style={[s.pickRow,
          index > 0 && { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
          pick.source === "NASA Goddard" && { transform: [{ scale: press }], backgroundColor: scene === "opening" ? palette.activeSoft : "transparent" },
        ]}>
          <View style={s.pickPoster}><Image source={pick.poster} style={s.cover} resizeMode="cover" /></View>
          <View style={s.pickCopy}>
            <Text allowFontScaling={false} style={[s.byline, { color: palette.inkSoft }]}>{pick.source}</Text>
            <Text allowFontScaling={false} style={[s.pickTitle, { color: palette.ink }]}>{pick.title}</Text>
          </View>
        </Animated.View>)}
        </Reanimated.View>
        </View>
      </Animated.View>}
      {inTheatre && <View style={StyleSheet.absoluteFill}>
        <ViewingRoomSurface darkness={darkness}>
          <Text allowFontScaling={false} style={[s.kicker, s.roomLabel]}>Viewing room</Text>
          <View style={s.frame}>
            {status !== "error" && <VideoView player={player} style={s.cover} nativeControls={false} playsInline
              surfaceType="textureView" contentFit="contain" onFirstFrameRender={() => setHasFrame(true)} />}
            {(!hasFrame || status === "error") && <Image source={poster} resizeMode="cover" style={[StyleSheet.absoluteFill, s.cover]} />}
          </View>
          <View style={s.credit}>
            <Text allowFontScaling={false} style={[s.kicker, { color: watchPalette.inkSoft }]}>{ending ? "The end" : "NASA Goddard"}</Text>
            <Text allowFontScaling={false} style={s.filmTitle}>{ending ? "A good place to stop." : "Tour of the Moon"}</Text>
          </View>
        </ViewingRoomSurface>
      </View>}
      <View style={s.statusBar}>
        <Text allowFontScaling={false} style={[s.time, { color: statusInk }]}>9:41</Text>
        <View style={s.indicators}><Signal size={10} color={statusInk} /><Wifi size={10} color={statusInk} /><BatteryFull size={13} color={statusInk} /></View>
      </View>
      <View style={s.speaker}><View style={s.lens} /></View>
    </View>
  </Animated.View>
  {scene === "week" && <PreviewViewingWeek compact={compact} onComplete={() => onCompletionChange(true)} />}
  </>;
}

function PhoneStage({ reduced, onCompletionChange }: { reduced: boolean | null; onCompletionChange(complete: boolean): void }) {
  const { palette } = useFrameTheme();
  const { width, height } = useWindowDimensions();
  const [replay, setReplay] = useState(0);
  const [focused, setFocused] = useState(false);
  const compact = height < 740 || width < 360;
  return <View style={[s.stage, { height: compact ? 254 : 304, backgroundColor: palette.accentDeep }]}>
    <Image source={require("../assets/textures/panel-ink.png")} accessible={false} aria-hidden
      resizeMode="cover" fadeDuration={0} style={s.wash} />
    {reduced !== null && <PhoneStory key={replay} reduced={reduced} requested={replay > 0} onCompletionChange={onCompletionChange} />}
    <Pressable accessibilityRole="button" accessibilityLabel="Replay Frame preview"
      onPress={() => setReplay(previous => previous + 1)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => [s.repeatTarget, { opacity: focused || pressed ? 1 : 0.5 }]}>
      <View style={s.repeatDisc}><RotateCcw size={14} strokeWidth={1.7} color="#FFFDF8" /></View>
    </Pressable>
  </View>;
}

export default function WelcomePhone({ onCompletionChange }: { onCompletionChange(complete: boolean): void }) {
  const reduced = useReducedMotionPreference();
  return <PhoneStage key={String(reduced)} reduced={reduced} onCompletionChange={onCompletionChange} />;
}

const s = StyleSheet.create({
  stage: { overflow: "hidden", alignItems: "center", borderRadius: 12 },
  device: { position: "absolute", aspectRatio: 0.475, padding: 4, borderRadius: 33,
    backgroundColor: "#171819", borderWidth: 1.5, borderColor: "#8F9190", borderTopColor: "#D1D1CC",
    borderRightColor: "#585B5B", boxShadow: "2px 3px 5px rgba(0,0,0,0.24), 5px 12px 22px rgba(0,0,0,0.2)" },
  hardwareKey: { position: "absolute", width: 2, borderRadius: 1, backgroundColor: "#737674" },
  volumeUp: { left: -3, top: 63, height: 18 }, volumeDown: { left: -3, top: 85, height: 18 },
  power: { right: -3, top: 75, height: 30 },
  glass: { flex: 1, overflow: "hidden", borderRadius: 27, borderCurve: "continuous" },
  speaker: { position: "absolute", top: 7, width: 34, height: 9, paddingRight: 3, justifyContent: "center",
    alignItems: "flex-end", borderRadius: 5, backgroundColor: "#0E0F10", alignSelf: "center" },
  lens: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#25303D" },
  statusBar: { position: "absolute", top: 5, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { fontFamily: fonts.sansSemibold, fontSize: 8, lineHeight: 12 }, indicators: { gap: 2, flexDirection: "row", alignItems: "center" },
  page: { paddingHorizontal: 12, paddingTop: 25 }, kicker: { fontFamily: fonts.sansSemibold, fontSize: 11, lineHeight: 15 },
  title: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 26, marginBottom: 4 },
  miniHeading: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 25 },
  topicHeading: { marginTop: 11, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topicGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexGrow: 1, flexBasis: "44%", flexDirection: "row", alignItems: "center", gap: 3, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderRadius: 5, minHeight: 34, paddingVertical: 5, paddingHorizontal: 6 },
  chipText: { flexShrink: 1, fontFamily: fonts.sansMedium, fontSize: 10, lineHeight: 13 },
  meta: { fontFamily: fonts.sans, fontSize: 10, lineHeight: 14 },
  tabs: { flexDirection: "row", padding: 2, borderRadius: 5 },
  tabLabel: { flex: 1, overflow: "hidden", textAlign: "center", fontFamily: fonts.sansMedium, fontSize: 10, lineHeight: 18, borderRadius: 4 },
  edition: { fontFamily: fonts.sansSemibold, fontSize: 10, lineHeight: 14, marginVertical: 4 },
  byline: { fontFamily: fonts.sansMedium, fontSize: 10, lineHeight: 14 },
  roomLabel: { marginTop: 31, color: watchPalette.inkSoft, paddingHorizontal: 12, marginBottom: 10 },
  frame: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden", backgroundColor: "#050506" },
  cover: { width: "100%", height: "100%" }, credit: { paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  filmTitle: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 25, color: watchPalette.ink },
  wash: { position: "absolute", width: "360%", height: "290%", left: "-106%", top: "-115%", opacity: 0.23 },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 76, paddingVertical: 8 },
  pickCopy: { flex: 1, gap: 2 },
  pickPoster: { width: "31%", aspectRatio: 16 / 9, borderRadius: 3, overflow: "hidden" },
  pickTitle: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 19 },
  repeatTarget: { position: "absolute", right: 6, bottom: 8, width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  repeatDisc: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(18, 29, 33, 0.42)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.45)" },
});
