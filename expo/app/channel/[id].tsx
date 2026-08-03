import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Check, Plus, RotateCcw } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import VideoCard from "@/components/VideoCard";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { getChannel, getChannelVideos } from "@/services/youtube";
import type { Video } from "@/types";

export default function ChannelScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
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

  const toggleFollow = useCallback(async (): Promise<void> => {
    if (!channel) return;
    if (following) {
      await unfollowChannel(channel.id);
      return;
    }
    if (!requirePurchase()) return;
    await followChannel({ ...channel, followedAt: Date.now(), source: "manual" });
  }, [channel, followChannel, following, requirePurchase, unfollowChannel]);

  const retryUploads = useCallback((): void => {
    void videosQuery.refetch();
  }, [videosQuery]);

  const header = (
    <>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {channel?.thumbnailUrl ? (
            <Image
              source={{ uri: channel.thumbnailUrl }}
              style={styles.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={channel.id}
            />
          ) : null}
        </View>
        <Text style={type.caption}>Channel</Text>
        <Text style={[type.title, styles.channelName]} accessibilityRole="header">{channel?.title ?? "—"}</Text>
        {channel?.description ? (
          <Text style={styles.description} numberOfLines={4}>{channel.description}</Text>
        ) : null}

        {channel ? (
          <Pressable
            onPress={toggleFollow}
            style={({ pressed }) => [styles.followBtn, following && styles.followBtnActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: following }}
            accessibilityLabel={following ? `Unfollow ${channel.title}` : `Follow ${channel.title}`}
            testID="follow-channel"
          >
            {following ? <Check size={15} color={palette.accent} strokeWidth={1.8} /> : <Plus size={15} color={palette.onDark} strokeWidth={1.8} />}
            <Text style={[styles.followText, { color: following ? palette.accent : palette.onDark }]}>{following ? "Following" : "Follow channel"}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.videoHeading}>
        <Text style={type.caption}>Videos</Text>
      </View>
    </>
  );

  const empty = videosQuery.isLoading ? (
    <View style={styles.loadingState} accessible accessibilityRole="progressbar" accessibilityLabel="Loading verified uploads">
      <ActivityIndicator color={palette.accent} />
      <Text style={styles.loadingText}>Loading verified uploads…</Text>
    </View>
  ) : videosQuery.data?.status === "empty" ? (
    <EmptyState title="No playable recent uploads" body={videosQuery.data.message ?? "This channel has nothing public to show right now."} />
  ) : (
    <View>
      <EmptyState title="Couldn't refresh uploads" body={videosMessage ?? "The saved creator is still on your shelf. Check your connection and try again."} />
      <Pressable onPress={retryUploads} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} accessibilityRole="button">
        <RotateCcw size={16} color={palette.accent} />
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList<Video>
      data={videos}
      keyExtractor={(video) => video.id}
      renderItem={({ item }) => <VideoCard video={item} variant="wide" />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={50}
      windowSize={7}
      removeClippedSubviews
      refreshing={videosQuery.isRefetching}
      onRefresh={retryUploads}
      style={styles.list}
    />
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  list: { flex: 1, backgroundColor: palette.wall },
  content: { flexGrow: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: radii.card, backgroundColor: palette.surfaceDeep, marginBottom: spacing.lg, overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  channelName: { marginTop: spacing.sm },
  description: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 360 },
  followBtn: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", marginTop: spacing.lg, backgroundColor: palette.accentDeep, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.control },
  followBtnActive: { backgroundColor: palette.surface },
  followText: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  videoHeading: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  loadingState: { minHeight: 180, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  loadingText: { ...type.bodySoft, marginTop: spacing.md },
  retryButton: { minHeight: 44, marginHorizontal: spacing.lg, marginTop: -spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start" },
  retryText: { ...type.label, color: palette.accent },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
