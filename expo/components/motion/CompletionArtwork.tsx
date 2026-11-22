import { Animated, StyleSheet, View } from "react-native";
import MediaImage from "@/components/MediaImage";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";
import { radii, spacing } from "@/constants/theme";

/** The watched artwork becomes a finished print; the closing actions are never delayed. */
export default function CompletionArtwork({ uri }: { uri?: string }) {
  const { palette } = useFrameTheme();
  const { progress, reduced } = usePresentationProgress({ enter: true, duration: motion.ending });
  if (!uri) return null;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.space}>
    <Animated.View style={[styles.mount, { backgroundColor: palette.mount, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 1.14, 1] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : -10, 0] }) }] }]}>
      <MediaImage source={{ uri }} style={styles.image} contentFit="cover" cachePolicy="none" />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({ space: { width: "100%", maxWidth: 208, alignSelf: "center", padding: 12, marginBottom: spacing.sm }, mount: { padding: 6, borderRadius: radii.mount }, image: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.media } });
