import { forwardRef } from "react";
import { Animated, Platform } from "react-native";
import { Path, type PathProps } from "react-native-svg";

// Animated injects this native view flag. A web SVG path must not receive it.
const Stroke = forwardRef<Path, PathProps & { collapsable?: boolean }>(function Stroke({ collapsable, ...props }, ref) {
  return <Path {...props} {...(Platform.OS === "web" ? {} : { collapsable })} ref={ref} />;
});
export default Animated.createAnimatedComponent(Stroke);
