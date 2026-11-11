import { useLayoutEffect } from "react";
import { AppState } from "react-native";
import { cancelAnimation, Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { motion } from "@/constants/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

function changeLight(darkness: SharedValue<number>, watching: boolean, immediate: boolean) {
  "worklet";
  cancelAnimation(darkness);
  const target = watching ? 1 : 0;
  const remaining = Math.abs(target - darkness.get());
  if (immediate || remaining === 0) {
    darkness.set(target);
    return;
  }
  darkness.set(withTiming(target, {
    duration: watching ? motion.roomDim * remaining : motion.roomRestore,
    easing: watching ? Easing.bezier(0.30, 0, 0.35, 1) : Easing.out(Easing.cubic),
  }));
}

export function useRoomLighting(watching: boolean) {
  const darkness = useSharedValue(watching ? 1 : 0);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    scheduleOnUI(changeLight, darkness, watching, reduced || AppState.currentState !== "active");
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") scheduleOnUI(changeLight, darkness, watching, true);
    });
    return () => {
      subscription.remove();
      cancelAnimation(darkness);
    };
  }, [darkness, reduced, watching]);
  return darkness;
}
