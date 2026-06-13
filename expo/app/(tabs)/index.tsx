import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { SAMPLE_CHANNELS, SAMPLE_VIDEOS } from "@/constants/sampleData";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { Image } from "expo-image";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { resumeList, savedVideos } = useApp();

  const resumeVideos = useMemo(() => {
    return resumeList.map((r) => {
      const fromSaved = savedVideos.find((s) => s.id === r.videoId);
      const fromSample = SAMPLE_VIDEOS.find((s) => s.id === r.videoId);
      const v = fromSaved ?? fromSample;
      if (!v) return null;
      return { video: v, progress: r.timestampSeconds };
    }).filter(Boolean) as { video: typeof SAMPLE_VIDEOS[number]; progress: number }[];
  }, [resumeList, savedVideos]);

  const featured = SAMPLE_VIDEOS[0];
  const more = SAMPLE_VIDEOS.slice(1, 5);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Today" title={"Welcome\nback."} subtitle="A small selection. Pick one. Watch it whole." />
      </View>

      {resumeVideos.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
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

      <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.lg }}>
        <View style={styles.sectionLabel}>
          <Text style={type.caption}>Featured</Text>
        </View>
        {featured && <VideoCard video={featured} variant="full" />}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <View style={styles.sectionLabel}>
          <Text style={type.caption}>Channels</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
      >
        {SAMPLE_CHANNELS.map((c) => (
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
  sectionLabel: { marginBottom: spacing.md },
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
