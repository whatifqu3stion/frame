import { Animated, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import AnimatedPath from "@/components/motion/AnimatedStroke";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";

/** An open frame at first use; a drawn check closes the day's viewing ritual. */
export default function GalleryMark({ color, complete = false, enter = false, onPresented }: {
  color: string; complete?: boolean; enter?: boolean; onPresented?(): void;
}) {
  const { progress, reduced } = usePresentationProgress({ enter: enter && complete, duration: motion.ending, nativeDriver: false, onPresented });
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
    <Animated.View style={{ transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 1.18, 1] }) }] }}><Svg width={64} height={76} viewBox="0 0 64 76">
      <Path d="M22 5H5V25 M42 5H59V25 M5 51V71H22 M42 71H59V51" stroke={color} strokeWidth={1.2} fill="none" />
      {complete ? <AnimatedPath d="M20 38L29 47L45 28" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="38 38" strokeDashoffset={progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [38, 38, 0] })} /> : null}
    </Svg></Animated.View>
  </View>;
}
