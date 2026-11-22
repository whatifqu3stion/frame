import { Animated, type ViewProps } from "react-native";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { motion } from "@/constants/motion";

type Props = ViewProps & { changeKey?: string | number | boolean; enter?: boolean; duration?: number; distance?: number; fromScale?: number; active?: boolean; onPresented?(): void };
/** Animate only the current content. Never retain a previous screen or delay an action. */
export default function MotionView({ changeKey, enter = false, duration = motion.state, distance = 0, fromScale = 1, active = true, onPresented, style, ...props }: Props) {
  const { progress, reduced } = usePresentationProgress({ changeKey, enter, duration, active, onPresented });
  return <Animated.View {...props} style={[style, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : distance, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : fromScale, 1] }) }] }]} />;
}
