import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { radii, spacing, type FramePalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type SkeletonVariant = "full" | "wide";

type VideoFeedSkeletonProps = {
  count?: number;
  variant?: SkeletonVariant;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

function usePulseAnimation(): Animated.Value {
  const opacity = useRef<Animated.Value>(new Animated.Value(0.52)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled: boolean) => {
      if (isMounted) setIsReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setIsReduceMotionEnabled);
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    animation.current?.stop();
    if (isReduceMotionEnabled) {
      opacity.setValue(0.72);
      return;
    }

    animation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.92,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.52,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.current.start();
    return () => animation.current?.stop();
  }, [isReduceMotionEnabled, opacity]);

  return opacity;
}

function VideoSkeletonCard({ variant, palette }: { variant: SkeletonVariant; palette: FramePalette }) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  if (variant === "full") {
    return (
      <View style={styles.fullCard}>
        <View style={styles.fullThumbnail} />
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
  const opacity = usePulseAnimation();
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
      <Animated.View style={{ opacity }}>
        {items.map((item) => <VideoSkeletonCard key={item} variant={variant} palette={palette} />)}
      </Animated.View>
    </View>
  );
});

/** Animated placeholder displayed until an individual thumbnail finishes loading. */
export const ThumbnailSkeleton = memo(function ThumbnailSkeleton() {
  const { palette } = useFrameTheme();
  const opacity = usePulseAnimation();

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.surfaceDim, opacity }]}
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
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: palette.borderSoft,
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
