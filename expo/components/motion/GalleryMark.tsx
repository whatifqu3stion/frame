import { Animated, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";

export default function GalleryMark({ color, complete = false, enter = false, onPresented }: {
  color: string; complete?: boolean; enter?: boolean; onPresented?(): void;
}) {
  const { progress, reduced } = usePresentationProgress({ enter: enter && complete, duration: motion.ending, nativeDriver: false, onPresented });
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
    <Animated.View style={{ transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 1.18, 1] }) }] }}><Svg width={64} height={76} viewBox="0 0 64 76">
      <Path d="M22 5H5V25 M42 5H59V25 M5 51V71H22 M42 71H59V51" stroke={color} strokeWidth={1.2} fill="none" />
    </Svg></Animated.View>
  </View>;
}
