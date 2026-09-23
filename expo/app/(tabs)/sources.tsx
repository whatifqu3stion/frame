import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowRight, Import, Plus, SlidersHorizontal } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import WeeklyPickCard from "@/components/WeeklyPickCard";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { FOUNDATION_CAPABILITIES, PRODUCT_LIMITS, WEEKLY_DISCOVERY_DISPLAY_MAX } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { discoveryService, shouldRequestWeeklyPicks, weeklyDiscoveryPeriodKey, weeklyPickToSourceResolution } from "@/services/discovery";
import type { WeeklyPickSourceSuggestion } from "@/types";

type SourcesSection = "followed" | "discover";

export default function SourcesScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, interests, followedChannels, libraryLoading, sourcesError, googleConfigured, googleConnected, signInWithGoogle, confirmSource } = useApp();
  const [section, setSection] = useState<SourcesSection>("followed");
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [googleBusy, setGoogleBusy] = useState<boolean>(false);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);
  const [followFeedback, setFollowFeedback] = useState<Record<string, { ok: boolean; message: string }>>({});
  const activeProfileRef = useRef(activeProfileId);
  const interestIds = interests.map((interest) => interest.id);
  const interestNames = useMemo(() => new Map(INTEREST_LIBRARY.map((interest) => [interest.id, interest.name])), []);
  const followedIds = useMemo(() => new Set(followedChannels.map((channel) => channel.id)), [followedChannels]);
  const weeklyPeriod = weeklyDiscoveryPeriodKey();
  const discoverQuery = useQuery({
    queryKey: ["weekly-picks", activeProfileId, interestIds.join(","), weeklyPeriod],
    queryFn: () => discoveryService.getWeeklyPicks(activeProfileId, interestIds),
    enabled: section === "discover" && shouldRequestWeeklyPicks(interestIds),
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    activeProfileRef.current = activeProfileId;
    setFollowBusyId(null);
    setFollowFeedback({});
  }, [activeProfileId]);

  const openAddSource = (): void => {
    setAddOpen(true);
  };

  const openGoogleImport = async (): Promise<void> => {
    if (googleConnected) { router.push("/google-import"); return; }
    setGoogleBusy(true);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (result.ok) router.push("/google-import");
    else Alert.alert("Google connection", result.message);
  };

  const followWeeklyPick = async (suggestion: WeeklyPickSourceSuggestion): Promise<void> => {
    if (followBusyId || followedIds.has(suggestion.providerSourceId)) return;
    const requestProfileId = activeProfileId;
    const sourceId = suggestion.providerSourceId;
    setFollowBusyId(sourceId);
    setFollowFeedback((current) => {
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
    try {
      const result = await confirmSource(weeklyPickToSourceResolution(suggestion));
      if (activeProfileRef.current !== requestProfileId) return;
      setFollowFeedback((current) => ({ ...current, [sourceId]: result }));
    } catch {
      if (activeProfileRef.current !== requestProfileId) return;
      setFollowFeedback((current) => ({ ...current, [sourceId]: { ok: false, message: "Frame couldn’t add this source. Try again." } }));
    } finally {
      if (activeProfileRef.current === requestProfileId) setFollowBusyId(null);
    }
  };

  const retryDiscover = (): void => { void discoverQuery.refetch(); };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <ScreenHeader eyebrow="Sources" title={"People you\nchoose."} subtitle="Follow trusted sources directly, or review three optional picks each week." />
          {FOUNDATION_CAPABILITIES.weeklyDiscovery ? <View style={styles.segmented} accessibilityRole="tablist">
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
          </View> : null}

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

              {googleConfigured ? <Pressable onPress={() => { void openGoogleImport(); }} disabled={googleBusy} style={({ pressed }) => [styles.importButton, pressed && styles.pressed]} accessibilityRole="button" testID="sources-google-import">
                <View style={styles.importIcon}>{googleBusy ? <ActivityIndicator size="small" color={palette.active} /> : <Import size={17} color={palette.active} strokeWidth={1.8} />}</View>
                <View style={styles.flex}><Text style={type.label}>{googleConnected ? "Choose Google subscriptions" : "Connect Google to import"}</Text><Text style={styles.supporting}>Select sources yourself. Nothing is followed automatically.</Text></View>
                <ArrowRight size={17} color={palette.inkMuted} />
              </Pressable> : null}

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
                        {channel.thumbnailUrl ? <Image source={{ uri: channel.thumbnailUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="none" recyclingKey={channel.id} /> : null}
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.sourceName} numberOfLines={2}>{channel.title}</Text>
                        <Text style={styles.supporting}>{channel.fetchedAt ? "Open recent videos" : `Follow kept · ${channel.id}`}</Text>
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
              {interests.length === 0 ? (
                <View>
                  <EmptyState title="Choose interests when you’re ready" body="Discover stays empty until you choose interests in Settings. You can still add and follow any trusted source manually." />
                  <Pressable onPress={() => router.push("/(tabs)/settings")} style={styles.settingsButton} accessibilityRole="button" testID="discover-choose-interests">
                    <SlidersHorizontal size={16} color={palette.active} strokeWidth={1.8} />
                    <Text style={styles.settingsButtonText}>Choose interests in Settings</Text>
                  </Pressable>
                </View>
              ) : discoverQuery.isLoading && discoverQuery.fetchStatus !== "idle" ? (
                <VideoFeedSkeleton count={WEEKLY_DISCOVERY_DISPLAY_MAX} accessibilityLabel="Loading weekly picks" />
              ) : discoverQuery.data?.reason === "offline" ? (
                <View>
                  <EmptyState title="Discover is offline" body={discoverQuery.data.message ?? "Weekly picks need a connection. Your sources and preferences were not changed."} />
                  <RetryButton busy={discoverQuery.isFetching} onPress={retryDiscover} styles={styles} />
                </View>
              ) : discoverQuery.data?.reason === "configuration" ? (
                <EmptyState title="Discover isn't configured" body={discoverQuery.data.message ?? "Weekly picks are not configured for this build."} />
              ) : discoverQuery.data?.reason === "maintenance" ? (
                <EmptyState title="Weekly picks are paused" body={discoverQuery.data.message ?? "Frame is preparing the next weekly publication."} />
              ) : discoverQuery.data?.reason === "empty" ? (
                <EmptyState title="No picks this week" body={discoverQuery.data.message ?? "There is no current publication for your interests."} />
              ) : discoverQuery.isError || discoverQuery.data?.reason === "backend" || discoverQuery.data?.status === "temporarily_unavailable" ? (
                <View>
                  <EmptyState title="Discover couldn't load" body={discoverQuery.data?.message ?? "The weekly service is unavailable. No replacement recommendations were generated."} />
                  <RetryButton busy={discoverQuery.isFetching} onPress={retryDiscover} styles={styles} />
                </View>
              ) : discoverQuery.data && discoverQuery.data.items.length > 0 ? (
                <View style={styles.weeklyList}>
                  {discoverQuery.data.status === "cached_success" ? <Text style={styles.cacheNote}>Showing the saved weekly edition.</Text> : null}
                  {discoverQuery.data.items.map((suggestion) => (
                    <WeeklyPickCard
                      key={`${suggestion.provider}:${suggestion.providerSourceId}`}
                      suggestion={suggestion}
                      interestName={interestNames.get(suggestion.interestId) ?? "Your interests"}
                      followed={followedIds.has(suggestion.providerSourceId)}
                      busy={followBusyId === suggestion.providerSourceId}
                      feedback={followFeedback[suggestion.providerSourceId]}
                      onFollow={() => { void followWeeklyPick(suggestion); }}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState title="No picks this week" body="There is no current publication for your interests. Your followed sources are still available." />
              )}
              <View style={styles.endState} accessible accessibilityLabel="End of weekly picks">
                <View style={styles.endLine} />
                <Text style={styles.endText}>End of weekly picks</Text>
                <View style={styles.endLine} />
              </View>
              <Text style={styles.discoverNote}>Frame shows no more than {WEEKLY_DISCOVERY_DISPLAY_MAX} shared suggestions and checks for a new edition once every {PRODUCT_LIMITS.discoveryCadenceDays} days.</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <AddChannelModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function RetryButton({ busy, onPress, styles }: { busy: boolean; onPress(): void; styles: ReturnType<typeof createStyles> }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={styles.retryButton} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} testID="weekly-picks-retry">
      {busy ? <ActivityIndicator size="small" /> : null}
      <Text style={styles.retryButtonText}>{busy ? "Trying again…" : "Try again"}</Text>
    </Pressable>
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
    importButton: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    importIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: palette.activeSoft },
    supporting: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    sourceList: { gap: spacing.sm },
    sourceRow: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    avatar: { width: 52, height: 52, overflow: "hidden", borderRadius: radii.control, backgroundColor: palette.surfaceDeep },
    avatarImage: { width: "100%", height: "100%" },
    sourceName: { ...type.heading, fontSize: 17, lineHeight: 22 },
    weeklyHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    limitLabel: { ...type.caption, color: palette.active, fontSize: 9 },
    weeklyList: { gap: spacing.md },
    cacheNote: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginBottom: spacing.xs },
    endState: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
    endLine: { flex: 1, height: 1, backgroundColor: palette.borderSoft },
    endText: { ...type.caption, color: palette.inkMuted },
    discoverNote: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
    settingsButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    settingsButtonText: { ...type.label, color: palette.active },
    retryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    retryButtonText: { ...type.label, color: palette.active },
    pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  });
}
