import { useCallback, useLayoutEffect, useRef } from "react";
import { cancelAnimation, Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming, type WithTimingConfig } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useReducedMotionPreference } from "@/hooks/useReducedMotion";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";

const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const studyComparisonEase = Easing.inOut(Easing.quad);

/** Retain elapsed reading time across interruptions, including the opening delay. */
export function useStudyReveal(firstVisit: boolean, duration: number, delay = 0, easing: WithTimingConfig["easing"] = easeOut, onComplete?: () => void) {
  const reduced = useReducedMotionPreference();
  const visible = useMotionVisibility();
  const total = delay + duration;
  const elapsed = useSharedValue(firstVisit && reduced !== true ? 0 : total);
  const generation = useRef(0);
  const notified = useRef(false);
  const callback = useRef(onComplete);
  useLayoutEffect(() => { callback.current = onComplete; }, [onComplete]);
  const complete = useCallback((version: number) => {
    if (generation.current !== version || notified.current) return;
    notified.current = true;
    callback.current?.();
  }, []);
  const curve = typeof easing === "function" ? easing : easing?.factory() ?? Easing.linear;
  const progress = useDerivedValue(() => {
    const fraction = duration <= 0 ? 1 : Math.min(1, Math.max(0, (elapsed.value - delay) / duration));
    return curve(fraction);
  });
  useLayoutEffect(() => {
    const lifecycle = generation;
    const version = ++lifecycle.current;
    if (reduced !== null) {
      if (!firstVisit || reduced) elapsed.value = total;
      if (visible) {
        if (elapsed.value >= total) complete(version);
        else elapsed.value = withTiming(total, {
          duration: Math.max(0, total - elapsed.value), easing: Easing.linear, reduceMotion: ReduceMotion.Never,
        }, finished => { if (finished) scheduleOnRN(complete, version); });
      }
    }
    return () => { ++lifecycle.current; cancelAnimation(elapsed); };
  }, [complete, elapsed, firstVisit, reduced, total, visible]);
  return progress;
}
