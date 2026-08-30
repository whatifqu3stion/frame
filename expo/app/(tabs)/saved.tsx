import { router } from "expo-router";
import { ArrowRight, Play, Plus } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { shellProfileQueryKeys } from "@/domain/productShell";
import { useApp } from "@/providers/AppProvider";
import type { Video } from "@/types";

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, savedVideos, watchLater, resumeList, sessions, libraryLoading, requirePurchase } = useApp();
  const profileKeys = shellProfileQueryKeys(activeProfileId);
  const saved = useMemo<Video[]>(() => {
    const byId = new Map<string, Video>();
    [...savedVideos, ...watchLater].forEach((video) => byId.set(video.id, video));
    return Array.from(byId.values());
  }, [savedVideos, watchLater]);
  const continueWatching = useMemo(() => resumeList.flatMap((resume) => {
    const video = saved.find((candidate) => candidate.id === resume.videoId) ?? (resume.title ? {
      id: resume.videoId,
      title: resume.title,
      channelId: "",
      channelTitle: resume.channelTitle ?? "",
      thumbnailUrl: resume.thumbnailUrl ?? `https://i.ytimg.com/vi/${resume.videoId}/hqdefault.jpg`,
      publishedAt: "",
      durationSeconds: resume.durationSeconds ?? 0,
    } : null);
    return video ? [{ video, progressSeconds: resume.timestampSeconds }] : [];
  }), [resumeList, saved]);
  const currentSession = sessions[0] ?? null;

  const openSessionBuilder = (): void => {
    if (requirePurchase("sessions")) router.push("/session");
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.page}>
        <ScreenHeader eyebrow="Saved" title={"Worth coming\nback to."} subtitle="One place for the videos you chose, where you stopped, and the session in front of you." />

        <SectionTitle label="Continue Watching" testID={`continue-${profileKeys.continueWatching.join("-")}`} styles={styles} />
        {libraryLoading ? <VideoFeedSkeleton count={2} accessibilityLabel="Loading continue watching" /> : continueWatching.length === 0 ? (
          <EmptyState title="Nothing in progress" body="When you stop partway through a video, it will wait here at the same point." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {continueWatching.map((item) => <VideoCard key={item.video.id} video={item.video} variant="compact" progressSeconds={item.progressSeconds} />)}
          </ScrollView>
        )}

        <SectionTitle label="Saved videos" testID={`saved-${profileKeys.saved.join("-")}`} styles={styles} />
        {libraryLoading ? <VideoFeedSkeleton count={3} accessibilityLabel="Loading saved videos" /> : saved.length === 0 ? (
          <EmptyState title="Nothing saved" body="Use Save while watching. Videos you previously set aside remain available here without a competing list." />
        ) : saved.map((video) => <VideoCard key={video.id} video={video} variant="wide" />)}

        <SectionTitle label="Current Session" styles={styles} />
        {currentSession ? (
          <Pressable
            onPress={() => {
              if (requirePurchase("sessions")) router.push({ pathname: "/session/[id]", params: { id: currentSession.id } });
            }}
            style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open current session ${currentSession.name}`}
          >
            <View style={styles.sessionIcon}><Play size={17} color={palette.active} fill={palette.active} /></View>
            <View style={styles.flex}>
              <Text style={styles.sessionName}>{currentSession.name}</Text>
              <Text style={styles.sessionMeta}>{currentSession.orderedVideoIds.length} of {PRODUCT_LIMITS.sessionDraftMaxItems} videos</Text>
            </View>
            <ArrowRight size={17} color={palette.inkMuted} />
          </Pressable>
        ) : (
          <View>
            <EmptyState title="No current session" body="When you want a short viewing plan, create one outside the tab flow and Frame will stop after it ends." />
            <Pressable onPress={openSessionBuilder} style={({ pressed }) => [styles.createSession, pressed && styles.pressed]} accessibilityRole="button">
              <Plus size={16} color={palette.onDark} />
              <Text style={styles.createSessionText}>Create a session</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SectionTitle({ label, testID, styles }: { label: string; testID?: string; styles: ReturnType<typeof createStyles> }) {
  return <Text style={styles.sectionTitle} testID={testID}>{label}</Text>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    page: { paddingHorizontal: spacing.page },
    flex: { flex: 1 },
    sectionTitle: { ...type.caption, marginTop: spacing.xl, marginBottom: spacing.md },
    horizontalList: { gap: spacing.md, paddingRight: spacing.page },
    sessionCard: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    sessionIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: palette.activeSoft },
    sessionName: { ...type.heading, fontSize: 18, lineHeight: 23 },
    sessionMeta: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    createSession: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: -spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep },
    createSessionText: { ...type.label, color: palette.onDark },
    pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  });
}
