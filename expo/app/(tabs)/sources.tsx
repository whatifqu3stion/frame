import { useScreenAction } from "@/hooks/useScreenAction";
import MotionView from "@/components/motion/MotionView";
import PositionedRow from "@/components/motion/PositionedRow";
import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "@/components/MediaImage";
import { router } from "expo-router";
import { ArrowRight, Import, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import InterestChoices from "@/components/InterestChoices";
import { resolutionVideoToVideo } from "@/services/youtube";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import WeeklyPickCard from "@/components/WeeklyPickCard";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { FOUNDATION_CAPABILITIES, WEEKLY_DISCOVERY_DISPLAY_MAX } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { weeklyDiscoveryPeriodKey, weeklyPickToSourceResolution } from "@/services/discovery";
import { weeklyEditionService } from "@/services/weeklyEditionInstance";
import type { WeeklyPickSourceSuggestion } from "@/types";

type SourcesSection = "followed" | "discover";

export default function SourcesScreen() {
  const touch = useFeedback();
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, activeProfile, interests, followedChannels, libraryLoading, sourcesError, googleConfigured, googleConnected, signInWithGoogle, confirmSource, requirePurchase, getManagedContentOverview } = useApp();
  const [section, setSection] = useState<SourcesSection>("followed");
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const { busy: googleBusy, run: connect } = useScreenAction(activeProfileId);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);
  const [editionBusy, setEditionBusy] = useState(false);
  const [followFeedback, setFollowFeedback] = useState<Record<string, { ok: boolean; message: string }>>({});
  const activeProfileRef = useRef(activeProfileId);
  const interestIds = interests.map((interest) => interest.id);
  const interestNames = useMemo(() => new Map(INTEREST_LIBRARY.map((interest) => [interest.id, interest.name])), []);
  const followedIds = useMemo(() => new Set(followedChannels.map((channel) => channel.id)), [followedChannels]);
  const queryClient = useQueryClient();
  const managedContentQuery = useQuery({
    queryKey: ["managed-content", activeProfileId], networkMode: "always",
    queryFn: () => getManagedContentOverview(activeProfileId),
    enabled: activeProfile?.role === "managed",
    staleTime: Infinity,
  });
  const managedOverview = activeProfile?.role === "managed" ? managedContentQuery.data ?? null : null;
  const visibleChannels = useMemo(() => {
    if (activeProfile?.role !== "managed") return followedChannels;
    if (!managedOverview || managedOverview.policy.mode === "selectedVideos") return [];
    const approved = new Set(managedOverview.approvedSources.map((source) => source.id));
    return followedChannels.filter((source) => approved.has(source.id));
  }, [activeProfile?.role, followedChannels, managedOverview]);
  const weeklyPeriod = weeklyDiscoveryPeriodKey();
  const discoverKey = ["weekly-picks", activeProfileId, weeklyPeriod, interestIds.join(","), [...followedIds].sort().join(",")];
  const discoverQuery = useQuery({
    queryKey: discoverKey,
    networkMode: "always",
    queryFn: () => weeklyEditionService.get(activeProfileId, interestIds, [...followedIds]),
    enabled: FOUNDATION_CAPABILITIES.weeklyDiscovery && activeProfile?.role !== "managed" && section === "discover",
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    activeProfileRef.current = activeProfileId;
    setFollowBusyId(null);
    setEditionBusy(false);
    setFollowFeedback({});
  }, [activeProfileId]);

  useEffect(() => { if (activeProfile?.role === "managed") setSection("followed"); }, [activeProfile?.role]);

  const openAddSource = (): void => {
    setAddOpen(true);
  };

  const openGoogleImport = async (): Promise<void> => {
    if (googleConnected) { router.push("/google-import"); return; }
    await connect(signInWithGoogle, (result) => {
      if (result.ok) router.push("/google-import");
      else Alert.alert("Google connection", result.message);
    }, () => Alert.alert("Google connection", "Google couldn’t connect. Try again when you’re ready."));
  };

  const followWeeklyPick = async (suggestion: WeeklyPickSourceSuggestion): Promise<void> => {
    if (followBusyId || followedIds.has(suggestion.providerSourceId)) return;
    const requestProfileId = activeProfileId;
    const sourceId = suggestion.providerSourceId;
    const done = touch.capture();
    setFollowBusyId(sourceId);
    setFollowFeedback((current) => {
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
    try {
      const result = await confirmSource(weeklyPickToSourceResolution(suggestion));
      if (activeProfileRef.current !== requestProfileId) return;
      done("commit", result.ok);
      setFollowFeedback((current) => ({ ...current, [sourceId]: result }));
    } catch {
      if (activeProfileRef.current !== requestProfileId) return;
      setFollowFeedback((current) => ({ ...current, [sourceId]: { ok: false, message: "Frame couldn’t add this source. Try again." } }));
    } finally {
      if (activeProfileRef.current === requestProfileId) setFollowBusyId(null);
    }
  };

  const retryDiscover = (): void => { void discoverQuery.refetch(); };

  const changeEdition = async (kind: "dismiss" | "more", sourceId?: string): Promise<void> => {
    if (editionBusy || !discoverQuery.data) return;
    const requestProfileId = activeProfileId;
    setEditionBusy(true);
    try {
      const result = kind === "dismiss"
        ? await weeklyEditionService.dismiss(requestProfileId, sourceId ?? "", discoverQuery.data, [...followedIds])
        : await weeklyEditionService.showMore(requestProfileId, discoverQuery.data, [...followedIds]);
      if (activeProfileRef.current === requestProfileId) queryClient.setQueryData(discoverKey, result);
    } catch {
      if (activeProfileRef.current === requestProfileId) Alert.alert("Weekly picks", "That change could not be saved. Try again.");
    } finally {
      if (activeProfileRef.current === requestProfileId) setEditionBusy(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <ScreenHeader eyebrow="Sources" title={"People you\nchoose."} subtitle={activeProfile?.role === "managed" ? "Videos and sources need the Owner’s approval." : "Follow creators you enjoy, or explore this week’s picks."} />
          {FOUNDATION_CAPABILITIES.weeklyDiscovery && activeProfile?.role !== "managed" ? <View style={styles.segmented} accessibilityRole="tablist">
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

          <MotionView changeKey={section}>
          {section === "followed" ? (
            <View style={styles.section}>
              <Pressable onPress={openAddSource} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} accessibilityRole="button" testID="sources-add-source">
                <View style={styles.addIcon}><Plus size={17} color={palette.active} strokeWidth={2} /></View>
                <View style={styles.flex}>
                  <Text style={type.label}>Add a source</Text>
                  <Text style={styles.supporting}>Use a supported channel link or @handle.</Text>
                </View>
                <ArrowRight size={17} color={palette.inkMuted} />
              </Pressable>

              {googleConfigured && (activeProfile?.role !== "managed" || managedOverview?.policy.mode === "approvedSources") ? <Pressable onPress={() => { void openGoogleImport(); }} disabled={googleBusy} style={({ pressed }) => [styles.importButton, pressed && styles.pressed]} accessibilityRole="button" testID="sources-google-import">
                <View style={styles.importIcon}>{googleBusy ? <ActivityIndicator size="small" color={palette.active} /> : <Import size={17} color={palette.active} strokeWidth={1.8} />}</View>
                <View style={styles.flex}><Text style={type.label}>{googleConnected ? "Choose subscriptions" : "Connect Google to import"}</Text><Text style={styles.supporting}>Choose which subscriptions to follow in Frame.</Text></View>
                <ArrowRight size={17} color={palette.inkMuted} />
              </Pressable> : null}

              {libraryLoading || managedContentQuery.isLoading ? (
                <VideoFeedSkeleton variant="source" count={3} accessibilityLabel="Loading followed sources" />
              ) : activeProfile?.role === "managed" && managedContentQuery.isError ? (
                <EmptyState title="Approvals couldn’t load" body="Try again to see this profile’s approved sources." action={{ label: "Try again", onPress: () => { void managedContentQuery.refetch(); } }} />
              ) : sourcesError ? (
                <EmptyState title="Sources couldn't load" body="Your sources are saved. Close and reopen Frame to try again." />
              ) : activeProfile?.role === "managed" && managedOverview?.policy.mode === "selectedVideos" ? (
                <EmptyState title="Selected Videos is on" body="Only individual videos approved by the Owner can play. Paste a video link to request one." />
              ) : visibleChannels.length === 0 ? (
                <EmptyState title={activeProfile?.role === "managed" ? "No approved sources" : "No followed sources"} body={activeProfile?.role === "managed" ? "An Owner can add a source here or approve a request from Profiles & boundaries." : "Follow a source to see its videos in Today."} />
              ) : (
                <View style={styles.sourceList}>
                  {visibleChannels.map((channel) => (
                    <Pressable
                      key={channel.id}
                      onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })}
                      style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${channel.title} source`}
                      testID={`source-${channel.id}`}
                    >
                      <View style={styles.avatar}>
                        <Image source={channel.thumbnailUrl ? { uri: channel.thumbnailUrl } : null} style={styles.avatarImage} contentFit="cover" cachePolicy="none" recyclingKey={channel.id} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.sourceName} numberOfLines={2}>{channel.title}</Text>
                        <Text style={styles.supporting}>{channel.fetchedAt ? "Open recent videos" : "Still followed · details unavailable"}</Text>
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
                <Text style={styles.limitLabel}>A few at a time</Text>
              </View>
              {discoverQuery.data?.reason === "no_interests" ? (
                <View>
                  <Text style={type.heading} accessibilityRole="header">Choose your interests</Text>
                  <Text style={[type.bodySoft, { marginVertical: spacing.md }]}>Choose up to five to see this week’s source suggestions.</Text>
                  <InterestChoices />
                </View>
              ) : discoverQuery.isLoading && discoverQuery.fetchStatus !== "idle" ? (
                <VideoFeedSkeleton variant="full" count={WEEKLY_DISCOVERY_DISPLAY_MAX} accessibilityLabel="Loading weekly picks" />
              ) : discoverQuery.data?.reason === "offline" ? (
                <View>
                  <EmptyState title="Discover is offline" body="Connect to the internet to load this week’s picks. Your sources and preferences are saved." />
                  <RetryButton busy={discoverQuery.isFetching} onPress={retryDiscover} styles={styles} />
                </View>
              ) : discoverQuery.data?.reason === "configuration" ? (
                <EmptyState title="Weekly picks aren’t available" body="You can still add a source you know, or try weekly picks again later." />
              ) : discoverQuery.data?.reason === "maintenance" ? (
                <EmptyState title="Weekly picks are paused" body="Please try again later. Your followed sources are still available." />
              ) : discoverQuery.data?.reason === "empty" ? (
                <EmptyState title="No picks this week" body="There are no new suggestions for your interests this week. You can still open a source you follow." />
              ) : discoverQuery.isError || discoverQuery.data?.reason === "backend" || discoverQuery.data?.status === "temporarily_unavailable" ? (
                <View>
                  <EmptyState title="Discover couldn't load" body="Try again, or open a source you follow." />
                  <RetryButton busy={discoverQuery.isFetching} onPress={retryDiscover} styles={styles} />
                </View>
              ) : discoverQuery.data && (discoverQuery.data.items.length > 0 || discoverQuery.data.canShowMore) ? (
                <View style={styles.weeklyList}>
                  {discoverQuery.data.status === "cached_success" ? <Text style={styles.cacheNote}>Showing previously loaded picks.</Text> : null}
                  {discoverQuery.data.items.length === 0 ? <EmptyState title="You've seen these picks" body="Explore more from this week’s selection below." /> : null}
                  {discoverQuery.data.items.map((suggestion) => (
                    <PositionedRow transitionKey={discoverQuery.data.items.map((item) => item.providerSourceId).join(",")} key={`${activeProfileId}:${suggestion.provider}:${suggestion.providerSourceId}`}><WeeklyPickCard
                      suggestion={suggestion}
                      interestName={interestNames.get(suggestion.interestId) ?? "Your interests"}
                      followed={followedIds.has(suggestion.providerSourceId)}
                      busy={followBusyId === suggestion.providerSourceId}
                      disabled={editionBusy || Boolean(followBusyId)}
                      feedback={followFeedback[suggestion.providerSourceId]}
                      onPreview={() => {
                        if (!requirePurchase("library")) return;
                        const video = resolutionVideoToVideo(weeklyPickToSourceResolution(suggestion));
                        if (video) router.push({ pathname: FRAME_PLAYBACK_ROUTE, params: { id: video.id, title: video.title, channelId: video.channelId, channelTitle: video.channelTitle, thumbnailUrl: video.thumbnailUrl, publishedAt: video.publishedAt, durationSeconds: String(video.durationSeconds), description: video.description ?? "", fetchedAt: String(video.fetchedAt ?? 0), cachedMetadata: "1" } });
                      }}
                      onFollow={() => { void followWeeklyPick(suggestion); }}
                      onDismiss={() => { void changeEdition("dismiss", suggestion.providerSourceId); }}
                    /></PositionedRow>
                  ))}
                  {discoverQuery.data.canShowMore ? (
                    <Pressable onPress={() => { void changeEdition("more"); }} disabled={editionBusy} style={styles.settingsButton} accessibilityRole="button" accessibilityLabel="More sources from this week" testID="weekly-picks-more">
                      <Text style={styles.settingsButtonText}>More from this week</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <EmptyState title="You're caught up" body="You’ve reached the end of this week’s selection. You can still browse sources you follow." />
              )}
              {discoverQuery.data && ["success", "cached_success"].includes(discoverQuery.data.status) && !discoverQuery.data.canShowMore ? <View style={styles.endState} accessible accessibilityLabel="End of weekly picks">
                <View style={styles.endLine} />
                <Text style={styles.endText}>End of weekly picks</Text>
                <View style={styles.endLine} />
              </View> : null}
              <Text style={styles.discoverNote}>Up to {WEEKLY_DISCOVERY_DISPLAY_MAX} picks at a time. Next selection: {discoverQuery.data?.nextRefreshDate ?? "when available"}.</Text>
            </View>
          )}
          </MotionView>
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
    segment: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.small },
    segmentActive: { backgroundColor: palette.surfaceHigh, borderWidth: 1, borderColor: palette.borderSoft },
    segmentText: { ...type.label, color: palette.inkMuted },
    segmentTextActive: { color: palette.active },
    section: { marginTop: spacing.lg },
    addButton: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    addIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: palette.activeSoft },
    importButton: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    importIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: palette.activeSoft },
    supporting: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    sourceList: { gap: 0 },
    sourceRow: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
    avatar: { width: 52, height: 52, overflow: "hidden", borderRadius: radii.control, backgroundColor: palette.surfaceDeep },
    avatarImage: { width: "100%", height: "100%" },
    sourceName: { ...type.heading, fontSize: 17, lineHeight: 22 },
    weeklyHeader: { minHeight: 44, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center", justifyContent: "space-between" },
    limitLabel: { ...type.caption, color: palette.active, fontSize: 12 },
    weeklyList: { gap: spacing.xl },
    cacheNote: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginBottom: spacing.xs },
    endState: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
    endLine: { flex: 1, height: 1, backgroundColor: palette.borderSoft },
    endText: { ...type.caption, color: palette.inkMuted },
    discoverNote: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
    settingsButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    settingsButtonText: { ...type.label, color: palette.active },
    retryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    retryButtonText: { ...type.label, color: palette.active },
    pressed: { opacity: 0.72 },
  });
}

