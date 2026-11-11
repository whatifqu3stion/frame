import { Play } from "lucide-react-native";
import { View } from "react-native";
import type { ComponentProps, ReactNode } from "react";
import PrimaryAction from "@/components/PrimaryAction";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { primaryActionDepth } from "@/constants/theme";
import { controlTransition, useControlFeedback } from "@/hooks/useControlFeedback";

type Props = Omit<ComponentProps<typeof PrimaryAction>, "depth" | "children"> & {
  programme?: boolean; children: ReactNode;
};

export default function PlaybackAction({ programme, style, children, disabled, accessibilityState, ...props }: Props) {
  const { palette, accent } = useFrameTheme();
  const feedback = useControlFeedback(programme ? palette.onProgramme : palette.active);
  const available = !disabled && !accessibilityState?.busy && !accessibilityState?.disabled;
  const face = programme ? palette.onProgramme : palette.accentDeep;
  const icon = programme ? palette.programme : palette.onDark;
  const hot = (pressed: boolean) => available && (feedback.highlighted || pressed);
  return <PrimaryAction {...props} {...feedback.events} disabled={disabled} accessibilityState={accessibilityState}
    depth={programme ? primaryActionDepth(true, accent) : palette.primaryButtonDepth}
    style={(state) => [
      typeof style === "function" ? style(state) : style,
      !feedback.reduced && controlTransition,
      { backgroundColor: hot(state.pressed) ? (programme ? palette.onDark : lightenFace(face)) : face },
      available && feedback.ring,
      available && state.pressed && !feedback.reduced && { transform: [{ translateY: 1 }] },
    ]}>
    {({ pressed }) => <>
      <View style={[!feedback.reduced && controlTransition, !feedback.reduced && { transform: [{ translateX: hot(pressed) ? 2 : 0 }] }]}>
        <Play size={16} color={icon} fill={icon} />
      </View>
      {children}
    </>}
  </PrimaryAction>;
}

function lightenFace(hex: string) {
  const rgb = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(value + (255 - value) * 0.07);
  });
  return `rgb(${rgb.join(",")})`;
}
