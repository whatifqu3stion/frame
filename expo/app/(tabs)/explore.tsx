import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { getTopicVideos } from "@/services/youtube";
import { ChevronRight } from "lucide-react-native";

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { interests, prefs } = useApp();
  const [active, setActive] = useState<string | null>(interests[0]?.id ?? null);

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
        <ScreenHeader eyebrow="Explore" title={"Topics\nyou chose."} subtitle="No recommendations. Only the interests you set." />
      </View>

      {interests.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <EmptyState
            title="No topics yet"
            body="Add interests in Settings to populate this space with what you actually want to watch."
          />
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={styles.linkRow}
          >
            <Text style={[type.label, { color: palette.accent }]}>Open Settings</Text>
            <ChevronRight size={14} color={palette.accent} />
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}
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
              <Text style={type.caption}>{activeTopic?.name ?? ""}</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: spacing.md },
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
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
  },
});
