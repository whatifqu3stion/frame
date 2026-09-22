import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Check, Plus, RotateCcw } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { cachedContentService } from "@/services/youtube";
import { expireChannel, isMetadataCurrent } from "@/domain/metadataRetention";
import { refreshStoredLibraryMetadata } from "@/db/database";
import type { Video } from "@/types";

export default function ChannelScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProfileId, followedChannels, isChannelFollowed, followChannel, unfollowChannel, canUseLibrary, requirePurchase } = useApp();

  const videosQuery = useQuery({
    queryKey: ["cached-channel", activeProfileId, id],
    queryFn: async () => {
      const shelf = await cachedContentService.getChannelShelf(id);
      await refreshStoredLibraryMetadata(activeProfileId, shelf.videos, { ...shelf.channel, followedAt: 0, source: "manual" });
      await queryClient.invalidateQueries({ queryKey: ["library", activeProfileId] });
      return shelf;
    },
    enabled: !!id && canUseLibrary,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const savedChannel = followedChannels.find((candidate) => candidate.id === id);
  const rawChannel = videosQuery.data?.channel ?? savedChannel;
  const channel = rawChannel ? expireChannel(rawChannel, Date.now()) : undefined;
  const videos = (videosQuery.data?.videos ?? []).filter((video) => isMetadataCurrent(video.fetchedAt, Date.now()));
  const videosMessage = videosQuery.error instanceof Error ? videosQuery.error.message : videosQuery.data?.message;
  const following = id ? isChannelFollowed(id) : false;

  const toggleFollow = useCallback(async (): Promise<void> => {
    if (!channel) return;
    try {
      if (following) await unfollowChannel(channel.id);
      else if (requirePurchase("creators")) await followChannel({ ...channel, followedAt: Date.now(), source: "manual" });
    } catch {
      Alert.alert("Source unchanged", "Owner authorization was cancelled or the source could not be updated.");
    }
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
              cachePolicy="none"
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
            {following ? <Check size={15} color={palette.active} strokeWidth={1.8} /> : <Plus size={15} color={palette.onDark} strokeWidth={1.8} />}
            <Text style={[styles.followText, { color: following ? palette.active : palette.onDark }]}>{following ? "Following" : "Follow channel"}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.videoHeading}>
        <Text style={type.caption}>Videos</Text>
        {videosMessage ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{videosMessage}</Text> : null}
      </View>
    </>
  );

  const empty = !canUseLibrary ? (
    <View style={styles.premiumGate}>
      <EmptyState title="Creator shelves are part of Premium" body="Follow trusted channels and browse their recent verified uploads without a recommendation feed." />
      <Pressable onPress={() => requirePurchase("creators")} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.retryText}>See Premium</Text>
      </Pressable>
    </View>
  ) : videosQuery.isLoading ? (
    <VideoFeedSkeleton count={5} style={styles.loadingFeed} accessibilityLabel="Loading verified uploads" />
  ) : videosQuery.data && videos.length === 0 ? (
    <EmptyState title="No playable recent uploads" body={videosQuery.data.message} />
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
  followBtnActive: { backgroundColor: palette.activeSoft, borderWidth: 1, borderColor: palette.active },
  followText: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  videoHeading: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  loadingFeed: { paddingHorizontal: spacing.lg },
  premiumGate: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  retryButton: { minHeight: 44, marginHorizontal: spacing.lg, marginTop: -spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start" },
  retryText: { ...type.label, color: palette.accent },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
