import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Check, Plus } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import EmptyState from "@/components/EmptyState";
import VideoCard from "@/components/VideoCard";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { getChannel, getChannelVideos } from "@/services/youtube";

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { prefs, isChannelFollowed, followChannel, unfollowChannel, requirePurchase } = useApp();

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
  const following = id ? isChannelFollowed(id) : false;

  const toggleFollow = async () => {
    if (!channel) return;
    if (following) {
      await unfollowChannel(channel.id);
      return;
    }
    if (!requirePurchase()) return;
    await followChannel({ ...channel, followedAt: Date.now() });
  };

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

        {channel ? (
          <Pressable onPress={toggleFollow} style={[styles.followBtn, following && styles.followBtnActive]} testID="follow-channel">
            {following ? (
              <>
                <Check size={15} color={palette.accent} strokeWidth={1.8} />
                <Text style={[styles.followText, { color: palette.accent }]}>Following</Text>
              </>
            ) : (
              <>
                <Plus size={15} color={palette.wall} strokeWidth={1.8} />
                <Text style={[styles.followText, { color: palette.wall }]}>Follow channel</Text>
              </>
            )}
          </Pressable>
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
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  followBtnActive: { backgroundColor: palette.surface },
  followText: { fontFamily: "Georgia", fontSize: 14 },
});
