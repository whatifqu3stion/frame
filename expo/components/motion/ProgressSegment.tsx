import { useIsFocused } from "@react-navigation/native";
import { useEffect, useRef } from "react";
import { Animated, AppState, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";

/** Setup progress resolves in place, including Back; no invented waiting. */
export default function ProgressSegment({ complete }: { complete: boolean }) {
  const { palette } = useFrameTheme();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const opacity = useRef(new Animated.Value(complete ? 1 : 0)).current;
  useEffect(() => {
    const target = complete ? 1 : 0;
    opacity.stopAnimation();
    if (reduced || !focused || AppState.currentState !== "active") { opacity.setValue(target); return; }
    const animation = Animated.timing(opacity, { toValue: target, duration: motion.choice, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start();
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") { animation.stop(); opacity.setValue(target); } });
    return () => { animation.stop(); listener.remove(); opacity.setValue(target); };
  }, [complete, focused, opacity, reduced]);
  return <View accessible={false} style={[styles.track, { backgroundColor: palette.borderSoft }]}>
    <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.active, opacity }]} />
  </View>;
}
const styles = StyleSheet.create({ track: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" } });
