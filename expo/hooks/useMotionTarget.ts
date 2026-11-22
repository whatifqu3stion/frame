import { useLayoutEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/constants/motion";

/** Retarget from the current value; settle when hidden or motion is reduced. */
export function useMotionTarget(target: number, duration: number = motion.state, nativeDriver = true) {
  const value = useRef(new Animated.Value(target)).current;
  const visible = useMotionVisibility();
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    value.stopAnimation();
    if (!visible || reduced || duration === 0) { value.setValue(target); return; }
    const animation = Animated.timing(value, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [duration, nativeDriver, reduced, target, value, visible]);
  return value;
}
