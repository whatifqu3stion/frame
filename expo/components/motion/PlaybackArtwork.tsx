import { Animated, StyleSheet, View } from "react-native";
import MediaImage from "@/components/MediaImage";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";

/** Carry the chosen poster into the loading stage. Never cover a ready player. */
export default function PlaybackArtwork({ uri }: { uri?: string }) {
  const { progress, reduced } = usePresentationProgress({ enter: true, duration: motion.artwork });
  if (!uri) return null;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: 0.35, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 1.06, 1] }) }] }]}><MediaImage source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="none" /></Animated.View>
  </View>;
}
