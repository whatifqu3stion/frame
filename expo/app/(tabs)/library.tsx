import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ChevronRight, Link2, ListPlus, Play, Trash2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import type { Video } from "@/types";

type Tab = "saved" | "later" | "resume" | "sessions" | "channels";
type LibraryVideoItem = { video: Video; progressSeconds?: number };

const TABS: { id: Tab; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "later", label: "Later" },
  { id: "resume", label: "Resume" },
  { id: "sessions", label: "Sessions" },
  { id: "channels", label: "Channels" },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const {
    savedVideos,
    watchLater,
    resumeList,
    sessions,
    followedChannels,
    libraryLoading,
    requirePurchase,
    unfollowChannel,
  } = useApp();
  const [tab, setTab] = useState<Tab>("saved");
  const [addChannelOpen, setAddChannelOpen] = useState<boolean>(false);

  const videoItems = useMemo<LibraryVideoItem[]>(() => {
    if (tab === "saved") return savedVideos.map((video) => ({ video }));
    if (tab === "later") return watchLater.map((video) => ({ video }));
    if (tab !== "resume") return [];

    return resumeList.flatMap((resume): LibraryVideoItem[] => {
      const video = savedVideos.find((candidate) => candidate.id === resume.videoId)
        ?? watchLater.find((candidate) => candidate.id === resume.videoId)
        ?? (resume.title ? {
          id: resume.videoId,
          title: resume.title,
          channelTitle: resume.channelTitle ?? "",
          channelId: "",
          thumbnailUrl: resume.thumbnailUrl ?? `https://i.ytimg.com/vi/${resume.videoId}/hqdefault.jpg`,
          publishedAt: "",
          durationSeconds: resume.durationSeconds ?? 0,
        } : null);
      return video ? [{ video, progressSeconds: resume.timestampSeconds }] : [];
    });
  }, [resumeList, savedVideos, tab, watchLater]);

  const chooseTab = useCallback((nextTab: Tab): void => {
    void Haptics.selectionAsync().catch(() => {});
    setTab(nextTab);
  }, []);

  const openNewSession = useCallback((): void => {
    if (!requirePurchase("sessions")) return;
    router.push("/session");
  }, [requirePurchase]);

  const openAddChannel = useCallback((): void => {
    if (!requirePurchase("creators")) return;
    setAddChannelOpen(true);
  }, [requirePurchase]);

  const openSession = useCallback((id: string): void => {
    if (!requirePurchase("sessions")) return;
    router.push({ pathname: "/session/[id]", params: { id } });
  }, [requirePurchase]);

  const confirmUnfollow = useCallback((id: string, name: string): void => {
    Alert.alert("Unfollow channel?", `“${name}” will be removed from your shelf.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Unfollow", style: "destructive", onPress: () => { void unfollowChannel(id); } },
    ]);
  }, [unfollowChannel]);

  const header = (
    <>
      <View style={styles.pageHeader}>
        <ScreenHeader eyebrow="Library" title={"Your\nshelf."} subtitle="Only what you chose to keep." />
      </View>
      <Pressable
        onPress={openNewSession}
        style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="library-session"
      >
        <Play size={15} color={palette.accent} strokeWidth={1.8} fill={palette.accent} />
        <Text style={styles.accentLabel}>Create a named session from your library</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => chooseTab(item.id)}
              style={[styles.tabButton, selected && styles.tabButtonActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              testID={`library-tab-${item.id}`}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );

  const videoEmpty = tab === "saved" ? (
    <EmptyState title="Nothing saved" body="Save a video while watching and it lives here, forever." />
  ) : tab === "later" ? (
    <EmptyState title="Watch Later is empty" body="Tap “Later” while watching to set something aside for a calmer moment." />
  ) : (
    <EmptyState title="No half-watched videos" body="Frame remembers where you stopped." />
  );

  const sessionContent = (
    <View>
      <Pressable onPress={openNewSession} style={({ pressed }) => [styles.newRow, pressed && styles.pressed]} accessibilityRole="button" testID="new-session">
        <ListPlus size={18} color={palette.accent} strokeWidth={1.6} />
        <Text style={styles.accentLabel}>New named session</Text>
      </Pressable>
      {sessions.length === 0 ? <EmptyState title="No named sessions" body="Create a reusable one-to-three-video plan for a quiet sitting." /> : sessions.map((session) => (
        <Pressable
          key={session.id}
          onPress={() => openSession(session.id)}
          style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open ${session.name}`}
        >
          <View style={styles.flex}>
            <Text style={type.caption}>{session.orderedVideoIds.length} of 3 videos</Text>
            <Text style={styles.itemHeading}>{session.name}</Text>
          </View>
          <ChevronRight size={18} color={palette.inkMuted} strokeWidth={1.7} />
        </Pressable>
      ))}
    </View>
  );

  const channelContent = (
    <View>
      <Pressable onPress={openAddChannel} style={({ pressed }) => [styles.newRow, pressed && styles.pressed]} accessibilityRole="button" testID="library-add-channel">
        <Link2 size={18} color={palette.accent} strokeWidth={1.6} />
        <Text style={styles.accentLabel}>Add a channel by link</Text>
      </Pressable>
      {followedChannels.length === 0 ? <EmptyState title="No followed channels" body="Paste a channel or video link above, or follow channels while you watch." /> : followedChannels.map((channel) => (
        <View key={channel.id} style={styles.channelRow}>
          <Pressable
            onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })}
            style={({ pressed }) => [styles.channelMain, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${channel.title} channel`}
            testID={`followed-${channel.id}`}
          >
            <View style={styles.channelAvatar}>
              {channel.thumbnailUrl ? <Image source={{ uri: channel.thumbnailUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={channel.id} /> : null}
            </View>
            <View style={styles.flex}>
              <Text style={type.heading} numberOfLines={1}>{channel.title}</Text>
              {channel.description ? <Text style={styles.channelDescription} numberOfLines={1}>{channel.description}</Text> : null}
            </View>
          </Pressable>
          <Pressable onPress={() => confirmUnfollow(channel.id, channel.title)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Unfollow ${channel.title}`}>
            <Trash2 size={17} color={palette.inkMuted} strokeWidth={1.6} />
          </Pressable>
        </View>
      ))}
    </View>
  );

  const isVideoTab = tab === "saved" || tab === "later" || tab === "resume";
  const emptyContent = isVideoTab && libraryLoading
    ? <VideoFeedSkeleton count={5} accessibilityLabel="Loading your library" />
    : tab === "sessions"
      ? sessionContent
      : tab === "channels"
        ? channelContent
        : videoEmpty;

  return (
    <>
      <FlatList<LibraryVideoItem>
        data={videoItems}
        keyExtractor={(item) => item.video.id}
        renderItem={({ item }) => (
          <View style={styles.videoItem}>
            <VideoCard video={item.video} variant="wide" progressSeconds={item.progressSeconds} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={styles.emptyContent}>{emptyContent}</View>}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={7}
        maxToRenderPerBatch={7}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        style={styles.list}
      />

      <AddChannelModal visible={addChannelOpen} onClose={() => setAddChannelOpen(false)} />
    </>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: palette.wall },
    listContent: { flexGrow: 1 },
    pageHeader: { paddingHorizontal: spacing.page },
    flex: { flex: 1 },
    sessionRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.page, marginTop: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
    accentLabel: { ...type.label, color: palette.accent },
    tabsRow: { paddingHorizontal: spacing.page, marginTop: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
    tabButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: palette.surface },
    tabButtonActive: { backgroundColor: palette.activeSoft, borderWidth: 1, borderColor: palette.active },
    tabLabel: { ...type.caption, fontSize: 10, color: palette.inkMuted },
    tabLabelActive: { color: palette.active },
    videoItem: { paddingHorizontal: spacing.page },
    emptyContent: { paddingHorizontal: spacing.page },
    newRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
    sessionCard: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.surface, padding: spacing.md, marginBottom: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
    itemHeading: { ...type.heading, marginTop: spacing.xs },
    iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.control },
    channelRow: { minHeight: 80, flexDirection: "row", alignItems: "center", backgroundColor: palette.surface, marginBottom: spacing.md, paddingRight: spacing.xs, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
    channelMain: { minHeight: 80, flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
    channelAvatar: { width: 52, height: 52, borderRadius: radii.control, backgroundColor: palette.surfaceDeep, overflow: "hidden" },
    avatarImage: { width: "100%", height: "100%" },
    channelDescription: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted },
    pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
