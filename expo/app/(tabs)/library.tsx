import { router } from "expo-router";
import { Image } from "expo-image";
import { Link2, ListPlus, Pencil, Play, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { SAMPLE_VIDEOS } from "@/constants/sampleData";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import type { Video } from "@/types";

type Tab = "saved" | "later" | "resume" | "queues" | "channels";

const TABS: { id: Tab; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "later", label: "Later" },
  { id: "resume", label: "Resume" },
  { id: "queues", label: "Queues" },
  { id: "channels", label: "Channels" },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
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

  const openCreateQueue = () => {
    if (!requirePurchase()) return;
    setQueueName("");
    setQueueModal({ mode: "create" });
  };

  const openRenameQueue = (id: string, current: string) => {
    setQueueName(current);
    setQueueModal({ mode: "rename", id });
  };

  const submitQueue = async () => {
    if (!queueName.trim() || !queueModal) return;
    if (queueModal.mode === "create") {
      await createQueue(queueName);
    } else if (queueModal.id) {
      await renameQueue(queueModal.id, queueName);
    }
    setQueueName("");
    setQueueModal(null);
  };

  const confirmDeleteQueue = (id: string, name: string) => {
    Alert.alert("Delete queue?", `“${name}” will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeQueue(id) },
    ]);
  };

  const confirmUnfollow = (id: string, name: string) => {
    Alert.alert("Unfollow channel?", `“${name}” will be removed from your shelf.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Unfollow", style: "destructive", onPress: () => unfollowChannel(id) },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Library" title={"Your\nshelf."} subtitle="Only what you chose to keep." />
      </View>

      <Pressable onPress={() => router.push("/session")} style={styles.sessionRow} testID="library-session">
        <Play size={15} color={palette.accent} strokeWidth={1.8} fill={palette.accent} />
        <Text style={[type.label, { color: palette.accent }]}>Start a session from your library</Text>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tabButton} testID={`library-tab-${t.id}`}>
            <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
            {tab === t.id && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        {tab === "saved" && (
          savedVideos.length === 0 ? (
            <EmptyState title="Nothing saved" body="Save a video while watching and it lives here, forever." />
          ) : (
            savedVideos.map((v) => <VideoCard key={v.id} video={v} variant="wide" />)
          )
        )}

        {tab === "later" && (
          watchLater.length === 0 ? (
            <EmptyState title="Watch Later is empty" body="Tap “Later” while watching to set something aside for a calmer moment." />
          ) : (
            watchLater.map((v) => <VideoCard key={v.id} video={v} variant="wide" />)
          )
        )}

        {tab === "resume" && (
          resumeList.length === 0 ? (
            <EmptyState title="No half-watched videos" body="Frame remembers where you stopped." />
          ) : (
            resumeList.map((r) => {
              const v: Video | null = savedVideos.find((s) => s.id === r.videoId)
                ?? watchLater.find((s) => s.id === r.videoId)
                ?? SAMPLE_VIDEOS.find((s) => s.id === r.videoId)
                ?? (r.title ? {
                  id: r.videoId,
                  title: r.title ?? "",
                  channelTitle: r.channelTitle ?? "",
                  channelId: "",
                  thumbnailUrl: r.thumbnailUrl ?? "",
                  publishedAt: "",
                  durationSeconds: r.durationSeconds ?? 0,
                } : null);
              if (!v) return null;
              return <VideoCard key={r.videoId} video={v} variant="wide" progressSeconds={r.timestampSeconds} />;
            })
          )
        )}

        {tab === "queues" && (
          <>
            <Pressable onPress={openCreateQueue} style={styles.newQueueRow} testID="new-queue">
              <ListPlus size={18} color={palette.accent} strokeWidth={1.6} />
              <Text style={[type.label, { color: palette.accent }]}>New queue</Text>
            </Pressable>
            {queues.length === 0 ? (
              <EmptyState title="No queues" body="Create a sequence of videos for an evening." />
            ) : (
              queues.map((q) => (
                <View key={q.id} style={styles.queueCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.caption}>{q.orderedVideoIds.length} videos</Text>
                    <Text style={[type.heading, { marginTop: spacing.xs }]}>{q.name}</Text>
                  </View>
                  <Pressable onPress={() => openRenameQueue(q.id, q.name)} hitSlop={8} style={styles.queueAction}>
                    <Pencil size={15} color={palette.inkMuted} strokeWidth={1.6} />
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteQueue(q.id, q.name)} hitSlop={8} style={styles.queueAction}>
                    <Trash2 size={15} color={palette.inkMuted} strokeWidth={1.6} />
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}

        {tab === "channels" && (
          <Pressable onPress={() => setAddChannelOpen(true)} style={styles.newQueueRow} testID="library-add-channel">
            <Link2 size={18} color={palette.accent} strokeWidth={1.6} />
            <Text style={[type.label, { color: palette.accent }]}>Add a channel by link</Text>
          </Pressable>
        )}

        {tab === "channels" && (
          followedChannels.length === 0 ? (
            <EmptyState title="No followed channels" body="Paste a channel or video link above, or follow channels while you watch." />
          ) : (
            followedChannels.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: "/channel/[id]", params: { id: c.id } })}
                style={styles.channelRow}
                testID={`followed-${c.id}`}
              >
                <View style={styles.channelAvatar}>
                  {c.thumbnailUrl ? (
                    <Image source={{ uri: c.thumbnailUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.heading} numberOfLines={1}>{c.title}</Text>
                  {c.description ? (
                    <Text style={[type.bodySoft, { marginTop: 2, color: palette.inkMuted }]} numberOfLines={1}>{c.description}</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => confirmUnfollow(c.id, c.title)} hitSlop={8} style={styles.queueAction}>
                  <Trash2 size={15} color={palette.inkMuted} strokeWidth={1.6} />
                </Pressable>
              </Pressable>
            ))
          )
        )}
      </View>

      <Modal visible={queueModal !== null} animationType="fade" transparent onRequestClose={() => setQueueModal(null)}>
        <Pressable onPress={() => setQueueModal(null)} style={styles.modalBackdrop}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <Text style={type.caption}>{queueModal?.mode === "rename" ? "Rename queue" : "New queue"}</Text>
            <Text style={[type.heading, { marginTop: spacing.xs }]}>Name it</Text>
            <TextInput
              value={queueName}
              onChangeText={setQueueName}
              autoFocus
              placeholder="Evening at home"
              placeholderTextColor={palette.inkMuted}
              style={styles.modalInput}
              onSubmitEditing={submitQueue}
              returnKeyType="done"
            />
            <Pressable onPress={submitQueue} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>{queueModal?.mode === "rename" ? "Save" : "Create"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <AddChannelModal visible={addChannelOpen} onClose={() => setAddChannelOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.surface,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.xl,
  },
  tabButton: { paddingVertical: spacing.xs },
  tabLabel: {
    ...type.caption,
    fontSize: 11,
    color: palette.inkMuted,
  },
  tabLabelActive: { color: palette.ink },
  tabUnderline: { height: 2, backgroundColor: palette.accent, marginTop: spacing.xs },
  newQueueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  queueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  queueAction: { padding: spacing.xs },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  channelAvatar: {
    width: 52,
    height: 52,
    backgroundColor: palette.surfaceDeep,
    overflow: "hidden",
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(26,28,26,0.4)", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: palette.wall, padding: spacing.lg },
  modalInput: {
    ...type.body,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  modalButton: {
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalButtonText: { color: palette.wall, fontFamily: "Georgia", fontSize: 15 },
});
