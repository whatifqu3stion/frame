import { useEffect, useRef } from "react";
import { Animated, AppState, Easing, type ViewProps } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/constants/motion";

type Props = ViewProps & { transitionKey: string };
/** Move surviving rows only; never retain outgoing content or animate unrelated reflow. */
export default function PositionedRow({ transitionKey, style, onLayout, ...props }: Props) {
  const reduced = useReducedMotion();
  const previous = useRef<{ y: number; key: string } | null>(null);
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const reset = () => { y.stopAnimation(); y.setValue(0); };
    if (reduced) reset();
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") reset(); });
    return () => { listener.remove(); reset(); };
  }, [reduced, y]);
  return <Animated.View {...props} style={[style, { transform: [{ translateY: reduced ? 0 : y }] }]} onLayout={(event) => {
    const next = event.nativeEvent.layout.y;
    const before = previous.current;
    previous.current = { y: next, key: transitionKey };
    y.stopAnimation(); y.setValue(0);
    if (!reduced && AppState.currentState === "active" && before && before.key !== transitionKey && before.y !== next) {
      y.setValue(before.y - next);
      Animated.timing(y, { toValue: 0, duration: motion.reorder, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }).start();
    }
    onLayout?.(event);
  }} />;
}
