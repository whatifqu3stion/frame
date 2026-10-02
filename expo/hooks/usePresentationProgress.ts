import { useLayoutEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { createPresentationGate } from "@/domain/motionContinuity";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/constants/motion";

type Options = { changeKey?: string | number | boolean; enter?: boolean; deferEntrance?: boolean; active?: boolean; duration?: number; nativeDriver?: boolean; onPresented?(): void };
/** Visible by default, immediate under Reduce Motion, and settled when interrupted. */
export function usePresentationProgress({ changeKey, enter = false, deferEntrance = false, active = true, duration = motion.state, nativeDriver = true, onPresented }: Options) {
  const visible = useMotionVisibility() && active;
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const gate = useRef(createPresentationGate(changeKey, enter, deferEntrance)).current;
  const callback = useRef(onPresented); callback.current = onPresented;
  useLayoutEffect(() => {
    progress.stopAnimation(); progress.setValue(1);
    if (!gate.update(changeKey, visible)) return;
    callback.current?.();
    if (reduced) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver, isInteraction: false });
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
  }, [changeKey, duration, gate, nativeDriver, progress, reduced, visible]);
  return { progress, reduced };
}
