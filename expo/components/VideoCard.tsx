import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { ThumbnailSkeleton } from "@/components/VideoSkeleton";
import { formatDuration, formatRelativeDate } from "@/services/youtube";
import type { Video } from "@/types";

type Props = { video: Video; variant?: "full" | "compact" | "wide"; progressSeconds?: number };

function VideoCard({ video, variant = "full", progressSeconds }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const navigationLocked = useRef<boolean>(false);
  const [isThumbnailLoading, setIsThumbnailLoading] = useState<boolean>(true);
  const progressFraction = progressSeconds && video.durationSeconds ? Math.min(1, Math.max(0, progressSeconds / video.durationSeconds)) : 0;
  const accessibilityLabel = `Play ${video.title}${video.channelTitle ? ` by ${video.channelTitle}` : ""}`;
  const dateLabel = formatRelativeDate(video.publishedAt);

  useEffect(() => {
    setIsThumbnailLoading(true);
  }, [video.thumbnailUrl]);

  const onPress = useCallback((): void => {
    if (navigationLocked.current) return;
    navigationLocked.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: "/watch/[id]", params: { id: video.id, title: video.title, channelId: video.channelId, channelTitle: video.channelTitle, thumbnailUrl: video.thumbnailUrl, publishedAt: video.publishedAt, durationSeconds: String(video.durationSeconds) } });
    setTimeout(() => { navigationLocked.current = false; }, 800);
  }, [video]);

  const thumbnail = (wrapStyle: object, imageStyle: object) => (
    <View style={wrapStyle}>
      <Image
        source={{ uri: video.thumbnailUrl }}
        style={imageStyle}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={video.id}
        transition={160}
        onLoadStart={() => setIsThumbnailLoading(true)}
        onLoad={() => setIsThumbnailLoading(false)}
        onError={() => setIsThumbnailLoading(false)}
      />
      {isThumbnailLoading ? <ThumbnailSkeleton /> : null}
      {!isThumbnailLoading && video.durationSeconds > 0 ? <View style={styles.durationBadge}><Text style={styles.durationText}>{formatDuration(video.durationSeconds)}</Text></View> : null}
      {!isThumbnailLoading && progressFraction > 0 ? <View style={styles.progressTrack} accessibilityLabel={`${Math.round(progressFraction * 100)} percent watched`}><View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} /></View> : null}
    </View>
  );

  if (variant === "compact") return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.compactRoot, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
      {thumbnail(styles.compactThumbWrap, styles.thumb)}
      <View style={styles.compactMeta}>
        {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
        <Text style={styles.compactTitle} numberOfLines={2}>{video.title}</Text>
        {dateLabel ? <Text style={[type.caption, styles.date]}>{dateLabel}</Text> : null}
      </View>
    </Pressable>
  );

  if (variant === "wide") return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wideRoot, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
      {thumbnail(styles.wideThumbWrap, styles.thumb)}
      <View style={styles.wideMeta}>
        {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
        <Text style={styles.wideTitle} numberOfLines={3}>{video.title}</Text>
        {dateLabel ? <Text style={[type.caption, styles.date]}>{dateLabel}</Text> : null}
      </View>
    </Pressable>
  );

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fullRoot, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
      {thumbnail(styles.fullThumbWrap, styles.thumb)}
      <View style={styles.fullMeta}>
        {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
        <Text style={styles.fullTitle} numberOfLines={3}>{video.title}</Text>
        {dateLabel ? <Text style={[type.caption, styles.date]}>{dateLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    fullRoot: { width: "100%", marginBottom: spacing.xl },
    fullThumbWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden", borderRadius: radii.card, position: "relative", borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    fullMeta: { marginTop: spacing.md, paddingRight: spacing.xl },
    fullTitle: { ...type.heading, marginTop: spacing.xs, fontSize: 22, lineHeight: 29 },
    compactRoot: { width: 264, marginRight: spacing.lg },
    compactThumbWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden", borderRadius: radii.card, position: "relative", borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    compactMeta: { marginTop: spacing.md, paddingHorizontal: spacing.xs },
    compactTitle: { ...type.heading, fontSize: 16, lineHeight: 21, marginTop: spacing.xs },
    wideRoot: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg, alignItems: "flex-start", minHeight: 82 },
    wideThumbWrap: { width: 142, aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden", borderRadius: radii.control, position: "relative", borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    thumb: { width: "100%", height: "100%" },
    wideMeta: { flex: 1, paddingRight: spacing.sm, paddingTop: 1 },
    wideTitle: { ...type.heading, fontSize: 15, lineHeight: 20, marginTop: spacing.xs },
    date: { marginTop: spacing.sm },
    durationBadge: { position: "absolute", right: spacing.sm, bottom: spacing.sm, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: "rgba(20,18,16,0.82)", borderRadius: 6 },
    durationText: { color: "#F7F1E7", fontFamily: "HankenGrotesk_600SemiBold", fontSize: 10, letterSpacing: 0.8 },
    progressTrack: { position: "absolute", left: 8, right: 8, bottom: 6, height: 3, borderRadius: radii.pill, backgroundColor: "rgba(247,241,231,0.3)", overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: palette.active },
    pressed: { opacity: 0.76, transform: [{ scale: 0.987 }] },
  });
}

export default memo(VideoCard);
