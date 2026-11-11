import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { watchPalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useRoomDarkness } from "@/providers/RoomLightingProvider";

/** The room changes light behind the film. Media, text and controls stay opaque. */
export default function ViewingRoom({ children }: PropsWithChildren) {
  const { isDark } = useFrameTheme();
  const roomDarkness = useRoomDarkness();
  const lightStyle = useAnimatedStyle(() => ({ opacity: roomDarkness?.get() ?? 1 }));
  return <View style={{ flex: 1, backgroundColor: isDark ? watchPalette.darkLitWall : watchPalette.litWall }} testID="viewing-room">
    <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="viewing-room-light" style={[StyleSheet.absoluteFill, { backgroundColor: watchPalette.wall }, lightStyle]} />
    {children}
  </View>;
}
