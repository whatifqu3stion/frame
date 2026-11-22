import { Animated } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useMotionTarget } from "@/hooks/useMotionTarget";
import { motion } from "@/constants/motion";

/** A quiet hinge: retarget from the current angle and settle immediately offscreen. */
export default function DisclosureIndicator({ expanded, color, size = 17 }: { expanded: boolean; color: string; size?: number }) {
  const progress = useMotionTarget(expanded ? 1 : 0, motion.state);
  return <Animated.View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ width: size, height: size, transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}><ChevronDown size={size} color={color} /></Animated.View>;
}
