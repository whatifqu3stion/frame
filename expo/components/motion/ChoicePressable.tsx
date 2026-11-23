import { forwardRef, useRef } from "react";
import { Platform, Animated, Pressable, StyleSheet, type PressableProps, type View } from "react-native";
import { useMotionTarget } from "@/hooks/useMotionTarget";
import { motion } from "@/constants/motion";

// Web augments this state with hovered; native only requires pressed.
const restingState = { pressed: false, hovered: false };

/** Only selection backing/border moves; labels and geometry remain stable. */
export default forwardRef<View, PressableProps>(function ChoicePressable({ style, accessibilityState, children, ...props }, ref) {
  const selected = accessibilityState?.selected ?? accessibilityState?.checked;
  const resolved = StyleSheet.flatten(typeof style === "function" ? style(restingState) : style) ?? {};
  const background = typeof resolved.backgroundColor === "string" ? resolved.backgroundColor : "transparent";
  const border = typeof resolved.borderColor === "string" ? resolved.borderColor : "transparent";
  const progress = useMotionTarget(selected ? 1 : 0, motion.choice, false);
  const colors = useRef({ on: { background, border }, off: { background, border } });
  // Keep both state endpoints stable so quick reversals continue from the
  // current blend. The newly resolved style also refreshes its theme colors.
  colors.current[selected ? "on" : "off"] = { background, border };
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.current.off.background, colors.current.on.background] });
  const outline = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.current.off.border, colors.current.on.border] });
  return <Pressable android_disableSound={Platform.isTV} aria-selected={accessibilityState?.selected} aria-expanded={accessibilityState?.expanded} aria-checked={accessibilityState?.checked} aria-busy={accessibilityState?.busy} {...props} ref={ref} accessibilityState={accessibilityState} style={(state) => [typeof style === "function" ? style(state) : style, !Platform.isTV && !state.pressed && selected !== undefined && { backgroundColor: "transparent", borderColor: "transparent" }]}>
    {(state) => <>
      {!Platform.isTV && selected !== undefined && !state.pressed ? <Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFillObject, { borderRadius: resolved.borderRadius, borderWidth: resolved.borderWidth, backgroundColor: fill, borderColor: outline }]} /> : null}
      {typeof children === "function" ? children(state) : children}
    </>}
  </Pressable>;
});
