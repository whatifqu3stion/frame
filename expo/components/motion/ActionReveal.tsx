import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { motion } from "@/constants/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Keep the same surface during a reversal; input follows intent, not the fade. */
export default function ActionReveal({ open, instant, offset = 0, children }: {
  open: boolean; instant: boolean; offset?: number; children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [retained, setRetained] = useState(open);
  const revision = useRef(0);
  const progress = useSharedValue(open && instant ? 1 : 0);
  const release = useCallback((version: number) => {
    if (version === revision.current) setRetained(false);
  }, []);

  useLayoutEffect(() => {
    const lifecycle = revision;
    const version = ++lifecycle.current;
    if (open) setRetained(true);
    if (instant) {
      progress.value = open ? 1 : 0;
      if (!open) setRetained(false);
    } else {
      progress.value = withTiming(open ? 1 : 0, {
        duration: reduced ? 100 : motion.choice,
        easing: Easing.out(Easing.cubic),
        // The reduced variant is itself a brief, displacement-free fade.
        reduceMotion: ReduceMotion.Never,
      }, finished => {
        if (finished && !open) scheduleOnRN(release, version);
      });
    }
    return () => { ++lifecycle.current; cancelAnimation(progress); };
  }, [open, instant, reduced, progress, release]);

  const style = useAnimatedStyle(() => {
    const remaining = 1 - progress.value;
    return {
      opacity: instant ? 1 : 1 - remaining * (reduced ? 0.15 : 0.35),
      transform: [{ translateY: instant || reduced ? 0 : offset * remaining }],
    };
  }, [instant, reduced, offset]);
  if (!open && (!retained || instant)) return null;
  return <Animated.View style={style} pointerEvents={open ? "auto" : "none"}
    aria-hidden={!open} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
    {children}
  </Animated.View>;
}
