import { useEffect, useRef } from "react";
import { Animated, AppState, Easing, type ViewProps } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/constants/motion";

type Props = ViewProps & { changeKey?: string | number | boolean; enter?: boolean; duration?: number; distance?: number; active?: boolean; onPresented?(): void };
/** Animate only the current content. Never retain a previous screen or delay an action. */
export default function MotionView({ changeKey, enter = false, duration = motion.state, distance = 0, active = true, onPresented, style, ...props }: Props) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const previous = useRef(changeKey);
  const first = useRef(true);
  const enterOnMount = useRef(enter);
  const callback = useRef(onPresented); callback.current = onPresented;
  useEffect(() => {
    const changed = previous.current !== changeKey;
    const entering = first.current && enterOnMount.current;
    first.current = false; previous.current = changeKey;
    progress.stopAnimation(); progress.setValue(1);
    if ((!changed && !entering) || !active) return;
    callback.current?.();
    if (reduced || AppState.currentState !== "active") return;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start();
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") { animation.stop(); progress.setValue(1); } });
    return () => { animation.stop(); listener.remove(); progress.setValue(1); };
  }, [active, changeKey, duration, distance, progress, reduced]);
  return <Animated.View {...props} style={[style, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : distance, 0] }) }] }]} />;
}
