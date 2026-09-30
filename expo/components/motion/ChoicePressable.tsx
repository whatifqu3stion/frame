import { forwardRef, useEffect, useRef } from "react";
import { Animated, AppState, Easing, Pressable, StyleSheet, type PressableProps, type View } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/constants/motion";

// Web augments this state with hovered; native only requires pressed.
const restingState = { pressed: false, hovered: false };

/** Only selection backing/border moves; labels and geometry remain stable. */
export default forwardRef<View, PressableProps>(function ChoicePressable({ style, accessibilityState, children, ...props }, ref) {
  const reduced = useReducedMotion();
  const selected = accessibilityState?.selected ?? accessibilityState?.checked;
  const resolved = StyleSheet.flatten(typeof style === "function" ? style(restingState) : style) ?? {};
  const background = typeof resolved.backgroundColor === "string" ? resolved.backgroundColor : "transparent";
  const border = typeof resolved.borderColor === "string" ? resolved.borderColor : "transparent";
  const value = useRef(new Animated.Value(1)).current;
  const previous = useRef({ selected, background, border });
  const from = useRef({ background, border });
  const changed = previous.current.selected !== selected;
  if (changed) from.current = { background: previous.current.background, border: previous.current.border };
  useEffect(() => {
    const didChange = previous.current.selected !== selected;
    previous.current = { selected, background, border };
    value.stopAnimation(); value.setValue(1);
    if (!didChange || reduced || AppState.currentState !== "active") return;
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration: motion.choice, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false });
    animation.start();
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") { animation.stop(); value.setValue(1); } });
    return () => { animation.stop(); listener.remove(); value.setValue(1); };
  }, [background, border, reduced, selected, value]);
  return <Pressable {...props} ref={ref} accessibilityState={accessibilityState} style={(state) => [typeof style === "function" ? style(state) : style, !state.pressed && selected !== undefined && { backgroundColor: "transparent", borderColor: "transparent" }]}>
    {(state) => <>
      {selected !== undefined && !state.pressed ? <Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFillObject, { borderRadius: resolved.borderRadius, borderWidth: resolved.borderWidth, backgroundColor: value.interpolate({ inputRange: [0, 1], outputRange: [from.current.background, background] }), borderColor: value.interpolate({ inputRange: [0, 1], outputRange: [from.current.border, border] }) }]} /> : null}
      {typeof children === "function" ? children(state) : children}
    </>}
  </Pressable>;
});
