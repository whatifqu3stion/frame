import type { PropsWithChildren } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { watchPalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useArtworkTransition } from "@/providers/ArtworkTransitionProvider";

/** The room changes light behind the film. Media, text and controls stay opaque. */
export default function ViewingRoom({ children }: PropsWithChildren) {
  const { isDark } = useFrameTheme();
  const { roomDarkness } = useArtworkTransition();
  return <View style={{ flex: 1, backgroundColor: isDark ? watchPalette.darkLitWall : watchPalette.litWall }} testID="viewing-room">
    <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="viewing-room-light" style={[StyleSheet.absoluteFill, { backgroundColor: watchPalette.wall, opacity: roomDarkness }]} />
    {children}
  </View>;
}
