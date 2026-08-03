import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Link2, ListPlus, Pencil, Play, Trash2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import type { Video } from "@/types";

type Tab = "saved" | "later" | "resume" | "queues" | "channels";
type LibraryVideoItem = { video: Video; progressSeconds?: number };

const TABS: { id: Tab; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "later", label: "Later" },
  { id: "resume", label: "Resume" },
  { id: "queues", label: "Queues" },
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
    queues,
    followedChannels,
    requirePurchase,
    createQueue,
    renameQueue,
    removeQueue,
    unfollowChannel,
  } = useApp();
  const [tab, setTab] = useState<Tab>("saved");
  const [queueModal, setQueueModal] = useState<{ mode: "create" | "rename"; id?: string } | null>(null);
  const [queueName, setQueueName] = useState<string>("");
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

  const openCreateQueue = useCallback((): void => {
    if (!requirePurchase()) return;
    setQueueName("");
    setQueueModal({ mode: "create" });
  }, [requirePurchase]);

  const openRenameQueue = useCallback((id: string, current: string): void => {
    setQueueName(current);
    setQueueModal({ mode: "rename", id });
  }, []);

  const submitQueue = useCallback(async (): Promise<void> => {
    if (!queueName.trim() || !queueModal) return;
    if (queueModal.mode === "create") await createQueue(queueName);
    else if (queueModal.id) await renameQueue(queueModal.id, queueName);
    setQueueName("");
    setQueueModal(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [createQueue, queueModal, queueName, renameQueue]);

  const confirmDeleteQueue = useCallback((id: string, name: string): void => {
    Alert.alert("Delete queue?", `“${name}” will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void removeQueue(id); } },
    ]);
  }, [removeQueue]);

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
        onPress={() => router.push("/session")}
        style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="library-session"
      >
        <Play size={15} color={palette.accent} strokeWidth={1.8} fill={palette.accent} />
        <Text style={styles.accentLabel}>Start a session from your library</Text>
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

  const queueContent = (
    <View>
      <Pressable onPress={openCreateQueue} style={({ pressed }) => [styles.newRow, pressed && styles.pressed]} accessibilityRole="button" testID="new-queue">
        <ListPlus size={18} color={palette.accent} strokeWidth={1.6} />
        <Text style={styles.accentLabel}>New queue</Text>
      </Pressable>
      {queues.length === 0 ? <EmptyState title="No queues" body="Create a sequence of videos for an evening." /> : queues.map((queue) => (
        <View key={queue.id} style={styles.queueCard}>
          <View style={styles.flex}>
            <Text style={type.caption}>{queue.orderedVideoIds.length} videos</Text>
            <Text style={styles.itemHeading}>{queue.name}</Text>
          </View>
          <Pressable onPress={() => openRenameQueue(queue.id, queue.name)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Rename ${queue.name}`}>
            <Pencil size={17} color={palette.inkMuted} strokeWidth={1.6} />
          </Pressable>
          <Pressable onPress={() => confirmDeleteQueue(queue.id, queue.name)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Delete ${queue.name}`}>
            <Trash2 size={17} color={palette.inkMuted} strokeWidth={1.6} />
          </Pressable>
        </View>
      ))}
    </View>
  );

  const channelContent = (
    <View>
      <Pressable onPress={() => setAddChannelOpen(true)} style={({ pressed }) => [styles.newRow, pressed && styles.pressed]} accessibilityRole="button" testID="library-add-channel">
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

  const emptyContent = tab === "queues" ? queueContent : tab === "channels" ? channelContent : videoEmpty;

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

      <Modal visible={queueModal !== null} animationType="fade" transparent onRequestClose={() => setQueueModal(null)}>
        <Pressable onPress={() => setQueueModal(null)} style={[styles.modalBackdrop, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalCard}>
            <Text style={type.caption}>{queueModal?.mode === "rename" ? "Rename queue" : "New queue"}</Text>
            <Text style={styles.itemHeading}>Name it</Text>
            <TextInput
              value={queueName}
              onChangeText={setQueueName}
              autoFocus
              placeholder="Evening at home"
              placeholderTextColor={palette.inkMuted}
              style={styles.modalInput}
              onSubmitEditing={() => { void submitQueue(); }}
              returnKeyType="done"
              accessibilityLabel="Queue name"
            />
            <Pressable onPress={() => { void submitQueue(); }} style={({ pressed }) => [styles.modalButton, pressed && styles.pressed]} accessibilityRole="button">
              <Text style={styles.modalButtonText}>{queueModal?.mode === "rename" ? "Save" : "Create"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
    sessionRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.page, marginTop: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    accentLabel: { ...type.label, color: palette.accent },
    tabsRow: { paddingHorizontal: spacing.page, marginTop: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
    tabButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: palette.surface },
    tabButtonActive: { backgroundColor: palette.accentDeep },
    tabLabel: { ...type.caption, fontSize: 10, color: palette.inkMuted },
    tabLabelActive: { color: palette.onDark },
    videoItem: { paddingHorizontal: spacing.page },
    emptyContent: { paddingHorizontal: spacing.page },
    newRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
    queueCard: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.surface, padding: spacing.md, marginBottom: spacing.md, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    itemHeading: { ...type.heading, marginTop: spacing.xs },
    iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.control },
    channelRow: { minHeight: 80, flexDirection: "row", alignItems: "center", backgroundColor: palette.surface, marginBottom: spacing.md, paddingRight: spacing.xs, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    channelMain: { minHeight: 80, flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
    channelAvatar: { width: 52, height: 52, borderRadius: radii.control, backgroundColor: palette.surfaceDeep, overflow: "hidden" },
    avatarImage: { width: "100%", height: "100%" },
    channelDescription: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted },
    modalBackdrop: { flex: 1, backgroundColor: palette.overlay, justifyContent: "center", paddingHorizontal: spacing.lg },
    modalCard: { ...softShadow, backgroundColor: palette.surfaceHigh, padding: spacing.lg, borderRadius: radii.large, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
    modalInput: { ...type.body, marginTop: spacing.lg, minHeight: 52, backgroundColor: palette.surface, paddingHorizontal: spacing.md, fontSize: 16, borderRadius: radii.control, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    modalButton: { minHeight: 50, marginTop: spacing.lg, backgroundColor: palette.accentDeep, borderRadius: radii.control, alignItems: "center", justifyContent: "center" },
    modalButtonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
    pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
