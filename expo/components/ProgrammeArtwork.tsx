import { Animated, StyleSheet, View } from "react-native";
import MediaImage from "@/components/MediaImage";
import { usePresentationProgress } from "@/hooks/usePresentationProgress";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { motion } from "@/constants/motion";
import { radii, spacing } from "@/constants/theme";

type Artwork = { id: string; thumbnailUrl?: string };
/** The programme's own artwork, in queue order. Missing metadata never invents a cover. */
export default function ProgrammeArtwork({ videos, enter = false, editorial = false }: { videos: (Artwork | undefined)[]; enter?: boolean; editorial?: boolean }) {
  const artwork = videos.filter((video): video is Artwork => Boolean(video?.thumbnailUrl)).slice(0, 3);
  if (!artwork.length) return null;
  if (editorial) return <View style={styles.collage} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={artwork.length > 1 ? styles.lead : styles.solo}>
      <ProgrammePrint video={artwork[0]} index={0} enter={enter} editorial />
    </View>
    {artwork.length > 1 ? <View style={[styles.companions, artwork.length === 2 && styles.oneCompanion]}>
      {artwork.slice(1).map((video, index) => <ProgrammePrint key={video.id} video={video} index={index + 1} enter={enter} editorial />)}
    </View> : null}
  </View>;
  return <View style={styles.strip} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {artwork.map((video, index) => <ProgrammePrint key={video.id} video={video} index={index} enter={enter} />)}
  </View>;
}
function ProgrammePrint({ video, index, enter, editorial = false }: { video: Artwork; index: number; enter: boolean; editorial?: boolean }) {
  const { palette } = useFrameTheme();
  const { progress, reduced } = usePresentationProgress({ enter, duration: motion.artwork + index * 70 });
  return <Animated.View style={[styles.print, editorial && styles.editorialPrint, { backgroundColor: palette.mount, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced || editorial ? 1 : 0.96, 1] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [editorial && !reduced ? (index + 1) * 4 : 0, 0] }) }] }]}>
    <MediaImage source={{ uri: video.thumbnailUrl! }} style={styles.image} contentFit="cover" cachePolicy="none" />
  </Animated.View>;
}
const styles = StyleSheet.create({
  strip: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg, overflow: "hidden" },
  print: { flex: 1, maxWidth: 184, padding: 3, borderRadius: radii.mount },
  image: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.media },
  collage: { marginBottom: spacing.lg },
  lead: { width: "84%", flexDirection: "row" },
  solo: { width: "100%", flexDirection: "row" },
  companions: { width: "78%", alignSelf: "flex-end", flexDirection: "row", gap: 12, marginTop: 12 },
  oneCompanion: { width: "48%" },
  editorialPrint: { maxWidth: "100%", padding: 2, boxShadow: [{ offsetX: 0, offsetY: 3, blurRadius: 8, color: "rgba(0, 0, 0, 0.24)" }] },
});
