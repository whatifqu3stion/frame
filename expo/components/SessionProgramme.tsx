import Text from "@/components/FrameText";
import ProgrammeArtwork from "@/components/ProgrammeArtwork";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { expireVideo } from "@/domain/metadataRetention";
import { sessionPosition, sessionRuntime } from "@/domain/sessionFlow";
import { todayRepository } from "@/repositories/todayRepository";
import type { Video, VideoQueue } from "@/types";

type Props = { profileId: string; session: VideoQueue; savedVideos: Video[]; onOpen(): void };

/** An ordered programme, using only the same profile's local, unexpired metadata. */
export default function SessionProgramme({ profileId, session, savedVideos, onOpen }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const media = useQuery({
    queryKey: ["library", profileId, "session-programme", session.orderedVideoIds.join(",")], networkMode: "always",
    queryFn: () => Promise.all(session.orderedVideoIds.map((id) => todayRepository.getVideo(profileId, id))),
  });
  const videos = useMemo(() => new Map([
    ...(media.data ?? []).filter((video): video is Video => Boolean(video)), ...savedVideos,
  ].map((video) => [video.id, expireVideo(video, Date.now())])), [media.data, savedVideos]);
  const position = sessionPosition(session);
  const remaining = sessionRuntime(session.orderedVideoIds, [...videos.values()]);
  const status = position >= session.orderedVideoIds.length ? "Complete" : `Next: video ${position + 1} of ${session.orderedVideoIds.length}`;
  const duration = remaining.seconds ? `Full queue: ${remaining.unknown ? "at least " : ""}${Math.ceil(remaining.seconds / 60)} min` : "";
  const summary = [session.targetMinutes ? `Viewing time: ${session.targetMinutes} min` : "Choose a session duration", status, duration, remaining.unknown ? "Some durations unavailable" : ""].filter(Boolean).join(" · ");
  return <Pressable onPress={onOpen} style={({ pressed }) => [styles.root, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open current session ${session.name}. ${summary}. ${session.orderedVideoIds.slice(position, position + 3).map((id, offset) => `${position + offset + 1}: ${videos.get(id)?.title ?? "Video details unavailable"}`).join(". ")}`}>
    <ProgrammeGrain />
    <ProgrammeArtwork videos={session.orderedVideoIds.slice(position, position + 3).map((id) => videos.get(id))} />
    <Text style={styles.title}>{session.name}</Text>
    <Text style={styles.summary}>{summary}</Text>
    <View style={styles.list}>
      {session.orderedVideoIds.slice(position, position + 3).map((id, offset) => <View key={id} style={styles.row}>
        <Text style={[styles.number, offset === 0 && styles.currentNumber]}>{String(position + offset + 1).padStart(2, "0")}</Text>
        <Text numberOfLines={2} style={styles.videoTitle}>{videos.get(id)?.title ?? "Video details unavailable"}</Text>
      </View>)}
    </View>
    {session.orderedVideoIds.length > position + 3 ? <Text style={styles.summary}>More videos in your plan</Text> : null}
    <View style={styles.footer}><Text style={styles.action}>Open session</Text><ArrowUpRight size={19} color={palette.onProgramme} /></View>
  </Pressable>;
}
function createStyles(p: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { backgroundColor: p.programme, borderRadius: radii.card, padding: spacing.lg },
    title: { ...type.heading, color: p.onProgramme, fontSize: 26, lineHeight: 33 },
    summary: { ...type.bodySoft, color: p.onProgrammeSoft, marginTop: spacing.sm },
    list: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.programmeRule },
    row: { flexDirection: "row", alignItems: "baseline", gap: spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.programmeRule },
    number: { ...type.caption, color: p.onProgrammeSoft, minWidth: 24, fontVariant: ["tabular-nums"] },
    currentNumber: { color: p.onProgramme, fontWeight: "700" },
    videoTitle: { ...type.label, fontSize: 14, lineHeight: 20, color: p.onProgramme, flex: 1 },
    footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md, paddingTop: spacing.md, minHeight: 48 },
    action: { ...type.label, color: p.onProgramme, flexShrink: 1 },
    pressed: { opacity: 0.88 },
  });
}
