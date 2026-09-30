import { useIsFocused } from "@react-navigation/native";
import { useEffect, useRef } from "react";
import { Animated, AppState, Easing } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/constants/motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A single drawn check for a first-save milestone. Text and actions never wait. */
export default function CompletionMark({ color, animate = true }: { color: string; animate?: boolean }) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const first = useRef(true);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const enter = first.current && animate;
    first.current = false;
    progress.stopAnimation(); progress.setValue(1);
    if (!enter || reduced || !focused || AppState.currentState !== "active") return;
    progress.setValue(0);
    // SVG stroke is JS-driven, bounded to one tiny mark for 400 ms; never loops.
    const animation = Animated.timing(progress, { toValue: 1, duration: motion.reveal, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false });
    animation.start();
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") { animation.stop(); progress.setValue(1); } });
    return () => { animation.stop(); listener.remove(); progress.setValue(1); };
  }, [animate, focused, progress, reduced]);
  return <Svg width={28} height={28} viewBox="0 0 24 24" accessible={false} pointerEvents="none">
    <AnimatedPath d="M5 12L9 16L19 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="24 24" strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })} />
  </Svg>;
}
