import { router } from "expo-router";
import { Image } from "expo-image";
import { Play } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { SAMPLE_CHANNELS, SAMPLE_VIDEOS } from "@/constants/sampleData";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import type { Channel } from "@/types";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { resumeList, savedVideos, watchLater, followedChannels } = useApp();

  const resumeVideos = useMemo(() => {
    return resumeList.map((r) => {
      const fromSaved = savedVideos.find((s) => s.id === r.videoId);
      const fromLater = watchLater.find((s) => s.id === r.videoId);
      const fromSample = SAMPLE_VIDEOS.find((s) => s.id === r.videoId);
      const v = fromSaved ?? fromLater ?? fromSample;
      if (!v) return null;
      return { video: v, progress: r.timestampSeconds };
    }).filter(Boolean) as { video: typeof SAMPLE_VIDEOS[number]; progress: number }[];
  }, [resumeList, savedVideos, watchLater]);

  // Hero pulls from the user's own intent first: Watch Later, then Saved, then a curated sample.
  const hero = watchLater[0] ?? savedVideos[0] ?? SAMPLE_VIDEOS[0];
  const more = SAMPLE_VIDEOS.slice(1, 5);

  const channels = useMemo<Channel[]>(() => {
    const seen = new Set<string>();
    const merged: Channel[] = [];
    [...followedChannels, ...SAMPLE_CHANNELS].forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        merged.push(c);
      }
    });
    return merged;
  }, [followedChannels]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Today" title={"Welcome\nback."} subtitle="A small selection. Pick one. Watch it whole." />
      </View>

      <Pressable
        onPress={() => router.push("/session")}
        style={styles.sessionBanner}
        testID="start-session"
      >
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: palette.accentSoft }]}>Sit down for a while</Text>
          <Text style={styles.sessionTitle}>Start a session</Text>
        </View>
        <View style={styles.sessionPlay}>
          <Play size={16} color={palette.ink} strokeWidth={1.8} fill={palette.ink} />
        </View>
      </Pressable>

      {resumeVideos.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionLabel}>
            <Text style={type.caption}>Continue Watching</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          >
            {resumeVideos.map(({ video, progress }) => (
              <VideoCard key={video.id} video={video} variant="compact" progressSeconds={progress} />
            ))}
          </ScrollView>
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
          <Text style={type.caption}>Featured</Text>
        </View>
        {hero && <VideoCard video={hero} variant="full" />}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <View style={styles.sectionLabel}>
          <Text style={type.caption}>{followedChannels.length > 0 ? "Your Channels" : "Channels"}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
      >
        {channels.map((c) => (
          <Pressable
            key={c.id}
            style={styles.channelTile}
            onPress={() => router.push({ pathname: "/channel/[id]", params: { id: c.id } })}
            testID={`channel-${c.id}`}
          >
            <View style={styles.channelAvatar}>
              <Image source={{ uri: c.thumbnailUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </View>
            <Text style={styles.channelName} numberOfLines={2}>
              {c.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <View style={styles.sectionLabel}>
          <Text style={type.caption}>More to watch</Text>
        </View>
        {more.length === 0 ? (
          <EmptyState title="Nothing here yet" body="Explore topics or search to find something to watch." />
        ) : (
          more.map((v) => <VideoCard key={v.id} video={v} variant="wide" />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: spacing.md, paddingHorizontal: 0 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg },
  sessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  sessionTitle: { fontFamily: "Georgia", fontSize: 22, color: palette.wall, marginTop: spacing.xs },
  sessionPlay: {
    width: 44,
    height: 44,
    backgroundColor: palette.wall,
    justifyContent: "center",
    alignItems: "center",
  },
  channelTile: { width: 120, marginRight: spacing.lg, alignItems: "flex-start" },
  channelAvatar: {
    width: 88,
    height: 88,
    backgroundColor: palette.surfaceDeep,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  channelName: { ...type.label, fontSize: 12, lineHeight: 16 },
});
