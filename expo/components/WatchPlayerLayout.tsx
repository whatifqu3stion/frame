import { useLayoutEffect, type ReactNode } from "react";
import { useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, View } from "react-native";
import { spacing, watchPalette } from "@/constants/theme";

type Props = {
  width: number;
  height: number;
  insets: { top: number; right: number; bottom: number; left: number };
  fullscreen: boolean;
  chrome: ReactNode;
  landscapeControls: ReactNode;
  details: ReactNode;
  children: ReactNode;
};

const RAIL_WIDTH = 64;

export default function WatchPlayerLayout({ width, height, insets, fullscreen, chrome, landscapeControls, details, children }: Props) {
  const navigation = useNavigation();
  const landscape = width > height && (Platform.OS !== "web" || width < 900);
  const edgeToEdge = fullscreen || (Platform.OS === "android" && landscape);
  const showRail = landscape && !edgeToEdge;
  const availableWidth = Math.max(160, width - insets.left - insets.right - RAIL_WIDTH - spacing.sm);
  const availableHeight = Math.max(90, height - insets.top - insets.bottom);
  const playerHeight = landscape ? Math.min(availableHeight, availableWidth * 9 / 16) : Math.max(180, Math.min(width * 9 / 16, height * 0.52));
  const playerWidth = Math.min(landscape ? availableWidth : width, playerHeight * 16 / 9);

  useLayoutEffect(() => {
    navigation.setOptions({ navigationBarHidden: edgeToEdge });
  }, [edgeToEdge, navigation]);
  useLayoutEffect(() => () => {
    navigation.setOptions({ navigationBarHidden: false });
  }, [navigation]);

  return <View style={styles.screen} testID="watch-layout">
    <StatusBar style="light" hidden={edgeToEdge} />
    <View style={(landscape || edgeToEdge) && styles.hidden}>{chrome}</View>
    <View testID="watch-player-area" style={edgeToEdge ? styles.fullscreenArea : landscape ? [styles.landscapeArea, { paddingTop: insets.top, paddingRight: insets.right + spacing.sm, paddingBottom: insets.bottom, paddingLeft: insets.left + RAIL_WIDTH }] : [styles.portraitArea, { height: playerHeight }]}>
      <View testID="watch-player-frame" style={edgeToEdge ? styles.fullscreenFrame : { width: playerWidth, height: playerHeight }}>{children}</View>
      <View style={showRail ? [styles.rail, { top: insets.top, bottom: insets.bottom, left: insets.left }] : styles.hidden}>{landscapeControls}</View>
    </View>
    <View style={landscape || edgeToEdge ? styles.hidden : styles.details}>{details}</View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hidden: { display: "none" },
  fullscreenArea: { flex: 1, backgroundColor: watchPalette.stage },
  fullscreenFrame: { flex: 1, width: "100%" },
  portraitArea: { width: "100%", alignItems: "center", backgroundColor: watchPalette.stage },
  landscapeArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  rail: { position: "absolute", width: RAIL_WIDTH, alignItems: "center", paddingTop: spacing.sm },
  details: { flex: 1 },
});
