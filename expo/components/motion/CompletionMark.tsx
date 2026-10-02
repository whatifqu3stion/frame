import { Animated } from "react-native";
import Svg, { Path } from "react-native-svg";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A single drawn check for a first-save milestone. Text and actions never wait. */
export default function CompletionMark({ color, animate = true }: { color: string; animate?: boolean }) {
  // SVG stroke is JS-driven, bounded to one tiny mark; never loops.
  const { progress } = usePresentationProgress({ enter: animate, duration: motion.reveal, nativeDriver: false });
  return <Svg width={28} height={28} viewBox="0 0 24 24" accessible={false} pointerEvents="none">
    <AnimatedPath d="M5 12L9 16L19 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="24 24" strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })} />
  </Svg>;
}
