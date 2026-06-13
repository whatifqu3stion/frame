import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Video } from "@/types";
import { palette, spacing, type } from "@/constants/theme";
import { formatDuration, formatRelativeDate } from "@/services/youtube";

type Props = {
  video: Video;
  variant?: "full" | "compact" | "wide";
  progressSeconds?: number;
};

export default function VideoCard({ video, variant = "full", progressSeconds }: Props) {
  const onPress = () => router.push({ pathname: "/watch/[id]", params: { id: video.id } });

  if (variant === "compact") {
    const progressFraction = progressSeconds && video.durationSeconds
      ? Math.min(1, progressSeconds / video.durationSeconds)
      : 0;
    return (
      <Pressable onPress={onPress} style={styles.compactRoot} testID={`video-card-${video.id}`}>
        <View style={styles.compactThumbWrap}>
          <Image source={{ uri: video.thumbnailUrl }} style={styles.compactThumb} contentFit="cover" transition={200} />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.durationSeconds)}</Text>
          </View>
          {progressFraction > 0 && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
            </View>
          )}
        </View>
        <View style={styles.compactMeta}>
          <Text style={type.caption} numberOfLines={1}>
            {video.channelTitle}
          </Text>
          <Text style={[styles.compactTitle]} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={[type.caption, { marginTop: spacing.xs }]}>{formatRelativeDate(video.publishedAt)}</Text>
        </View>
      </Pressable>
    );
  }

  if (variant === "wide") {
    return (
      <Pressable onPress={onPress} style={styles.wideRoot} testID={`video-card-${video.id}`}>
        <View style={styles.wideThumbWrap}>
          <Image source={{ uri: video.thumbnailUrl }} style={styles.wideThumb} contentFit="cover" transition={200} />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.durationSeconds)}</Text>
          </View>
        </View>
        <View style={styles.wideMeta}>
          <Text style={type.caption} numberOfLines={1}>
            {video.channelTitle}
          </Text>
          <Text style={styles.wideTitle} numberOfLines={3}>
            {video.title}
          </Text>
          <Text style={[type.caption, { marginTop: spacing.sm }]}>{formatRelativeDate(video.publishedAt)}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.fullRoot} testID={`video-card-${video.id}`}>
      <View style={styles.fullThumbWrap}>
        <Image source={{ uri: video.thumbnailUrl }} style={styles.fullThumb} contentFit="cover" transition={250} />
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(video.durationSeconds)}</Text>
        </View>
      </View>
      <View style={{ marginTop: spacing.md, paddingRight: spacing.xl }}>
        <Text style={type.caption} numberOfLines={1}>
          {video.channelTitle}
        </Text>
        <Text style={styles.fullTitle} numberOfLines={3}>
          {video.title}
        </Text>
        <Text style={[type.caption, { marginTop: spacing.sm }]}>{formatRelativeDate(video.publishedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullRoot: { width: "100%", marginBottom: spacing.xl },
  fullThumbWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: palette.surfaceDeep,
    overflow: "hidden",
  },
  fullThumb: { width: "100%", height: "100%" },
  fullTitle: {
    ...type.heading,
    marginTop: spacing.xs,
    fontSize: 22,
    lineHeight: 28,
  },
  compactRoot: { width: 260, marginRight: spacing.lg },
  compactThumbWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: palette.surfaceDeep,
    overflow: "hidden",
    position: "relative",
  },
  compactThumb: { width: "100%", height: "100%" },
  compactMeta: { marginTop: spacing.md },
  compactTitle: { ...type.heading, fontSize: 16, lineHeight: 20, marginTop: spacing.xs },
  wideRoot: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "flex-start",
  },
  wideThumbWrap: {
    width: 140,
    aspectRatio: 16 / 9,
    backgroundColor: palette.surfaceDeep,
    overflow: "hidden",
  },
  wideThumb: { width: "100%", height: "100%" },
  wideMeta: { flex: 1, paddingRight: spacing.md },
  wideTitle: { ...type.heading, fontSize: 15, lineHeight: 20, marginTop: spacing.xs },
  durationBadge: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(26,28,26,0.78)",
  },
  durationText: {
    color: palette.wall,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "600" as const,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: "rgba(250,249,246,0.25)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: palette.accent,
  },
});
