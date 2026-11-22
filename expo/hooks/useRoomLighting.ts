import { useLayoutEffect } from "react";
import { AppState } from "react-native";
import { cancelAnimation, Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { motion } from "@/constants/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type RoomPhase = "outside" | "watching" | "finished";

function changeLight(darkness: SharedValue<number>, phase: RoomPhase, immediate: boolean) {
  "worklet";
  cancelAnimation(darkness);
  const target = phase === "watching" ? 1 : 0;
  const remaining = Math.abs(target - darkness.get());
  if (immediate || remaining === 0) {
    darkness.set(target);
    return;
  }
  darkness.set(withTiming(target, {
    duration: phase === "outside" ? motion.roomRestore : remaining * (phase === "finished" ? motion.roomRise : motion.roomDim),
    easing: phase === "outside" ? Easing.out(Easing.cubic)
      : phase === "finished" ? Easing.bezier(0.65, 0, 0.70, 1) : Easing.bezier(0.30, 0, 0.35, 1),
  }));
}

export function useRoomLighting(watching: boolean, finished = false, enabled = true) {
  const phase: RoomPhase = !watching || !enabled ? "outside" : finished ? "finished" : "watching";
  const darkness = useSharedValue(phase === "watching" ? 1 : 0);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    scheduleOnUI(changeLight, darkness, phase, !enabled || reduced || AppState.currentState !== "active");
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") scheduleOnUI(changeLight, darkness, phase, true);
    });
    return () => {
      subscription.remove();
      cancelAnimation(darkness);
    };
  }, [darkness, enabled, phase, reduced]);
  return darkness;
}
