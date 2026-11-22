import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Keyboard, Platform, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const idleMs = 6000;
const intervalMs = 12000;

export function useOnboardingIdleCue(step: string, ready: boolean) {
  const visible = useMotionVisibility();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);
  const restart = useRef<() => void>(() => {});
  const onActivity = useCallback(() => restart.current(), []);
  useLayoutEffect(() => {
    setShown(false);
    if (!ready || reduced || !visible) return;
    let timer: ReturnType<typeof setTimeout>;
    let typing = Keyboard.isVisible();
    const reset = () => {
      clearTimeout(timer);
      setShown(false);
      if (!typing) timer = setTimeout(() => setShown(true), idleMs);
    };
    restart.current = reset;
    reset();
    const show = Keyboard.addListener("keyboardDidShow", () => { typing = true; reset(); });
    const hide = Keyboard.addListener("keyboardDidHide", () => { typing = false; reset(); });
    if (Platform.OS === "web") {
      document.addEventListener("keydown", reset, true);
      document.addEventListener("scroll", reset, true);
      document.addEventListener("input", reset, true);
      document.addEventListener("pointerdown", reset, true);
    }
    return () => {
      restart.current = () => {};
      clearTimeout(timer);
      show.remove(); hide.remove();
      if (Platform.OS === "web") {
        document.removeEventListener("keydown", reset, true);
        document.removeEventListener("scroll", reset, true);
        document.removeEventListener("input", reset, true);
        document.removeEventListener("pointerdown", reset, true);
      }
    };
  }, [step, ready, reduced, visible]);
  return { showCue: shown && ready && visible && !reduced, onActivity };
}

// The highlight crosses the control in 780ms, then rests outside its clip.
const sweep = {
  from: { transform: [{ translateX: "-100%" }] },
  "6.5%": { transform: [{ translateX: "100%" }] },
  to: { transform: [{ translateX: "100%" }] },
} as const;

export default function OnboardingGlimmer({ quiet = false }: { quiet?: boolean }) {
  const { palette } = useFrameTheme();
  return <View aria-hidden accessible={false} pointerEvents="none" importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, { overflow: "hidden", borderRadius: radii.control, borderCurve: "continuous" }]}>
    <Animated.View testID="onboarding-idle-glimmer" style={[StyleSheet.absoluteFill, { opacity: quiet ? 0.13 : 0.21,
      animationName: sweep, animationDuration: intervalMs, animationTimingFunction: "linear", animationIterationCount: "infinite" }]}>
      <LinearGradient colors={["transparent", quiet ? palette.active : "#ffffff", "transparent"]} locations={[0.28, 0.5, 0.72]}
        start={{ x: 0, y: 0.7 }} end={{ x: 1, y: 0.3 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  </View>;
}
