import { router } from "expo-router";
import { ListPlus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { SAMPLE_VIDEOS } from "@/constants/sampleData";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";

type Tab = "saved" | "resume" | "queues";

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { savedVideos, resumeList, queues, requirePurchase, createQueue, removeQueue, prefs } = useApp();
  const [tab, setTab] = useState<Tab>("saved");
  const [newQueueOpen, setNewQueueOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");

  const onNewQueue = () => {
    if (!prefs.hasPurchased && !requirePurchase()) return;
    setNewQueueOpen(true);
  };

  const submitNewQueue = async () => {
    if (!newName.trim()) return;
    await createQueue(newName);
    setNewName("");
    setNewQueueOpen(false);
  };

  const confirmDeleteQueue = (id: string, name: string) => {
    Alert.alert("Delete queue?", `“${name}” will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeQueue(id) },
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

      <View style={styles.tabsRow}>
        {(["saved", "resume", "queues"] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tabButton} testID={`library-tab-${t}`}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === "saved" ? "Saved" : t === "resume" ? "Resume" : "Queues"}
            </Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        {tab === "saved" && (
          savedVideos.length === 0 ? (
            <EmptyState title="Nothing saved" body="Save a video while watching and it lives here, forever." />
          ) : (
            savedVideos.map((v) => <VideoCard key={v.id} video={v} variant="wide" />)
          )
        )}

        {tab === "resume" && (
          resumeList.length === 0 ? (
            <EmptyState title="No half-watched videos" body="Frame remembers where you stopped." />
          ) : (
            resumeList.map((r) => {
              const v = savedVideos.find((s) => s.id === r.videoId)
                ?? SAMPLE_VIDEOS.find((s) => s.id === r.videoId)
                ?? (r.title ? {
                  id: r.videoId,
                  title: r.title ?? "",
                  channelTitle: r.channelTitle ?? "",
                  channelId: "",
                  thumbnailUrl: r.thumbnailUrl ?? "",
                  publishedAt: new Date(r.updatedAt).toISOString(),
                  durationSeconds: r.durationSeconds ?? 0,
                } : null);
              if (!v) return null;
              return <VideoCard key={r.videoId} video={v} variant="wide" progressSeconds={r.timestampSeconds} />;
            })
          )
        )}

        {tab === "queues" && (
          <>
            <Pressable onPress={onNewQueue} style={styles.newQueueRow} testID="new-queue">
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
                  <Pressable onPress={() => confirmDeleteQueue(q.id, q.name)} hitSlop={8}>
                    <Trash2 size={16} color={palette.inkMuted} strokeWidth={1.6} />
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}
      </View>

      <Modal visible={newQueueOpen} animationType="fade" transparent onRequestClose={() => setNewQueueOpen(false)}>
        <Pressable onPress={() => setNewQueueOpen(false)} style={styles.modalBackdrop}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <Text style={type.caption}>New Queue</Text>
            <Text style={[type.heading, { marginTop: spacing.xs }]}>Name it</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              autoFocus
              placeholder="Evening at home"
              placeholderTextColor={palette.inkMuted}
              style={styles.modalInput}
              onSubmitEditing={submitNewQueue}
              returnKeyType="done"
            />
            <Pressable onPress={submitNewQueue} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Create</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
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
    backgroundColor: palette.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
