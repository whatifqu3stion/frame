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
  const { followedChannels, isChannelFollowed, followChannel, unfollowChannel, requirePurchase } = useApp();

  const channelQuery = useQuery({
    queryKey: ["channel", id],
    queryFn: () => getChannel(id!),
    enabled: !!id,
  });
  const videosQuery = useQuery({
    queryKey: ["channel-videos", id],
    queryFn: () => getChannelVideos(id!),
    enabled: !!id,
  });

  const savedChannel = followedChannels.find((candidate) => candidate.id === id);
  const channel = channelQuery.data?.status === "success" ? channelQuery.data.data : savedChannel;
  const videos = videosQuery.data?.status === "success" || videosQuery.data?.status === "partial"
    ? videosQuery.data.data
    : [];
  const videosMessage = videosQuery.data && "message" in videosQuery.data
    ? videosQuery.data.message
    : undefined;
  const following = id ? isChannelFollowed(id) : false;

  const toggleFollow = async () => {
    if (!channel) return;
    if (following) {
      await unfollowChannel(channel.id);
      return;
    }
    if (!requirePurchase()) return;
    await followChannel({ ...channel, followedAt: Date.now(), source: "manual" });
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
            <Text style={type.bodySoft}>Loading verified uploads…</Text>
          ) : videos.length > 0 ? (
            videos.map((video) => <VideoCard key={video.id} video={video} variant="wide" />)
          ) : videosQuery.data?.status === "empty" ? (
            <EmptyState title="No playable recent uploads" body={videosQuery.data.message ?? "This channel has nothing public to show right now."} />
          ) : (
            <EmptyState title="Couldn't refresh uploads" body={videosMessage ?? "The saved creator is still on your shelf. Try again later."} />
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
