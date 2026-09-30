import { useEffect, useRef, type ReactNode } from "react";
import { Animated, AppState, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";

/** The tab stays fixed while its selected backing quietly resolves. */
export default function TabIconSurface({ focused, children }: { focused: boolean; children: ReactNode }) {
  const { palette } = useFrameTheme();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    const target = focused ? 1 : 0;
    opacity.stopAnimation();
    if (reduced || AppState.currentState !== "active") { opacity.setValue(target); return; }
    const animation = Animated.timing(opacity, { toValue: target, duration: motion.choice, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start();
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") { animation.stop(); opacity.setValue(target); } });
    return () => { animation.stop(); listener.remove(); opacity.setValue(target); };
  }, [focused, opacity, reduced]);
  return <View style={styles.icon}>
    <Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFillObject, styles.backing, { backgroundColor: palette.activeSoft, opacity }]} />
    {children}
  </View>;
}
const styles = StyleSheet.create({ icon: { width: 44, height: 28, alignItems: "center", justifyContent: "center" }, backing: { borderRadius: 14 } });
