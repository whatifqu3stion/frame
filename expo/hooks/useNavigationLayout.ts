import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { expandedNavigationWidth } from "@/constants/layout";

/** Keep floating navigation and screen clearance in step at larger text sizes. */
export function useNavigationLayout() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sidebar = width >= expandedNavigationWidth + 208 * Math.max(0, fontScale - 1);
  const bottomInset = Math.max(insets.bottom, 8);
  const bottomBarHeight = sidebar ? 0 : 64 + Math.max(0, fontScale - 1) * 48 + bottomInset;
  return { sidebar, fontScale, bottomInset, bottomBarHeight };
}
