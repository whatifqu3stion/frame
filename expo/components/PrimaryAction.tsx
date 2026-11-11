import { Pressable, type PressableProps, type ViewStyle } from "react-native";

type Props = PressableProps & { depth: ViewStyle | false | undefined };

/** The edge belongs to an available primary action and settles during the press. */
export default function PrimaryAction({ depth, style, disabled, accessibilityState, ...props }: Props) {
  return <Pressable
    accessibilityRole="button"
    {...props}
    disabled={disabled}
    accessibilityState={accessibilityState}
    style={(state) => [
      typeof style === "function" ? style(state) : style,
      !state.pressed && !disabled && !accessibilityState?.disabled && !accessibilityState?.busy && depth,
    ]}
  />;
}
