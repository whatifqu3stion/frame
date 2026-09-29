import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** A matte surround for featured media; its inset is outside the video's aspect ratio. */
export default function MediaMount({ children }: { children: ReactNode }) {
  const { palette } = useFrameTheme();
  return <View style={[styles.mount, { backgroundColor: palette.mount, borderColor: palette.mountEdge }]}>{children}</View>;
}
const styles = StyleSheet.create({
  mount: { padding: 8, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth },
});
