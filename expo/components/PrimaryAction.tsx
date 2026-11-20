import { Pressable, type PressableProps, type ViewStyle } from "react-native";

import ProgrammeGrain from "@/components/ProgrammeGrain";

type Props = PressableProps & { textured?: boolean; keepAppearance?: boolean; depth: ViewStyle | false | undefined };

/** The edge belongs to an available primary action and settles during the press. */
export default function PrimaryAction({ depth, textured, keepAppearance, children, style, disabled, accessibilityState, ...props }: Props) {
  const showFinish = keepAppearance || (!disabled && !accessibilityState?.disabled && !accessibilityState?.busy);
  return <Pressable
    accessibilityRole="button"
    {...props}
    disabled={disabled}
    accessibilityState={accessibilityState}
    style={(state) => [
      typeof style === "function" ? style(state) : style,
      !state.pressed && showFinish && depth,
    ]}
  >
    {textured && showFinish
      ? (state) => <><ProgrammeGrain finish="button" />{typeof children === "function" ? children(state) : children}</>
      : children}
  </Pressable>;
}
