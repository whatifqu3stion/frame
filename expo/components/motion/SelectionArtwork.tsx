import type { ReactNode } from "react";
import { Animated } from "react-native";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";

/** A confirmed choice seats the artwork in its mount; no animation before success. */
export default function SelectionArtwork({ selected, children }: { selected: boolean; children: ReactNode }) {
  const { progress, reduced } = usePresentationProgress({ changeKey: selected, active: selected, duration: motion.confirm });
  return <Animated.View style={{ transform: [{ scale: progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: reduced ? [1, 1, 1] : [0.94, 1.01, 1] }) }] }}>{children}</Animated.View>;
}
