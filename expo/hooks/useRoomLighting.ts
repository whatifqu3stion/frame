import { useLayoutEffect, useRef } from "react";
import { Animated, AppState, Easing, Platform } from "react-native";
import { motion } from "@/constants/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** One lighting change per visit; interrupted navigation continues from its current light. */
export function useRoomLighting(watching: boolean) {
  const darkness = useRef(new Animated.Value(watching ? 1 : 0)).current;
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const target = watching ? 1 : 0;
    darkness.stopAnimation();
    const settle = () => { darkness.stopAnimation(); darkness.setValue(target); };
    if (reduced || AppState.currentState !== "active") settle();
    else Animated.timing(darkness, { toValue: target, duration: watching ? motion.artwork : motion.artworkReturn, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web", isInteraction: false }).start();
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") settle(); });
    return () => { subscription.remove(); darkness.stopAnimation(); };
  }, [darkness, reduced, watching]);
  return darkness;
}
