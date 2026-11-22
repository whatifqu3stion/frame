import Text from "@/components/FrameText";
import { Platform, type TextProps } from "react-native";

/** Native heading semantics with an explicit document level in the web preview. */
export default function Heading({ level = 2, ...props }: TextProps & { level?: 1 | 2 | 3 }) {
  return <Text {...props} accessibilityRole="header" {...(Platform.OS === "web" ? { "aria-level": level } : {})} />;
}
