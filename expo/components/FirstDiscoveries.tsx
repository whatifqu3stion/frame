import { useLayoutEffect, type ReactNode } from "react";
import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import { Play } from "lucide-react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Text from "@/components/FrameText";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";
import { useReducedMotionPreference } from "@/hooks/useReducedMotion";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";

export type FirstDiscovery = {
  id: string; title: string; creator: string; image: ImageSource | number;
  reason?: string; durationSeconds?: number; interest?: string;
};

const ease = Easing.bezier(0.23, 1, 0.32, 1).factory();

/** A short editorial entrance, paused offscreen; content never waits for permission to be tapped. */
function Arrival({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useReducedMotionPreference();
  const active = useMotionVisibility();
  const elapsed = useSharedValue(0);
  const total = delay + motion.artwork;
  useLayoutEffect(() => {
    if (reduced === null) return;
    if (reduced) elapsed.set(total);
    else if (active) elapsed.set(withTiming(total, { duration: Math.max(0, total - elapsed.get()), easing: Easing.linear }));
    return () => cancelAnimation(elapsed);
  }, [active, reduced, total, elapsed]);
  const style = useAnimatedStyle(() => {
    const p = ease(Math.min(1, Math.max(0, (elapsed.get() - delay) / motion.artwork)));
    return { opacity: p, transform: [{ translateY: reduced ? 0 : (1 - p) * 12 }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The same composed reveal accepts verified discoveries and explicitly labelled preview content. */
export default function FirstDiscoveries({ items, onWatch, disabled = false, sample = false }: {
  items: FirstDiscovery[]; onWatch(id: string): void; disabled?: boolean; sample?: boolean;
}) {
  const { palette, type } = useFrameTheme();
  const [hero, ...rest] = items.slice(0, 3);
  if (!hero) return null;
  const minutes = (item: FirstDiscovery) => item.durationSeconds ? `${Math.ceil(item.durationSeconds / 60)} min` : "";
  return <View style={s.root} testID="first-discoveries">
    <View style={s.heading}>
      <Text style={[type.caption, { color: palette.active }]}>{sample ? "SAMPLE SELECTION · DESIGN PREVIEW" : "YOUR FIRST DISCOVERIES"}</Text>
      <Text accessibilityRole="header" style={[type.title, s.title]}>A little more you.</Text>
      <Text style={type.bodySoft}>Good things happen when you follow your curiosity.</Text>
    </View>
    <Arrival>
      <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Watch ${hero.title}, ${hero.creator}${minutes(hero) ? `, ${minutes(hero)}` : ""}`} onPress={() => onWatch(hero.id)} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }, s.hero]}>
        <View style={[s.artwork, { backgroundColor: palette.surfaceDeep }]}>
          <Image source={hero.image} contentFit="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
          <View style={[s.play, { backgroundColor: palette.accentDeep, borderColor: palette.onDark }]}><Play size={19} color={palette.onDark} fill={palette.onDark} strokeWidth={1.5} /></View>
          {minutes(hero) ? <View style={[s.duration, { backgroundColor: palette.programme }]}><Text style={[type.caption, { color: palette.onProgramme }]}>{minutes(hero)}</Text></View> : null}
        </View>
        <View style={s.heroCopy}>
          <Text style={[type.caption, { color: palette.active }]}>{hero.interest ? `For your interest in ${hero.interest}` : "Start here"}</Text>
          <Text style={[type.heading, s.filmTitle]}>{hero.title}</Text>
          <Text style={type.caption}>{hero.creator}</Text>
        </View>
      </Pressable>
      {hero.reason ? <Text style={[type.bodySoft, s.reason]}>{hero.reason}</Text> : null}
    </Arrival>
    {rest.length > 0 && <View style={s.more}>
      {rest.map((item, index) => <Arrival key={item.id} delay={motion.confirm + index * 80}>
        <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Watch ${item.title}, ${item.creator}`} onPress={() => onWatch(item.id)} style={({ pressed }) => [s.row, { borderTopColor: palette.borderSoft, backgroundColor: pressed ? palette.activeSoft : "transparent" }]}>
          <Image source={item.image} contentFit="cover" style={[s.thumb, { backgroundColor: palette.surfaceDeep }]} />
          <View style={s.rowCopy}><Text style={type.label} numberOfLines={2}>{item.title}</Text><Text style={type.caption}>{item.creator}{minutes(item) ? ` · ${minutes(item)}` : ""}</Text></View>
          <Play size={16} color={palette.active} strokeWidth={1.5} />
        </Pressable>
      </Arrival>)}
    </View>}
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 24 }, heading: { gap: 8 }, title: { fontSize: 34, lineHeight: 40 },
  hero: { gap: 16 }, artwork: { aspectRatio: 16 / 9, overflow: "hidden", borderRadius: 8, borderCurve: "continuous" },
  play: { position: "absolute", left: 16, bottom: 16, width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingLeft: 2 },
  duration: { position: "absolute", bottom: 16, right: 16, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  heroCopy: { gap: 4 }, filmTitle: { fontSize: 23, lineHeight: 29 }, reason: { marginTop: 12 },
  more: { gap: 0 }, row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 80 },
  thumb: { width: 88, aspectRatio: 16 / 9, borderRadius: 4 }, rowCopy: { flex: 1, gap: 4 },
});
