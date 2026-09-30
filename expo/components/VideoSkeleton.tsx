import { memo, useMemo } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import MediaMount from "@/components/MediaMount";
import { radii, spacing, type FramePalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type SkeletonVariant = "full" | "wide" | "source";

type VideoFeedSkeletonProps = {
  count?: number;
  variant?: SkeletonVariant;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

function VideoSkeletonCard({ variant, palette }: { variant: SkeletonVariant; palette: FramePalette }) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  if (variant === "source") return <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, minHeight: 80, marginBottom: spacing.sm }}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.surfaceDeep }} /><View style={{ flex: 1, gap: spacing.sm }}><View style={[styles.bar, { width: "70%" }]} /><View style={[styles.bar, { width: "45%" }]} /></View></View>;
  if (variant === "full") {
    return (
      <View style={styles.fullCard}>
        <MediaMount><View style={styles.fullThumbnail} /></MediaMount>
        <View style={styles.fullMeta}>
          <View style={[styles.bar, styles.eyebrowBar]} />
          <View style={[styles.bar, styles.fullTitleBar]} />
          <View style={[styles.bar, styles.fullTitleShortBar]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wideCard}>
      <View style={styles.wideThumbnail} />
      <View style={styles.wideMeta}>
        <View style={[styles.bar, styles.eyebrowBar]} />
        <View style={[styles.bar, styles.wideTitleBar]} />
        <View style={[styles.bar, styles.wideTitleShortBar]} />
      </View>
    </View>
  );
}

/** Layout-matched loading placeholders for video feeds. */
export const VideoFeedSkeleton = memo(function VideoFeedSkeleton({
  count = 4,
  variant = "wide",
  style,
  accessibilityLabel = "Loading videos",
}: VideoFeedSkeletonProps) {
  const { palette } = useFrameTheme();
  const items = useMemo<number[]>(() => Array.from({ length: count }, (_, index) => index), [count]);

  return (
    <View
      style={style}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      pointerEvents="none"
    >
      <View style={{ opacity: 0.72 }}>
        {items.map((item) => <VideoSkeletonCard key={item} variant={variant} palette={palette} />)}
      </View>
    </View>
  );
});

/** Still placeholder displayed until an individual thumbnail finishes loading. */
export const ThumbnailSkeleton = memo(function ThumbnailSkeleton() {
  const { palette } = useFrameTheme();

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.surfaceDim, opacity: 0.72 }]}
    />
  );
});

function createStyles(palette: FramePalette) {
  const skeletonColor = palette.surfaceDeep;
  return StyleSheet.create({
    bar: { height: 10, backgroundColor: skeletonColor, borderRadius: radii.pill },
    eyebrowBar: { width: "34%", height: 8 },
    fullCard: { width: "100%", marginBottom: spacing.xl },
    fullThumbnail: {
      width: "100%",
      aspectRatio: 16 / 9,
      backgroundColor: skeletonColor,
      borderRadius: radii.media,
    },
    fullMeta: { marginTop: spacing.md, paddingRight: spacing.xl, gap: spacing.sm },
    fullTitleBar: { width: "88%", height: 16 },
    fullTitleShortBar: { width: "58%", height: 16 },
    wideCard: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg, minHeight: 82 },
    wideThumbnail: {
      width: 142,
      aspectRatio: 16 / 9,
      backgroundColor: skeletonColor,
      borderRadius: radii.control,
      borderWidth: 1,
      borderColor: palette.borderSoft,
    },
    wideMeta: { flex: 1, paddingTop: 2, gap: spacing.sm },
    wideTitleBar: { width: "94%", height: 12 },
    wideTitleShortBar: { width: "68%", height: 12 },
  });
}

