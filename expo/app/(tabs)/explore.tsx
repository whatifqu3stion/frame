import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ChevronRight, Plus, RotateCcw } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { discoveryService } from "@/services/discovery";
import type { Video } from "@/types";

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, interests, followedChannels, premiumAccessState, requirePurchase } = useApp();
  const [active, setActive] = useState<string | null>(interests[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState<boolean>(false);

  const activeTopic = interests.find((interest) => interest.id === active) ?? interests[0] ?? null;
  const topicQuery = useQuery({
    queryKey: ["topic", activeProfileId, activeTopic?.id],
    queryFn: () => discoveryService.getWeeklyPicks(activeProfileId, [activeTopic!.id]),
    enabled: !!activeTopic && premiumAccessState === "active",
  });
  const videos = useMemo<Video[]>(() => [], []);
  const topicMessage = topicQuery.data && "message" in topicQuery.data ? topicQuery.data.message : undefined;

  const chooseTopic = useCallback((id: string): void => {
    if (!requirePurchase("discovery")) return;
    void Haptics.selectionAsync().catch(() => {});
    setActive(id);
  }, [requirePurchase]);

  const openAddChannel = useCallback((): void => {
    if (!requirePurchase("creators")) return;
    setAddOpen(true);
  }, [requirePurchase]);

  const retryTopic = useCallback((): void => {
    void topicQuery.refetch();
  }, [topicQuery]);

  const listHeader = (
    <>
      <View style={styles.pageHeader}>
        <ScreenHeader eyebrow="Explore" title={"Curated\nfor you."} subtitle="No recommendations. Only the topics and channels you chose." />
      </View>

      <Pressable
        onPress={openAddChannel}
        style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="explore-add-channel"
      >
        <View style={styles.addIcon}><Plus size={16} color={palette.active} strokeWidth={2} /></View>
        <View style={styles.flex}>
          <Text style={type.label}>Add a channel by link</Text>
          <Text style={styles.addSubtitle}>Paste a channel or video URL.</Text>
        </View>
        <ChevronRight size={16} color={palette.inkMuted} />
      </Pressable>

      {followedChannels.length > 0 ? (
        <View style={styles.channelSection}>
          <View style={[styles.sectionLabel, styles.sectionRow]}>
            <Text style={type.caption}>Your Channels</Text>
            <Pressable onPress={() => router.push("/(tabs)/library")} style={styles.textAction} accessibilityRole="button">
              <Text style={styles.accentCaption}>Manage →</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalContent}>
            {followedChannels.map((channel) => (
              <Pressable
                key={channel.id}
                style={({ pressed }) => [styles.channelTile, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Open ${channel.title} channel`}
                testID={`explore-channel-${channel.id}`}
              >
                <View style={styles.channelAvatar}>
                  {channel.thumbnailUrl ? (
                    <Image source={{ uri: channel.thumbnailUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={channel.id} />
                  ) : null}
                </View>
                <Text style={styles.channelName} numberOfLines={2}>{channel.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {interests.length === 0 ? (
        <View style={styles.noTopics}>
          <EmptyState title="No topics yet" body="Add interests in Settings to populate this space with what you actually want to watch." />
          <Pressable onPress={() => router.push("/(tabs)/settings")} style={styles.linkRow} accessibilityRole="button">
            <Text style={styles.accentLabel}>Open Settings</Text>
            <ChevronRight size={14} color={palette.accent} />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.sectionLabel, styles.sectionRow, styles.collectionsHeader]}>
            <Text style={type.caption}>Collections</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            {interests.map((interest) => {
              const isActive = activeTopic?.id === interest.id;
              return (
                <Pressable
                  key={interest.id}
                  onPress={() => chooseTopic(interest.id)}
                  style={({ pressed }) => [styles.chip, isActive && styles.chipActive, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  testID={`topic-${interest.id}`}
                >
                  <Text style={[styles.chipLabel, isActive && styles.chipContentActive]}>{interest.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.topicHeading}>
            <Text style={styles.topicTitle} accessibilityRole="header">{activeTopic?.name ?? ""}</Text>
          </View>
        </>
      )}
    </>
  );

  const listEmpty = premiumAccessState !== "active" ? (
    <View style={styles.premiumGate}>
      <EmptyState title="Explore is part of Premium" body="Choose the topics and creators you trust, without opening an endless feed." />
      <Pressable onPress={() => requirePurchase("discovery")} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.accentLabel}>See Premium</Text>
        <ChevronRight size={14} color={palette.accent} />
      </Pressable>
    </View>
  ) : interests.length === 0 ? null : topicQuery.isLoading ? (
    <VideoFeedSkeleton count={5} accessibilityLabel="Loading discovery availability" />
  ) : (
    <View>
      <EmptyState title="Discovery is unavailable" body={topicMessage ?? "Bounded weekly discovery is not available yet."} />
      <Pressable onPress={retryTopic} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} accessibilityRole="button">
        <RotateCcw size={16} color={palette.accent} />
        <Text style={styles.accentLabel}>Try again</Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <FlatList<Video>
        data={videos}
        keyExtractor={(video) => video.id}
        renderItem={({ item }) => <VideoCard video={item} variant="wide" />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        refreshing={topicQuery.isRefetching}
        onRefresh={activeTopic ? retryTopic : undefined}
        style={styles.list}
      />
      <AddChannelModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    list: { flex: 1, backgroundColor: palette.wall },
    listContent: { flexGrow: 1, paddingHorizontal: spacing.page },
    pageHeader: { marginBottom: spacing.md },
    flex: { flex: 1 },
    sectionLabel: { marginBottom: spacing.md },
    sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    addRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, padding: spacing.md, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
    addIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: palette.activeSoft, justifyContent: "center", alignItems: "center" },
    addSubtitle: { ...type.bodySoft, color: palette.inkMuted, marginTop: 1 },
    channelSection: { marginTop: spacing.xl, marginHorizontal: -spacing.page },
    horizontalContent: { paddingHorizontal: spacing.page },
    textAction: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
    accentCaption: { ...type.caption, color: palette.accent },
    channelTile: { width: 120, marginRight: spacing.lg, alignItems: "flex-start" },
    channelAvatar: { width: 88, height: 88, borderRadius: radii.card, backgroundColor: palette.surfaceDeep, overflow: "hidden", marginBottom: spacing.sm, borderWidth: 1, borderColor: palette.borderSoft },
    avatarImage: { width: "100%", height: "100%" },
    channelName: { ...type.label, fontSize: 12, lineHeight: 16 },
    noTopics: { marginTop: spacing.xl },
    linkRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, marginTop: -spacing.md, alignSelf: "flex-start" },
    accentLabel: { ...type.label, color: palette.accent },
    collectionsHeader: { marginTop: spacing.xl },
    chipsContent: { paddingVertical: spacing.sm },
    chip: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 14, backgroundColor: palette.surface, marginRight: spacing.sm, borderRadius: radii.pill, borderWidth: 1, borderColor: palette.borderSoft },
    chipActive: { backgroundColor: palette.activeSoft, borderColor: palette.active },
    chipLabel: { ...type.label, fontSize: 13 },
    chipContentActive: { color: palette.active },
    topicHeading: { marginTop: spacing.lg, marginBottom: spacing.md },
    topicTitle: { ...type.heading, fontSize: 20 },
    premiumGate: { paddingTop: spacing.lg },
    retryButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -spacing.lg, alignSelf: "flex-start" },
    pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
