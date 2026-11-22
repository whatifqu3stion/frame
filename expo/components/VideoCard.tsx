import Text from "@/components/FrameText";
import { durationDecision, SHORT_FORM_MESSAGE } from "@/domain/contentPolicy";
import { skipToken, useQuery } from "@tanstack/react-query";
import VideoDetailsRecovery from "@/components/VideoDetailsRecovery";
import MediaMount from "@/components/MediaMount";
import Image from "@/components/MediaImage";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { ThumbnailSkeleton } from "@/components/VideoSkeleton";
import { formatDuration, formatRelativeDate } from "@/services/youtube";
import { expireVideo, isMetadataCurrent } from "@/domain/metadataRetention";
import type { Video } from "@/types";

type Props = { video: Video; variant?: "full" | "compact" | "wide"; progressSeconds?: number; sessionId?: string; sessionLabel?: string };

function VideoCard({ video, variant = "full", progressSeconds, sessionId, sessionLabel }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const stackWide = width < 360 || fontScale > 1.3;

  const { palette, type } = useFrameTheme();
  const { requirePurchase, activeProfileId } = useApp();
  const recovered = useQuery<Video>({ queryKey: ["recovered-video", activeProfileId, video.id], queryFn: skipToken, enabled: false });
  video = expireVideo(recovered.data && (recovered.data.fetchedAt ?? 0) > (video.fetchedAt ?? 0) ? recovered.data : video, Date.now());
  const expired = !isMetadataCurrent(video.fetchedAt, Date.now());
  const shortForm = durationDecision(video.durationSeconds) === "short";
  const policyNotice = shortForm ? <Text style={[type.bodySoft, { paddingVertical: spacing.sm }]}>{SHORT_FORM_MESSAGE}</Text> : null;
  const recovery = expired || recovered.data ? <VideoDetailsRecovery key={`${activeProfileId}:${video.id}`} videoId={video.id} expired={expired} /> : null;
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const navigationLocked = useRef<boolean>(false);
  const [isThumbnailLoading, setIsThumbnailLoading] = useState<boolean>(true);
  const progressFraction = progressSeconds && video.durationSeconds ? Math.min(1, Math.max(0, progressSeconds / video.durationSeconds)) : 0;
  const accessibilityLabel = `${sessionLabel ? `${sessionLabel}. ` : ""}${shortForm ? "Unavailable short-form video" : progressSeconds ? "Resume" : "Play"} ${video.title}${video.channelTitle ? ` by ${video.channelTitle}` : ""}${progressSeconds ? `, ${formatDuration(progressSeconds)} watched${video.durationSeconds ? ` of ${formatDuration(video.durationSeconds)}` : ""}` : ""}`;
  const dateLabel = progressSeconds && progressSeconds > 0 ? `Resume at ${formatDuration(progressSeconds)}` : formatRelativeDate(video.publishedAt);

  useEffect(() => {
    setIsThumbnailLoading(Boolean(video.thumbnailUrl));
  }, [video.thumbnailUrl]);

  const onPress = useCallback((): void => {
    if (navigationLocked.current || !requirePurchase("library")) return;
    navigationLocked.current = true;
    router.push({ pathname: FRAME_PLAYBACK_ROUTE, params: { ...(sessionId ? { savedSessionId: sessionId, sessionProfileId: activeProfileId } : {}), id: video.id, title: video.title, channelId: video.channelId, channelTitle: video.channelTitle, thumbnailUrl: video.thumbnailUrl, publishedAt: video.publishedAt, durationSeconds: String(video.durationSeconds), description: video.description ?? "", madeForKids: video.madeForKids === true ? "1" : video.madeForKids === false ? "0" : "", cachedMetadata: "1", fetchedAt: String(video.fetchedAt ?? 0) } });
    setTimeout(() => { navigationLocked.current = false; }, 800);
  }, [activeProfileId, requirePurchase, sessionId, video]);

  const thumbnail = (wrapStyle: object, imageStyle: object) => (
    <View style={wrapStyle}><View style={{ flex: 1 }}>
      {video.thumbnailUrl ? <Image
        source={{ uri: video.thumbnailUrl }}
        style={imageStyle}
        contentFit="cover"
        cachePolicy="none"
        recyclingKey={video.id}
        transition={160}
        onLoadStart={() => setIsThumbnailLoading(true)}
        onLoad={() => setIsThumbnailLoading(false)}
        onError={() => setIsThumbnailLoading(false)}
      /> : <Text style={type.caption}>Details unavailable · link saved</Text>}
      {video.thumbnailUrl && isThumbnailLoading ? <ThumbnailSkeleton /> : null}
      {!isThumbnailLoading && video.durationSeconds > 0 ? <View style={styles.durationBadge}><Text style={styles.durationText}>{formatDuration(video.durationSeconds)}</Text></View> : null}
      {!isThumbnailLoading && progressFraction > 0 ? <View style={styles.progressTrack} accessibilityLabel={`${Math.round(progressFraction * 100)} percent watched`}><View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} /></View> : null}
    </View></View>
  );

  if (variant === "compact") return (
    <View style={{ width: 264, marginRight: spacing.lg }}>
    <Pressable onPress={onPress} style={({ pressed }) => [styles.compactRoot, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
      {thumbnail(styles.compactThumbWrap, styles.thumb)}
      <View style={styles.compactMeta}>
        {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
        <Text style={styles.compactTitle} numberOfLines={2}>{video.title}</Text>
        {dateLabel ? <Text style={[type.caption, styles.date]}>{dateLabel}</Text> : null}
      </View>
    </Pressable>
    {policyNotice}{recovery}
    </View>
  );

  if (variant === "wide") return (
    <View>
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wideRoot, stackWide && { flexDirection: "column" }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
      {thumbnail([styles.wideThumbWrap, stackWide && { width: "100%" }], styles.thumb)}
      <View style={[styles.wideMeta, stackWide && { flex: 0, width: "100%" }]}>
        {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
        <Text style={styles.wideTitle} numberOfLines={3}>{video.title}</Text>
        {dateLabel ? <Text style={[type.caption, styles.date]}>{dateLabel}</Text> : null}
      </View>
    </Pressable>
    {policyNotice}{recovery}
    </View>
  );

  return (
    <View>
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fullRoot, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={`video-card-${video.id}`}>
      <MediaMount>{thumbnail(styles.fullThumbWrap, styles.thumb)}</MediaMount>
      <View style={styles.fullMeta}>
        {video.channelTitle ? <Text style={type.caption} numberOfLines={1}>{video.channelTitle}</Text> : null}
        <Text style={styles.fullTitle} numberOfLines={3}>{video.title}</Text>
        {dateLabel ? <Text style={[type.caption, styles.date]}>{dateLabel}</Text> : null}
      </View>
    </Pressable>
    {policyNotice}{recovery}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    fullRoot: { width: "100%", marginBottom: spacing.xl },
    fullThumbWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden", borderRadius: radii.media, position: "relative" },
    fullMeta: { marginTop: spacing.md, paddingHorizontal: spacing.xs },
    fullTitle: { ...type.heading, marginTop: spacing.xs, fontSize: 22, lineHeight: 29 },
    compactRoot: { width: 264 },
    compactThumbWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden", borderRadius: radii.media, position: "relative" },
    compactMeta: { marginTop: spacing.md, paddingHorizontal: spacing.xs },
    compactTitle: { ...type.heading, fontSize: 16, lineHeight: 21, marginTop: spacing.xs },
    wideRoot: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg, alignItems: "flex-start", minHeight: 82 },
    wideThumbWrap: { width: 142, aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep, overflow: "hidden", borderRadius: radii.media, position: "relative" },
    thumb: { width: "100%", height: "100%" },
    wideMeta: { flex: 1, paddingRight: spacing.sm, paddingTop: 1 },
    wideTitle: { ...type.label, fontSize: 16, lineHeight: 22, marginTop: spacing.xs },
    date: { marginTop: spacing.sm },
    durationBadge: { position: "absolute", right: spacing.sm, bottom: spacing.sm, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: "rgba(20,18,16,0.82)", borderRadius: 6 },
    durationText: { color: "#F7F1E7", fontFamily: "HankenGrotesk_600SemiBold", fontSize: 12, letterSpacing: 0.3 },
    progressTrack: { position: "absolute", left: 8, right: 8, bottom: 6, height: 3, borderRadius: radii.pill, backgroundColor: "rgba(247,241,231,0.3)", overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: palette.active },
    pressed: { opacity: 0.88 },
  });
}

export default memo(VideoCard);

