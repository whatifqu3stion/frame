import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "@/components/MediaImage";
import { useLocalSearchParams } from "expo-router";
import { Check, Plus, RotateCcw } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
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
  const touch = useFeedback();
  const followLock = useRef(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
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
  const videosMessage = videosQuery.isError ? "Videos couldn’t refresh. Check your connection and try again." : undefined;
  const following = id ? isChannelFollowed(id) : false;

  const toggleFollow = useCallback(async (): Promise<void> => {
    if (!channel || followLock.current) return;
    const done = touch.capture();
    followLock.current = true; setFollowBusy(true); setFeedback(null);
    try {
      if (following) { await unfollowChannel(channel.id); setFeedback("Source unfollowed. You can follow it again here."); }
      else if (requirePurchase("creators")) { await followChannel({ ...channel, followedAt: Date.now(), source: "manual" }); setFeedback("Source followed"); done("commit"); }
    } catch {
      Alert.alert("Source unchanged", "Owner authorization was cancelled or the source could not be updated.");
    } finally { followLock.current = false; setFollowBusy(false); }
  }, [channel, followChannel, following, requirePurchase, touch, unfollowChannel]);

  const retryUploads = useCallback((): void => {
    void videosQuery.refetch();
  }, [videosQuery]);

  const header = (
    <>
      <View style={styles.header}>
        <View style={styles.avatar}>
            <Image
              source={channel?.thumbnailUrl ? { uri: channel.thumbnailUrl } : null}
              style={styles.avatarImage}
              contentFit="cover"
              cachePolicy="none"
              recyclingKey={channel?.id}
            />
        </View>
        <Text style={type.caption}>Source</Text>
        <Text style={[type.title, styles.channelName]} accessibilityRole="header">{channel?.title ?? "—"}</Text>
        {channel?.description ? (
          <Text style={styles.description} numberOfLines={4}>{channel.description}</Text>
        ) : null}

        {channel ? (
          <Pressable
            onPress={() => { if (following) Alert.alert("Unfollow source?", "New videos from this source will stop appearing in Today. Saved videos stay in your library.", [{ text: "Cancel", style: "cancel" }, { text: "Unfollow", onPress: () => { void toggleFollow(); } }]); else void toggleFollow(); }}
            disabled={followBusy}
            style={({ pressed }) => [styles.followBtn, following && styles.followBtnActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: following, busy: followBusy, disabled: followBusy }}
            accessibilityLabel={following ? `Unfollow ${channel.title}` : `Follow ${channel.title}`}
            testID="follow-channel"
          >
            {followBusy ? <ActivityIndicator color={following ? palette.active : palette.onDark} /> : following ? <Check size={15} color={palette.active} strokeWidth={1.8} /> : <Plus size={15} color={palette.onDark} strokeWidth={1.8} />}
            <Text style={[styles.followText, { color: following ? palette.active : palette.onDark }]}>{followBusy ? "Updating…" : following ? "Following" : "Follow source"}</Text>
          </Pressable>
        ) : null}
      </View>
      {feedback ? <Text accessibilityLiveRegion="polite" style={[type.bodySoft, { marginHorizontal: spacing.lg, marginTop: spacing.md }]}>{feedback}</Text> : null}
      <View style={styles.videoHeading}>
        <Text style={type.caption}>Videos</Text>
        {videosMessage ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{videosMessage}</Text> : null}
      </View>
    </>
  );

  const empty = !canUseLibrary ? (
    <View style={styles.premiumGate}>
      <EmptyState title="Source browsing is part of Premium" body="Follow sources and browse their recent videos." />
      <Pressable onPress={() => requirePurchase("creators")} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.retryText}>See Premium</Text>
      </Pressable>
    </View>
  ) : videosQuery.isLoading ? (
    <VideoFeedSkeleton count={5} style={styles.loadingFeed} accessibilityLabel="Loading recent videos" />
  ) : videosQuery.data && videos.length === 0 ? (
    <EmptyState title="No recent videos available" body="No recent videos are available from this source. Try again later." />
  ) : (
    <View>
      <EmptyState title="Couldn't refresh uploads" body={videosMessage ?? "This source is still followed. Check your connection and try again."} />
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
      renderItem={({ item }) => <View style={{ paddingHorizontal: spacing.lg }}><VideoCard video={item} variant="wide" /></View>}
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
  retryButton: { minHeight: 48, marginHorizontal: spacing.lg, marginTop: -spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start" },
  retryText: { ...type.label, color: palette.accent },
  pressed: { opacity: 0.7 },
  });
}

