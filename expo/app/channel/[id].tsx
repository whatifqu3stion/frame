import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import EmptyState from "@/components/EmptyState";
import VideoCard from "@/components/VideoCard";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { getChannel, getChannelVideos } from "@/services/youtube";

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { prefs } = useApp();

  const channelQuery = useQuery({
    queryKey: ["channel", id, prefs.youtubeApiKey],
    queryFn: () => getChannel(id!, prefs.youtubeApiKey),
    enabled: !!id,
  });
  const videosQuery = useQuery({
    queryKey: ["channel-videos", id, prefs.youtubeApiKey],
    queryFn: () => getChannelVideos(id!, prefs.youtubeApiKey),
    enabled: !!id,
  });

  const channel = channelQuery.data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.wall }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {channel?.thumbnailUrl ? (
            <Image source={{ uri: channel.thumbnailUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : null}
        </View>
        <Text style={type.caption}>Channel</Text>
        <Text style={[type.title, { marginTop: spacing.sm }]}>{channel?.title ?? "—"}</Text>
        {channel?.description ? (
          <Text style={[type.bodySoft, { marginTop: spacing.md, maxWidth: 360 }]} numberOfLines={4}>
            {channel.description}
          </Text>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <Text style={type.caption}>Videos</Text>
        <View style={{ marginTop: spacing.md }}>
          {videosQuery.isLoading ? (
            <Text style={type.bodySoft}>Loading…</Text>
          ) : (videosQuery.data ?? []).length === 0 ? (
            <EmptyState title="No videos" body="This channel has nothing to show right now." />
          ) : (
            (videosQuery.data ?? []).map((v) => <VideoCard key={v.id} video={v} variant="wide" />)
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    backgroundColor: palette.surfaceDeep,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
});
