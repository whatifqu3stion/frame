import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ChevronRight, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { getTopicVideos } from "@/services/youtube";

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { interests, prefs, followedChannels } = useApp();
  const [active, setActive] = useState<string | null>(interests[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState<boolean>(false);

  const activeTopic = interests.find((i) => i.id === active) ?? interests[0] ?? null;

  const topicQuery = useQuery({
    queryKey: ["topic", activeTopic?.id, prefs.youtubeApiKey],
    queryFn: () => getTopicVideos(activeTopic!.id, prefs.youtubeApiKey),
    enabled: !!activeTopic,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Explore" title={"Curated\nfor you."} subtitle="No recommendations. Only the topics and channels you chose." />
      </View>

      <Pressable onPress={() => setAddOpen(true)} style={styles.addRow} testID="explore-add-channel">
        <View style={styles.addIcon}>
          <Plus size={16} color={palette.wall} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>Add a channel by link</Text>
          <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 1 }]}>Paste a channel or video URL.</Text>
        </View>
        <ChevronRight size={16} color={palette.inkMuted} />
      </Pressable>

      {followedChannels.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View style={[styles.sectionLabel, styles.sectionRow]}>
            <Text style={type.caption}>Your Channels</Text>
            <Pressable onPress={() => router.push("/(tabs)/library")} hitSlop={8}>
              <Text style={[type.caption, { color: palette.accent }]}>Manage →</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          >
            {followedChannels.map((c) => (
              <Pressable
                key={c.id}
                style={styles.channelTile}
                onPress={() => router.push({ pathname: "/channel/[id]", params: { id: c.id } })}
                testID={`explore-channel-${c.id}`}
              >
                <View style={styles.channelAvatar}>
                  {c.thumbnailUrl ? (
                    <Image source={{ uri: c.thumbnailUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : null}
                </View>
                <Text style={styles.channelName} numberOfLines={2}>{c.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {interests.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <EmptyState
            title="No topics yet"
            body="Add interests in Settings to populate this space with what you actually want to watch."
          />
          <Pressable onPress={() => router.push("/(tabs)/settings")} style={styles.linkRow}>
            <Text style={[type.label, { color: palette.accent }]}>Open Settings</Text>
            <ChevronRight size={14} color={palette.accent} />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.sectionLabel, styles.sectionRow, { marginTop: spacing.xl }]}>
            <Text style={type.caption}>Collections</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
          >
            {interests.map((t) => {
              const isActive = activeTopic?.id === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setActive(t.id)}
                  style={[styles.chip, isActive && styles.chipActive]}
                  testID={`topic-${t.id}`}
                >
                  <Text style={[styles.chipEmoji, isActive && { color: palette.wall }]}>{t.emoji}</Text>
                  <Text style={[styles.chipLabel, isActive && { color: palette.wall }]}>{t.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <View style={styles.sectionLabel}>
              <Text style={[type.heading, { fontSize: 18 }]}>{activeTopic?.name ?? ""}</Text>
            </View>
            {topicQuery.isLoading ? (
              <Text style={[type.bodySoft, { paddingVertical: spacing.lg }]}>Loading…</Text>
            ) : (topicQuery.data ?? []).length === 0 ? (
              <EmptyState title="Quiet topic" body="Nothing to show right now. Try another." />
            ) : (
              (topicQuery.data ?? []).map((v) => <VideoCard key={v.id} video={v} variant="wide" />)
            )}
          </View>
        </>
      )}

      <AddChannelModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: spacing.md },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: palette.surface,
  },
  addIcon: {
    width: 36,
    height: 36,
    backgroundColor: palette.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.surface,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: palette.ink },
  chipEmoji: { fontSize: 14, color: palette.accent },
  chipLabel: { ...type.label, fontSize: 13 },
  channelTile: { width: 120, marginRight: spacing.lg, alignItems: "flex-start" },
  channelAvatar: {
    width: 88,
    height: 88,
    backgroundColor: palette.surfaceDeep,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  channelName: { ...type.label, fontSize: 12, lineHeight: 16 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
});
