import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowRight, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { discoveryService } from "@/services/discovery";

type SourcesSection = "followed" | "discover";

export default function SourcesScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, interests, followedChannels, libraryLoading, sourcesError, requirePurchase } = useApp();
  const [section, setSection] = useState<SourcesSection>("followed");
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const discoverQuery = useQuery({
    queryKey: ["weekly-picks", activeProfileId, interests.map((interest) => interest.id).join(",")],
    queryFn: () => discoveryService.getWeeklyPicks(activeProfileId, interests.map((interest) => interest.id)),
    enabled: section === "discover",
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const openAddSource = (): void => {
    if (!requirePurchase("creators")) return;
    setAddOpen(true);
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <ScreenHeader eyebrow="Sources" title={"People you\nchoose."} subtitle="Follow trusted sources directly. Frame does not expand this list for you." />
          <View style={styles.segmented} accessibilityRole="tablist">
            {(["followed", "discover"] as const).map((item) => {
              const selected = section === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setSection(item)}
                  style={[styles.segment, selected && styles.segmentActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item === "followed" ? "Followed sources" : "Discover weekly picks"}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{item === "followed" ? "Followed" : "Discover"}</Text>
                </Pressable>
              );
            })}
          </View>

          {section === "followed" ? (
            <View style={styles.section}>
              <Pressable onPress={openAddSource} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} accessibilityRole="button" testID="sources-add-source">
                <View style={styles.addIcon}><Plus size={17} color={palette.active} strokeWidth={2} /></View>
                <View style={styles.flex}>
                  <Text style={type.label}>Add a trusted source</Text>
                  <Text style={styles.supporting}>Paste a supported channel, handle, or video link.</Text>
                </View>
                <ArrowRight size={17} color={palette.inkMuted} />
              </Pressable>

              {libraryLoading ? (
                <VideoFeedSkeleton count={3} accessibilityLabel="Loading followed sources" />
              ) : sourcesError ? (
                <EmptyState title="Sources couldn't load" body="Your saved source data was not changed. Close and reopen Frame to try again." />
              ) : followedChannels.length === 0 ? (
                <EmptyState title="No followed sources" body="Add one trusted source manually. Nothing is imported or followed automatically." />
              ) : (
                <View style={styles.sourceList}>
                  {followedChannels.map((channel) => (
                    <Pressable
                      key={channel.id}
                      onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })}
                      style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${channel.title} source`}
                      testID={`source-${channel.id}`}
                    >
                      <View style={styles.avatar}>
                        {channel.thumbnailUrl ? <Image source={{ uri: channel.thumbnailUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={channel.id} /> : null}
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.sourceName} numberOfLines={2}>{channel.title}</Text>
                        <Text style={styles.supporting}>Open recent videos</Text>
                      </View>
                      <ArrowRight size={17} color={palette.inkMuted} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.weeklyHeader}>
                <Text style={type.caption}>Weekly picks</Text>
                <Text style={styles.limitLabel}>FINITE · WEEKLY</Text>
              </View>
              {discoverQuery.isLoading && discoverQuery.fetchStatus !== "idle" ? (
                <VideoFeedSkeleton count={3} accessibilityLabel="Loading weekly picks" />
              ) : discoverQuery.data?.status === "network_error" ? (
                <EmptyState title="Discover is offline" body="Weekly picks need the shared Frame service. No source was searched or polled." />
              ) : discoverQuery.isError || discoverQuery.data?.status === "temporarily_unavailable" ? (
                <EmptyState title="Discover couldn't load" body="The weekly service is unavailable. No replacement recommendations were generated." />
              ) : (
                <EmptyState title="Weekly picks are unavailable" body={discoverQuery.data?.message ?? "A small recommendation set will live here when the shared backend exists. Until then, this area stays honestly empty."} />
              )}
              <View style={styles.endState} accessible accessibilityLabel="End of weekly picks">
                <View style={styles.endLine} />
                <Text style={styles.endText}>End of weekly picks</Text>
                <View style={styles.endLine} />
              </View>
              <Text style={styles.discoverNote}>Future sets will be bounded and refreshed no more than once every {PRODUCT_LIMITS.discoveryCadenceDays} days.</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <AddChannelModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    page: { paddingHorizontal: spacing.page },
    flex: { flex: 1 },
    segmented: { minHeight: 48, flexDirection: "row", padding: 3, borderRadius: radii.control, backgroundColor: palette.surfaceDeep },
    segment: { minHeight: 44, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.small },
    segmentActive: { backgroundColor: palette.surfaceHigh, borderWidth: 1, borderColor: palette.borderSoft },
    segmentText: { ...type.label, color: palette.inkMuted },
    segmentTextActive: { color: palette.active },
    section: { marginTop: spacing.lg },
    addButton: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    addIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: palette.activeSoft },
    supporting: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    sourceList: { gap: spacing.sm },
    sourceRow: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    avatar: { width: 52, height: 52, overflow: "hidden", borderRadius: radii.control, backgroundColor: palette.surfaceDeep },
    avatarImage: { width: "100%", height: "100%" },
    sourceName: { ...type.heading, fontSize: 17, lineHeight: 22 },
    weeklyHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    limitLabel: { ...type.caption, color: palette.active, fontSize: 9 },
    endState: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
    endLine: { flex: 1, height: 1, backgroundColor: palette.borderSoft },
    endText: { ...type.caption, color: palette.inkMuted },
    discoverNote: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
    pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  });
}
