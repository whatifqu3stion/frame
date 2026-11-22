import { useFeedback } from "@/hooks/useFeedback";
import GlassPlayMark from "@/components/GlassPlayMark";
import { posterForTopic } from "@/constants/onboardingPosters";
import { PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import { isPreviewVideo } from "@/preview/library";
import { useControlFeedback } from "@/hooks/useControlFeedback";
import { useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, findNodeHandle, Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import Reanimated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ArrowRight } from "lucide-react-native";
import Text, { type FrameTextRef } from "@/components/FrameText";
import MediaImage from "@/components/MediaImage";
import { PrintWindow } from "@/components/motion/PersonalizedPreview";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { isPointerActivation } from "@/components/motion/pointerActivation";
import { motion } from "@/constants/motion";
import MotionView from "@/components/motion/MotionView";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { interestTopicFromId } from "@/domain/interests";
import { formatDuration } from "@/services/youtube";
import type { WeeklyPickSourceSuggestion } from "@/types";

type GalleryProps = {
  items: WeeklyPickSourceSuggestion[];
  featuredId?: string;
  onBrowse(): void;
  busy: boolean;
  animate: boolean;
  onPresented(): void;
  isFollowed(pick: WeeklyPickSourceSuggestion): boolean;
  onFollow(pick: WeeklyPickSourceSuggestion): void;
  onWatch(pick: WeeklyPickSourceSuggestion): void;
};

export default function PickGallery({ items, featuredId, onBrowse, busy, animate, onPresented, isFollowed, onFollow, onWatch }: GalleryProps) {
  const { palette, type } = useFrameTheme();
  const feedback = useFeedback();
  const posterControl = useControlFeedback(palette.active);
  const [selection, setSelection] = useState<{ id: string; revision: number; companion: boolean; pointer: boolean } | null>(null);
  const { progress, reduced } = usePresentationProgress({ enter: animate, active: !selection, deferEntrance: true, duration: motion.galleryArrival, onPresented });
  const visible = useMotionVisibility();
  const revision = useRef(0);
  const pendingLoad = useRef<number | null>(null);
  const settle = useSharedValue(1);
  const watch = useRef<View>(null);
  const heading = useRef<FrameTextRef>(null);
  const lead = items.find((pick) => pick.providerSourceId === selection?.id) ?? items[0];
  const playable = Boolean(lead?.featuredMedia && lead.fetchedAt);
  useLayoutEffect(() => () => {
    pendingLoad.current = null;
    cancelAnimation(settle);
    settle.set(1);
  }, [reduced, visible, settle]);
  useLayoutEffect(() => {
    if (!selection?.companion || selection.pointer) return;
    const target = playable ? watch.current : heading.current;
    if (!target) return;
    target.focus();
    if (Platform.OS !== "web") {
      const tag = findNodeHandle(target);
      if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
    }
  }, [selection, playable]);
  const artworkStyle = useAnimatedStyle(() => {
    const remaining = 1 - settle.get();
    return {
      opacity: reduced ? 1 - 0.15 * remaining : 1,
      transform: [{ scale: reduced ? 1 : 1 + 0.025 * remaining }],
    };
  }, [reduced]);
  if (!lead) return null;
  const companions = items.filter((pick) => pick.providerSourceId !== lead.providerSourceId);
  const title = (pick: WeeklyPickSourceSuggestion) => pick.featuredMedia?.title ?? pick.displayName;
  const print = (pick: WeeklyPickSourceSuggestion, featured = false) => {
    const uri = pick.featuredMedia?.thumbnailUrl ?? pick.thumbnailUrl;
    const poster = posterForTopic(pick.interestId);
    const sample = PREVIEW_LIBRARY_ENABLED && isPreviewVideo(pick.featuredMedia?.providerMediaId ?? "");
    const promotion = featured && selection?.companion && selection.id === pick.providerSourceId ? selection.revision : null;
    const startWhenReady = () => {
      if (promotion === null || pendingLoad.current !== promotion) return;
      pendingLoad.current = null;
      settle.set(withTiming(1, {
        duration: reduced ? 100 : motion.state,
        easing: Easing.out(Easing.cubic),
        reduceMotion: reduced ? ReduceMotion.Never : ReduceMotion.System,
      }));
    };
    return <MediaImage key={featured ? selection?.revision ?? 0 : pick.providerSourceId} source={sample || !uri ? poster : { uri }}
      onLoad={promotion !== null ? startWhenReady : undefined} transition={promotion !== null ? 0 : undefined}
      fallbackSource={poster} style={{ width: "100%", aspectRatio: 16 / 9 }} contentFit="cover" cachePolicy="none" />;
  };
  const followed = isFollowed(lead);
  const topic = interestTopicFromId(lead.interestId)?.name;
  const hasFeature = lead.providerSourceId === featuredId;
  const framedPrint = <PrintWindow progress={progress} reduced={reduced} curtainColor={palette.programme}
    image={<><Reanimated.View style={artworkStyle}>{print(lead, true)}</Reanimated.View>{playable && <GlassPlayMark label="Watch" />}</>} />;
  const browse = (pick: WeeklyPickSourceSuggestion, event: GestureResponderEvent, companion: boolean) => {
    if (pick.providerSourceId === lead.providerSourceId || busy) return;
    const pointer = isPointerActivation(event);
    const next = ++revision.current;
    const promote = companion && pointer && visible;
    pendingLoad.current = promote ? next : null;
    cancelAnimation(settle);
    settle.set(promote ? 0 : 1);
    setSelection({ id: pick.providerSourceId, revision: next, companion, pointer });
    feedback.selection();
    onBrowse();
  };
  return <View style={styles.gallery}>
    <View style={styles.header}>
      <Text style={type.title} accessibilityRole="header">Picked for you.</Text>
      {items.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel="Next pick" disabled={busy} accessibilityState={{ disabled: busy }}
        onPress={event => browse(items[(items.indexOf(lead) + 1) % items.length], event, false)} style={styles.next}>
        <Text style={[type.label, { color: palette.active }]}>Next pick</Text><ArrowRight size={16} color={palette.active} />
      </Pressable>}
    </View>
    <View style={styles.stage}>
      <Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFillObject, {
        backgroundColor: palette.programme,
        opacity: progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 0.35, 0] }),
      }]} />
      <Animated.View style={{ transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 10, 0] }) }] }}>
        {playable ? <Pressable ref={watch} {...posterControl.events} accessibilityRole="button" accessibilityLabel={`Watch ${title(lead)}`}
          disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => onWatch(lead)}
          style={({ pressed }) => [styles.playable, !busy && posterControl.ring, (pressed || posterControl.highlighted) && { borderColor: palette.active }]}>
          {framedPrint}
        </Pressable> : framedPrint}
      </Animated.View>
    </View>
    <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 0.26, 1], outputRange: [0.65, 0.7, 1] }) }}>
      <MotionView changeKey={lead.providerSourceId} active={selection?.pointer ?? true} distance={3} style={styles.caption}>
        {hasFeature && <Text style={[type.label, { color: palette.active }]}>Featured pick</Text>}
        <Text ref={heading} {...(!playable && Platform.OS === "web" ? { tabIndex: -1 } as const : {})} style={[type.heading, styles.title]} accessibilityRole="header" accessibilityLiveRegion="polite">{title(lead)}</Text>
        <Text style={type.bodySoft}>{lead.displayName}{lead.featuredMedia?.durationSeconds ? ` · ${formatDuration(lead.featuredMedia.durationSeconds)}` : ""}</Text>
        {(topic || lead.recommendationReason) && <View style={[styles.reason, { borderColor: palette.borderSoft }]}>
          <Text style={[type.label, styles.match, { color: palette.active }]}>{topic ? `Because you chose ${topic}` : "Why this pick"}</Text>
          {lead.recommendationReason && <Text style={[type.body, styles.explanation]}>{lead.recommendationReason}</Text>}
        </View>}
      </MotionView>
    </Animated.View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${followed ? "Following" : "Follow"} ${lead.displayName}`} disabled={busy || followed} accessibilityState={{ disabled: busy || followed }} onPress={() => onFollow(lead)} style={styles.follow}><Text style={[type.label, { color: followed ? palette.inkMuted : palette.active }]}>{followed ? "Following" : "Follow creator"}</Text></Pressable>
    </View>
    {companions.length > 0 && <View style={[styles.companions, { borderColor: palette.borderSoft }]}>
      <Text style={type.heading} accessibilityRole="header">Also in your selection</Text>
      <View style={styles.shelf}>
        {companions.map((pick) => <Pressable key={pick.providerSourceId} accessibilityRole="button" accessibilityLabel={`Bring forward: ${title(pick)}`}
          disabled={busy} accessibilityState={{ disabled: busy }} onPress={event => browse(pick, event, true)}
          style={({ pressed }) => [styles.companion, { opacity: pressed ? 0.75 : 1 }]}>
          <View style={[styles.smallPrint, { backgroundColor: palette.mount, borderColor: palette.mountEdge }]}>{print(pick)}</View>
          <Text style={[type.label, styles.companionTitle]}>{title(pick)}</Text>
        </Pressable>)}
      </View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  gallery: { gap: spacing.md },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: spacing.md },
  next: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44 },
  stage: { alignSelf: "center", width: "100%", maxWidth: 510, padding: spacing.xs, borderRadius: radii.mount },
  playable: { borderRadius: radii.mount, borderWidth: 1, borderColor: "transparent" },
  caption: { gap: spacing.xs },
  title: { fontSize: 25, lineHeight: 32 },
  reason: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs },
  match: { fontSize: 15, lineHeight: 21 },
  explanation: { fontSize: 16, lineHeight: 23, maxWidth: 520 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
  follow: { minHeight: 48, justifyContent: "center" },
  companions: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  shelf: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  companion: { flexGrow: 1, flexBasis: "42%", maxWidth: "48%", minHeight: 48, gap: spacing.xs },
  smallPrint: { padding: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.mount },
  companionTitle: { fontSize: 15, lineHeight: 20 },
});
