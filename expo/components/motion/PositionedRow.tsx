import { useLayoutEffect, useRef } from "react";
import { Animated, type ViewProps } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { continuingRowOffset } from "@/domain/motionContinuity";
import { motionSpring } from "@/constants/motion";

type Props = ViewProps & { transitionKey: string };
/** Move surviving rows from their current visual position; never retain outgoing content. */
export default function PositionedRow({ transitionKey, style, onLayout, ...props }: Props) {
  const reduced = useReducedMotion();
  const visible = useMotionVisibility();
  const enabled = visible && !reduced;
  const previous = useRef<{ y: number; key: string } | null>(null);
  const generation = useRef(0);
  const allowed = useRef(enabled); allowed.current = enabled;
  const y = useRef(new Animated.Value(0)).current;
  useLayoutEffect(() => {
    if (!enabled) { generation.current += 1; y.stopAnimation(); y.setValue(0); }
    return () => { generation.current += 1; y.stopAnimation(); y.setValue(0); };
  }, [enabled, y]);
  return <Animated.View {...props} style={[style, { transform: [{ translateY: enabled ? y : 0 }] }]} onLayout={(event) => {
    const next = event.nativeEvent.layout.y;
    const before = previous.current;
    previous.current = { y: next, key: transitionKey };
    if (before && before.y === next) { onLayout?.(event); return; }
    const ticket = ++generation.current;
    if (enabled && before && before.key !== transitionKey) {
      y.stopAnimation((offset) => {
        if (ticket !== generation.current || !allowed.current) return;
        y.setValue(continuingRowOffset(before.y, next, offset));
        Animated.spring(y, { toValue: 0, ...motionSpring, overshootClamping: true, useNativeDriver: true, isInteraction: false }).start();
      });
    } else { y.stopAnimation(); y.setValue(0); }
    onLayout?.(event);
  }} />;
}
