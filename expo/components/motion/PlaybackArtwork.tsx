import { StyleSheet, View } from "react-native";
import MediaImage from "@/components/MediaImage";

/** Carry the chosen poster into the loading stage. Never cover a ready player. */
export default function PlaybackArtwork({ uri }: { uri?: string }) {
  if (!uri) return null;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
    <MediaImage source={{ uri }} style={[StyleSheet.absoluteFillObject, { opacity: 0.35 }]} contentFit="cover" transition={0} cachePolicy="none" />
  </View>;
}
