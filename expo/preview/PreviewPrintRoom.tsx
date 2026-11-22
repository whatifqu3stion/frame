import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { CuratingSelection } from "@/components/motion/CuratingSelection";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useReducedMotionPreference } from "@/hooks/useReducedMotion";
import type { DiscoveryStage } from "@/services/byokWeeklyPicks";

const rehearsal: DiscoveryStage[] = ["suggestions", "verification", "sample", "review", "save"];

export default function PreviewPrintRoom({ onReady }: { onReady(): void }) {
  const [position, setPosition] = useState(0);
  const ready = useRef(onReady);
  ready.current = onReady;
  const visible = useMotionVisibility();
  const reduced = useReducedMotionPreference();
  const { type } = useFrameTheme();
  useEffect(() => {
    if (!visible || reduced === null) return;
    if (reduced || position >= rehearsal.length) { ready.current(); return; }
    const timer = setTimeout(() => setPosition((value) => value + 1), position === rehearsal.length - 1 ? 480 : 650);
    return () => clearTimeout(timer);
  }, [visible, reduced, position]);
  return <View style={{ gap: spacing.sm }}>
    <CuratingSelection stage={rehearsal[Math.min(position, rehearsal.length - 1)]} />
    <Text style={type.caption}>Sample search · no AI requests</Text>
  </View>;
}
