import type { ReactNode } from "react";
import { useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import MediaMount from "@/components/MediaMount";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** The first print opens inside its matte while its source caption settles. */
export default function PersonalizedPreview({ image, children, animate, onPresented }: { image: ReactNode; children: ReactNode; animate: boolean; onPresented(): void }) {
  const { progress, reduced } = usePresentationProgress({ enter: animate, deferEntrance: true, duration: motion.reveal, onPresented });
  return <View>
    <PrintWindow image={image} progress={progress} reduced={reduced} />
    <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 0.6, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 12, 0] }) }] }}>{children}</Animated.View>
  </View>;
}

export function PrintWindow({ image, progress, reduced, curtainColor }: { image: ReactNode; progress: Animated.Value; reduced: boolean; curtainColor?: string }) {
  const { palette } = useFrameTheme();
  const [width, setWidth] = useState(0);
  return <MediaMount><View style={styles.image} onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      {image}
      {!reduced ? <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, styles.leaves]}>
        {[-1, 1].map((direction) => <Animated.View key={direction} style={{ flex: 1, backgroundColor: curtainColor ?? palette.mount, opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.82, 0.3, 0] }), transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, direction * width / 2] }) }] }} />)}
      </View> : null}
    </View></MediaMount>;
}
const styles = StyleSheet.create({ image: { overflow: "hidden", borderRadius: radii.media }, leaves: { flexDirection: "row" } });
