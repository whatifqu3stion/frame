import { Check } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import Text from "@/components/FrameText";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const READ_TIME = 4_000;

export default function CollectionNotice({ message, actionLabel, onDismiss, onOpen }: {
  message: string; actionLabel: string; onDismiss(): void; onOpen(): void;
}) {
  const { palette, type } = useFrameTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const engaged = hovered || focused || pressed;

  useEffect(() => {
    opacity.setValue(1);
    if (engaged) return;
    let current = true;
    let timeout: ReturnType<typeof setTimeout>;
    let fade: Animated.CompositeAnimation | undefined;
    const schedule = (milliseconds: number) => {
      if (!current) return;
      timeout = setTimeout(() => {
        if (reducedMotion) { onDismiss(); return; }
        fade = Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: Platform.OS !== "web" });
        fade.start(({ finished }) => { if (finished && current) onDismiss(); });
      }, milliseconds);
    };
    if (Platform.OS === "android") {
      void AccessibilityInfo.getRecommendedTimeoutMillis(READ_TIME)
        .then((ms) => schedule(Math.max(READ_TIME, ms)), () => schedule(READ_TIME));
    } else schedule(READ_TIME);
    return () => { current = false; clearTimeout(timeout); fade?.stop(); };
  }, [engaged, onDismiss, opacity, reducedMotion]);

  useEffect(() => {
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return <Animated.View style={[styles.wrap, { opacity }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${message}. ${actionLabel}`}
      onPress={onOpen} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
      style={({ pressed: down }) => [styles.notice, { backgroundColor: down ? palette.surfaceDeep : palette.surfaceHigh, borderColor: palette.border }]}>
      <Check size={15} strokeWidth={1.8} color={palette.success} />
      <Text accessibilityLiveRegion="polite" role="status" style={[type.label, styles.text]}>{message}</Text>
      <View style={[styles.divider, { backgroundColor: palette.borderSoft }]} />
      <Text style={[type.label, styles.text, { color: palette.active }]}>{actionLabel}</Text>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center", maxWidth: "100%" },
  notice: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth },
  divider: { width: 1, height: 14, marginHorizontal: 2 },
  text: { flexShrink: 1 },
});
