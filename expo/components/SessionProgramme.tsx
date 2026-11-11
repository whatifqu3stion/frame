import PlaybackAction from "@/components/PlaybackAction";
import { controlTransition, useControlFeedback } from "@/hooks/useControlFeedback";
import Text from "@/components/FrameText";
import MediaImage from "@/components/MediaImage";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import { useQuery } from "@tanstack/react-query";
import { Timer } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { expireVideo } from "@/domain/metadataRetention";
import { useSessionPlayback } from "@/hooks/useSessionPlayback";
import { sessionRuntime } from "@/domain/sessionFlow";
import { todayRepository } from "@/repositories/todayRepository";
import type { Video, VideoQueue } from "@/types";

type Props = { profileId: string; session: VideoQueue; savedVideos: Video[]; onOpen(): void };

/** An ordered programme, using only the same profile's local, unexpired metadata. */
export default function SessionProgramme({ profileId, session, savedVideos, onOpen }: Props) {
  const { palette, type } = useFrameTheme();
  const cover = useControlFeedback(palette.onProgramme);
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const media = useQuery({
    queryKey: ["library", profileId, "session-programme", session.orderedVideoIds.join(",")], networkMode: "always",
    queryFn: () => Promise.all(session.orderedVideoIds.map((id) => todayRepository.getVideo(profileId, id))),
  });
  const videos = useMemo(() => new Map([
    ...(media.data ?? []).filter((video): video is Video => Boolean(video)), ...savedVideos,
  ].map((video) => [video.id, expireVideo(video, Date.now())])), [media.data, savedVideos]);
  const { position, startAt, busy, playLabel } = useSessionPlayback(session, videos);
  const count = session.orderedVideoIds.length;
  const runtime = sessionRuntime(session.orderedVideoIds, [...videos.values()]);
  const length = runtime.seconds ? `${runtime.unknown ? "at least " : ""}${Math.ceil(runtime.seconds / 60)} min total` : "duration unavailable";
  const next = position >= count ? "Queue complete" : `Up next · Video ${position + 1} of ${count}`;
  const coverStart = position >= count ? 0 : position;
  const artwork = session.orderedVideoIds.slice(coverStart, coverStart + 3)
    .map((id) => videos.get(id)).filter((video): video is Video => Boolean(video?.thumbnailUrl));
  const upcoming = session.orderedVideoIds[position];
  return <View style={styles.root}>
    <ProgrammeGrain />
    <Pressable {...cover.events} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${session.name}. ${next}.`}
      accessibilityHint="View the full session lineup" style={[styles.cover, cover.ring]}>
      {({ pressed }) => <>
      {artwork.length > 0 && <View style={[styles.mount, !cover.reduced && controlTransition, (cover.highlighted || pressed) && { backgroundColor: palette.onDark }]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <MediaImage source={{ uri: artwork[0].thumbnailUrl }} contentFit="cover" cachePolicy="none" style={styles.leadImage} />
        {artwork.length > 1 && <View style={styles.companions}>
          {artwork.slice(1).map((video) => <MediaImage key={video.id} source={{ uri: video.thumbnailUrl }} contentFit="cover" cachePolicy="none" style={styles.companionImage} />)}
        </View>}
      </View>}
      <View style={styles.caption}>
        <Text style={[styles.title, (cover.highlighted || pressed) && { textDecorationLine: "underline" }]}>{session.name}</Text>
        <Text style={styles.summary}>{count} {count === 1 ? "video" : "videos"} · {length}</Text>
      </View>
      </>}
    </Pressable>
    <View style={styles.body}>
      <View style={styles.upNext}>
        <Text style={styles.status}>{next}</Text>
        {upcoming && <Text style={styles.videoTitle} numberOfLines={2}>{videos.get(upcoming)?.title || "Video details unavailable"}</Text>}
      </View>
      {count > 0 && <View style={styles.footer}>
        <PlaybackAction programme onPress={() => { void startAt(coverStart); }} accessibilityRole="button"
          disabled={busy} accessibilityState={{ disabled: busy, busy }} style={[styles.playButton, busy && styles.pressed]}>
          <Text style={styles.action}>{busy ? "Opening…" : playLabel}</Text>
        </PlaybackAction>
        {session.targetMinutes ? <View style={styles.timing}>
          <Timer size={16} color={palette.onProgrammeSoft} />
          <Text style={styles.summary}>Pause after {session.targetMinutes} min</Text>
        </View> : null}
      </View>}
    </View>
  </View>;
}

function createStyles(p: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { backgroundColor: p.programme, borderRadius: radii.card, padding: 12 },
    cover: { borderRadius: radii.small },
    mount: { flexDirection: "row", width: "100%", aspectRatio: 2.55, maxHeight: 220, gap: 3, padding: 3, backgroundColor: p.onProgrammeSoft },
    leadImage: { flex: 2, minWidth: 0, height: "100%" },
    companions: { flex: 1, minWidth: 0, gap: 3 },
    companionImage: { width: "100%", flex: 1, minHeight: 0 },
    caption: { paddingHorizontal: 8, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
    title: { ...type.title, color: p.onProgramme },
    summary: { ...type.label, color: p.onProgrammeSoft, flexShrink: 1 },
    body: { marginHorizontal: 8, marginBottom: 8 },
    upNext: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.programmeRule, paddingTop: spacing.md, gap: spacing.xs },
    status: { ...type.caption, color: p.onProgrammeSoft },
    videoTitle: { ...type.body, color: p.onProgramme },
    footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.lg },
    playButton: { maxWidth: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48, borderRadius: radii.control, backgroundColor: p.onProgramme },
    action: { ...type.label, color: p.programme, flexShrink: 1 },
    timing: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: spacing.xs },
    pressed: { opacity: 0.82 },
  });
}
