import { useLayoutEffect, useRef, useState, type PropsWithChildren } from "react";
import { Animated, AppState, Easing, View } from "react-native";
import { FrameAppearanceContext } from "@/constants/useFrameTheme";
import { createPalette } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useApp } from "@/providers/AppProvider";

/** Change the lighting of one live interface; never duplicate controls or reset drafts. */
export default function ThemeTransitionProvider({ children }: PropsWithChildren) {
  const { prefs, ready } = useApp();
  const target = { theme: prefs.theme, accent: prefs.accent };
  const [shown, setShown] = useState(target);
  const current = useRef(shown);
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useLayoutEffect(() => {
    let cancelled = false;
    opacity.stopAnimation();
    const next = { theme: prefs.theme, accent: prefs.accent };
    const settle = () => { current.current = next; setShown(next); opacity.setValue(1); };
    const changed = current.current.theme !== next.theme || current.current.accent !== next.accent;
    if (!changed || !ready || reduced || AppState.currentState !== "active") settle();
    else Animated.timing(opacity, { toValue: current.current.theme === next.theme ? 0.72 : 0.35, duration: 110, useNativeDriver: true, isInteraction: false }).start(({ finished }) => {
      if (!finished || cancelled) return;
      current.current = next; setShown(next);
      requestAnimationFrame(() => {
        if (!cancelled) Animated.timing(opacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }).start();
      });
    });
    const subscription = AppState.addEventListener("change", () => { opacity.stopAnimation(); settle(); });
    return () => { cancelled = true; subscription.remove(); opacity.stopAnimation(); };
  }, [opacity, prefs.theme, prefs.accent, ready, reduced]);
  return <FrameAppearanceContext.Provider value={shown}><View style={{ flex: 1, backgroundColor: createPalette(prefs.theme === "ink", prefs.accent).wall }}><Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View></View></FrameAppearanceContext.Provider>;
}
