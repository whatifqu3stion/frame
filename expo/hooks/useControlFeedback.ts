import { useState } from "react";
import { Platform, type PressableProps, type ViewStyle } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Pointer, keyboard and native press share the same highlighted surface. */
export function useControlFeedback(ringColor: string) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const events: Pick<PressableProps, "onHoverIn" | "onHoverOut" | "onFocus" | "onBlur"> = {
    onHoverIn: () => setHovered(true),
    onHoverOut: () => setHovered(false),
    onFocus: (event) => setFocused(Platform.OS !== "web" || (event.currentTarget as unknown as HTMLElement).matches(":focus-visible")),
    onBlur: () => setFocused(false),
  };
  const ring: ViewStyle | undefined = focused
    ? { outlineWidth: 2, outlineColor: ringColor, outlineStyle: "solid", outlineOffset: 3 }
    : undefined;
  return { events, highlighted: hovered || focused, ring, reduced };
}

// React Native Web forwards these CSS properties. Native presses respond immediately.
export const controlTransition = Platform.OS === "web" ? {
  transitionProperty: "background-color, transform, box-shadow",
  transitionDuration: "150ms",
  transitionTimingFunction: "cubic-bezier(0.2,0.75,0.25,1)",
} as ViewStyle : undefined;
