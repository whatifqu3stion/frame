import type { ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import MediaMount from "@/components/MediaMount";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** The matte stays still as its real image clears and the source context settles. */
export default function PersonalizedPreview({ image, children, animate, onPresented }: { image: ReactNode; children: ReactNode; animate: boolean; onPresented(): void }) {
  const { palette } = useFrameTheme();
  const { progress, reduced } = usePresentationProgress({ enter: animate, deferEntrance: true, duration: motion.reveal, onPresented });
  return <View>
    <MediaMount><View style={styles.image}>
      {image}
      <Animated.View accessible={false} pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.mount, opacity: progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0.18, 0, 0] }) }]} />
    </View></MediaMount>
    <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.72, 0.72, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 3, 0] }) }] }}>{children}</Animated.View>
  </View>;
}
const styles = StyleSheet.create({ image: { overflow: "hidden", borderRadius: radii.media } });
