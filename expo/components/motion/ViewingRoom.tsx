import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import { watchPalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useRoomDarkness } from "@/providers/RoomLightingProvider";

/** The room changes light behind the film. Media, text and controls stay opaque. */
export default function ViewingRoom({ children }: PropsWithChildren) {
  const roomDarkness = useRoomDarkness();
  return <ViewingRoomSurface darkness={roomDarkness}>{children}</ViewingRoomSurface>;
}

export function ViewingRoomSurface({ children, darkness }: PropsWithChildren<{ darkness: SharedValue<number> | null }>) {
  const { isDark } = useFrameTheme();
  const lightStyle = useAnimatedStyle(() => ({ opacity: darkness?.get() ?? 1 }));
  return <View style={{ flex: 1, backgroundColor: isDark ? watchPalette.darkLitWall : watchPalette.litWall }} testID="viewing-room">
    <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="viewing-room-light" style={[StyleSheet.absoluteFill, { backgroundColor: watchPalette.wall }, lightStyle]} />
    <ProgrammeGrain finish="wall" />
    {children}
  </View>;
}
