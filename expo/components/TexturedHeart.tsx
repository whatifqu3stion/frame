import { useId } from "react";
import { View } from "react-native";
import Svg, { ClipPath, Defs, Image, Path } from "react-native-svg";
import { useFrameTheme } from "@/constants/useFrameTheme";

const heart = "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z";

/** Frame's printed-ink finish, clipped to a decorative heart. */
export default function TexturedHeart({ size = 56 }: { size?: number }) {
  const { palette } = useFrameTheme();
  const clipId = `heart-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs><ClipPath id={clipId}><Path d={heart} /></ClipPath></Defs>
      <Path d={heart} fill={palette.accentDeep} />
      <Image href={require("../assets/textures/panel-ink.png")} x={-9} y={-9} width={42} height={42}
        preserveAspectRatio="xMidYMid slice" opacity={0.65} clipPath={`url(#${clipId})`} />
    </Svg>
  </View>;
}
