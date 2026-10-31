import type { ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import MediaMount from "@/components/MediaMount";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** The first print opens inside its matte while its source caption settles. */
export default function PersonalizedPreview({ image, children, animate, onPresented }: { image: ReactNode; children: ReactNode; animate: boolean; onPresented(): void }) {
  const { palette } = useFrameTheme();
  const { progress, reduced } = usePresentationProgress({ enter: animate, deferEntrance: true, duration: motion.reveal, onPresented });
  return <View>
    <MediaMount><View style={styles.image}>
      <Animated.View style={{ transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 1.08, 1] }) }] }}>{image}</Animated.View>
      <Animated.View accessible={false} pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.mount, opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.86, 0, 0] }), transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : 80] }) }] }]} />
    </View></MediaMount>
    <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 0.6, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 12, 0] }) }] }}>{children}</Animated.View>
  </View>;
}
const styles = StyleSheet.create({ image: { overflow: "hidden", borderRadius: radii.media } });
