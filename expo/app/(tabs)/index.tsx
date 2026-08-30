import { router } from "expo-router";
import { Image } from "expo-image";
import { Link2, Play } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { extractYouTubeId } from "@/services/youtube";
import type { Video } from "@/types";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { resumeList, savedVideos, watchLater, followedChannels, libraryLoading, requirePurchase } = useApp();
  const [watchLink, setWatchLink] = useState<string>("");
  const [watchLinkError, setWatchLinkError] = useState<string | null>(null);

  const openPastedVideo = (): void => {
    const videoId = extractYouTubeId(watchLink);
    if (!videoId) {
      setWatchLinkError("Paste a valid YouTube video link.");
      return;
    }
    setWatchLink("");
    setWatchLinkError(null);
    router.push({ pathname: "/watch/[id]", params: { id: videoId } });
  };

  const resumeVideos = useMemo(() => {
    return resumeList.map((r) => {
      const fromSaved = savedVideos.find((s) => s.id === r.videoId);
      const fromLater = watchLater.find((s) => s.id === r.videoId);
      const fromResume: Video | null = r.title
        ? {
            id: r.videoId,
            title: r.title,
            channelId: "",
            channelTitle: r.channelTitle ?? "",
            thumbnailUrl: r.thumbnailUrl ?? `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
            publishedAt: "",
            durationSeconds: r.durationSeconds ?? 0,
          }
        : null;
      const video = fromSaved ?? fromLater ?? fromResume;
      return video ? { video, progress: r.timestampSeconds } : null;
    }).filter((item): item is { video: Video; progress: number } => item !== null);
  }, [resumeList, savedVideos, watchLater]);

  const hero = watchLater[0] ?? savedVideos[0] ?? null;
  const more = useMemo<Video[]>(() => {
    const seen = new Set<string>(hero ? [hero.id] : []);
    return [...watchLater, ...savedVideos].filter((video) => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    }).slice(0, 6);
  }, [hero, savedVideos, watchLater]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Today" title={"Welcome\nback."} subtitle="A small selection. Pick one. Watch it whole." />
      </View>

      <View style={styles.quickWatch}>
        <Text style={type.caption}>Watch a link</Text>
        <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>Paste a YouTube video. Playback is free and nothing is saved unless you choose Premium.</Text>
        <View style={styles.quickWatchRow}>
          <Link2 size={16} color={palette.inkMuted} strokeWidth={1.7} />
          <TextInput
            value={watchLink}
            onChangeText={(value) => {
              setWatchLink(value);
              setWatchLinkError(null);
            }}
            onSubmitEditing={openPastedVideo}
            placeholder="youtube.com/watch?v=…"
            placeholderTextColor={palette.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            style={styles.quickWatchInput}
            accessibilityLabel="YouTube video link"
          />
          <Pressable onPress={openPastedVideo} style={styles.quickWatchButton} accessibilityRole="button">
            <Text style={styles.quickWatchButtonText}>Watch</Text>
          </Pressable>
        </View>
        {watchLinkError ? <Text style={styles.quickWatchError}>{watchLinkError}</Text> : null}
      </View>

      <Pressable
        onPress={() => {
          if (requirePurchase("sessions")) router.push("/session");
        }}
        style={({ pressed }) => [styles.sessionBanner, pressed && styles.pressed]}
        testID="start-session"
      >
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: palette.active }]}>Sit down for a while</Text>
          <Text style={styles.sessionTitle}>Create a named session</Text>
        </View>
        <View style={styles.sessionPlay}>
          <Play size={16} color={palette.onDark} strokeWidth={1.8} fill={palette.onDark} />
        </View>
      </Pressable>

      {resumeVideos.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionLabel}>
            <Text style={type.caption}>Continue Watching</Text>
          </View>
          <FlatList
            horizontal
            data={resumeVideos}
            keyExtractor={(item) => item.video.id}
            renderItem={({ item }) => <VideoCard video={item.video} variant="compact" progressSeconds={item.progress} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            initialNumToRender={3}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
          />
        </View>
      )}

      {watchLater.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View style={[styles.sectionLabel, styles.sectionRow]}>
            <Text style={type.caption}>Watch Later</Text>
            <Pressable onPress={() => router.push("/(tabs)/library")} hitSlop={8}>
              <Text style={[type.caption, { color: palette.accent }]}>All →</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          >
            {watchLater.slice(0, 8).map((video) => (
              <VideoCard key={video.id} video={video} variant="compact" />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.lg }}>
        <View style={styles.sectionLabel}>
          <Text style={type.caption}>From your library</Text>
        </View>
        {libraryLoading ? (
          <VideoFeedSkeleton count={1} variant="full" accessibilityLabel="Loading your library" />
        ) : hero ? (
          <VideoCard video={hero} variant="full" />
        ) : (
          <EmptyState title="Your frame is clear" body="Paste a YouTube link to watch freely, or add videos to your library with Premium." />
        )}
      </View>

      {followedChannels.length > 0 ? (
        <>
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <View style={styles.sectionLabel}>
              <Text style={type.caption}>Your Channels</Text>
            </View>
          </View>
          <FlatList
            horizontal
            data={followedChannels}
            keyExtractor={(channel) => channel.id}
            renderItem={({ item: channel }) => (
              <Pressable
                style={({ pressed }) => [styles.channelTile, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Open ${channel.title} channel`}
                testID={`channel-${channel.id}`}
              >
                <View style={styles.channelAvatar}>
                  {channel.thumbnailUrl ? <Image source={{ uri: channel.thumbnailUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={channel.id} /> : null}
                </View>
                <Text style={styles.channelName} numberOfLines={2}>{channel.title}</Text>
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
            initialNumToRender={4}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews
          />
        </>
      ) : null}

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <View style={styles.sectionLabel}>
          <Text style={type.caption}>More from your library</Text>
        </View>
        {libraryLoading ? (
          <VideoFeedSkeleton count={3} accessibilityLabel="Loading more from your library" />
        ) : more.length === 0 ? (
          <EmptyState title="Nothing else saved" body="Your saved choices will appear here without unrelated filler." />
        ) : (
          more.map((v) => <VideoCard key={v.id} video={v} variant="wide" />)
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    sectionLabel: { marginBottom: spacing.md, paddingHorizontal: 0 },
    quickWatch: { marginHorizontal: spacing.page, marginTop: spacing.lg, padding: spacing.lg, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
    quickWatchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, minHeight: 50, paddingLeft: spacing.md, backgroundColor: palette.surfaceHigh, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border },
    quickWatchInput: { ...type.body, flex: 1, paddingVertical: spacing.sm, fontSize: 14 },
    quickWatchButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: palette.accentDeep, borderRadius: radii.small, marginRight: 2 },
    quickWatchButtonText: { ...type.label, color: palette.onDark },
    quickWatchError: { ...type.bodySoft, color: palette.danger, marginTop: spacing.sm },
    sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg },
    sessionBanner: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.page, marginTop: spacing.lg, backgroundColor: palette.activeSoft, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderRadius: radii.card, borderWidth: 1, borderColor: palette.active },
    sessionTitle: { fontFamily: fonts.serif, fontSize: 22, color: palette.ink, marginTop: spacing.xs },
    sessionPlay: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.active, justifyContent: "center", alignItems: "center" },
    channelTile: { width: 120, marginRight: spacing.lg, alignItems: "flex-start" },
    channelAvatar: { width: 88, height: 88, borderRadius: radii.card, backgroundColor: palette.surfaceDeep, overflow: "hidden", marginBottom: spacing.sm, borderWidth: 1, borderColor: palette.borderSoft },
    avatarImage: { width: "100%", height: "100%" },
    channelName: { ...type.label, fontSize: 12, lineHeight: 16 },
    pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
