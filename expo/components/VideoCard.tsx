import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { palette, spacing, type } from "@/constants/theme";
import { formatDuration, formatRelativeDate } from "@/services/youtube";
import type { Video } from "@/types";

type Props = {
  video: Video;
  variant?: "full" | "compact" | "wide";
  progressSeconds?: number;
};

function ProgressBar({ fraction }: { fraction: number }) {
  if (fraction <= 0) return null;
  return (
    <View style={styles.progressTrack} accessibilityLabel={`${Math.round(fraction * 100)} percent watched`}>
      <View style={[styles.progressFill, { width: `${fraction * 100}%` }]} />
    </View>
  );
}

function DurationBadge({ seconds }: { seconds: number }) {
  if (seconds <= 0) return null;
  return (
    <View style={styles.durationBadge}>
      <Text style={styles.durationText}>{formatDuration(seconds)}</Text>
    </View>
  );
}

export default function VideoCard({ video, variant = "full", progressSeconds }: Props) {
  const navigationLocked = useRef<boolean>(false);
  const progressFraction = progressSeconds && video.durationSeconds
    ? Math.min(1, Math.max(0, progressSeconds / video.durationSeconds))
    : 0;
  const accessibilityLabel = `Play ${video.title}${video.channelTitle ? ` by ${video.channelTitle}` : ""}`;
  const dateLabel = formatRelativeDate(video.publishedAt);

  const onPress = () => {
    if (navigationLocked.current) return;
    navigationLocked.current = true;
    router.push({
      pathname: "/watch/[id]",
      params: {
        id: video.id,
        title: video.title,
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        durationSeconds: String(video.durationSeconds),
      },
    });
    setTimeout(() => { navigationLocked.current = false; }, 800);
  };

  if (variant === "compact") {
    return (
      <Pressable onPress={onPress} style={styles.compactRoot} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
        <View style={styles.compactThumbWrap}>
          <Image source={{ uri: video.thumbnailUrl }} style={styles.compactThumb} contentFit="cover" transition={200} />
          <DurationBadge seconds={video.durationSeconds} />
          <ProgressBar fraction={progressFraction} />
        </View>
        <View style={styles.compactMeta}>
          {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
          <Text style={styles.compactTitle} numberOfLines={2}>{video.title}</Text>
          {dateLabel ? <Text style={[type.caption, { marginTop: spacing.xs }]}>{dateLabel}</Text> : null}
        </View>
      </Pressable>
    );
  }

  if (variant === "wide") {
    return (
      <Pressable onPress={onPress} style={styles.wideRoot} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
        <View style={styles.wideThumbWrap}>
          <Image source={{ uri: video.thumbnailUrl }} style={styles.wideThumb} contentFit="cover" transition={200} />
          <DurationBadge seconds={video.durationSeconds} />
          <ProgressBar fraction={progressFraction} />
        </View>
        <View style={styles.wideMeta}>
          {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
          <Text style={styles.wideTitle} numberOfLines={3}>{video.title}</Text>
          {dateLabel ? <Text style={[type.caption, { marginTop: spacing.sm }]}>{dateLabel}</Text> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.fullRoot} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
      <View style={styles.fullThumbWrap}>
        <Image source={{ uri: video.thumbnailUrl }} style={styles.fullThumb} contentFit="cover" transition={250} />
        <DurationBadge seconds={video.durationSeconds} />
        <ProgressBar fraction={progressFraction} />
      </View>
      <View style={{ marginTop: spacing.md, paddingRight: spacing.xl }}>
        {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
        <Text style={styles.fullTitle} numberOfLines={3}>{video.title}</Text>
        {dateLabel ? <Text style={[type.caption, { marginTop: spacing.sm }]}>{dateLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullRoot: { width: "100%", marginBottom: spacing.xl },
  fullThumbWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden" },
  fullThumb: { width: "100%", height: "100%" },
  fullTitle: { ...type.heading, marginTop: spacing.xs, fontSize: 22, lineHeight: 28 },
  compactRoot: { width: 260, marginRight: spacing.lg },
  compactThumbWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden", position: "relative" },
  compactThumb: { width: "100%", height: "100%" },
  compactMeta: { marginTop: spacing.md },
  compactTitle: { ...type.heading, fontSize: 16, lineHeight: 20, marginTop: spacing.xs },
  wideRoot: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg, alignItems: "flex-start", minHeight: 80 },
  wideThumbWrap: { width: 140, aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden", position: "relative" },
  wideThumb: { width: "100%", height: "100%" },
  wideMeta: { flex: 1, paddingRight: spacing.md },
  wideTitle: { ...type.heading, fontSize: 15, lineHeight: 20, marginTop: spacing.xs },
  durationBadge: { position: "absolute", right: spacing.sm, bottom: spacing.sm, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "rgba(26,28,26,0.78)" },
  durationText: { color: palette.wall, fontSize: 10, letterSpacing: 1.2, fontWeight: "600" as const },
  progressTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(250,249,246,0.25)" },
  progressFill: { height: "100%", backgroundColor: palette.accent },
});
