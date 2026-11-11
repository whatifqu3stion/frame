import WeeklyPicksInfo from "@/components/WeeklyPicksInfo";
import SectionTabs from "@/components/SectionTabs";
import Text from "@/components/FrameText";
import SourceLibrary from "@/components/SourceLibrary";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import { listTodaySourceRules } from "@/db/database";
import TextField from "@/components/TextField";
import CollectionPrompt from "@/components/CollectionPrompt";
import Heading from "@/components/Heading";
import ImportSubscriptionsAction from "@/components/ImportSubscriptionsAction";
import GenerateWeeklyPicks from "@/components/GenerateWeeklyPicks";
import { CuratingSelection } from "@/components/motion/CuratingSelection";
import type { DiscoveryStage } from "@/services/byokWeeklyPicks";
import { boundedCollection } from "@/constants/layout";
import MotionView from "@/components/motion/MotionView";
import PositionedRow from "@/components/motion/PositionedRow";
import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "@/components/MediaImage";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import InterestChoices from "@/components/InterestChoices";
import { resolutionVideoToVideo } from "@/services/youtube";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import AddChannelModal from "@/components/AddChannelModal";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import WeeklyPickCard from "@/components/WeeklyPickCard";
import { interestTopicFromId } from "@/domain/interests";
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
  const params = useLocalSearchParams<{ requestVideo?: string; showFollowed?: string }>();
  const [requestVideo, setRequestVideo] = useState(false);
  const insets = useSafeAreaInsets();
  const { bottomBarHeight } = useNavigationLayout();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, activeProfile, interests, followedChannels, libraryLoading, sourcesError, refreshLibrary, confirmSource, requirePurchase, getManagedContentOverview } = useApp();
  const [section, setSection] = useState<SourcesSection>("followed");
  const [editingInterests, setEditingInterests] = useState(false);
  const showInterestEditor = editingInterests || interests.length === 0;
  useEffect(() => { if (section === "discover" && interests.length === 0) setEditingInterests(true); }, [section, interests.length]);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);
  const [editionBusy, setEditionBusy] = useState(false);
  const [searchStage, setSearchStage] = useState<DiscoveryStage | null>(null);
  const arrivingEdition = useRef(false);
  const [lastFollow, setLastFollow] = useState<{ id: string; message: string } | null>(null);
  const [followFeedback, setFollowFeedback] = useState<Record<string, { ok: boolean; message: string }>>({});
  const activeProfileRef = useRef(activeProfileId);
  const interestIds = interests.map((interest) => interest.id);
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
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourcePage, setSourcePage] = useState(0);
  const sourceRules = useQuery({ queryKey: ["today-rules", activeProfileId, followedChannels.length], networkMode: "always", queryFn: () => listTodaySourceRules(activeProfileId) });
  const filteredChannels = visibleChannels.filter((channel) => channel.title.toLowerCase().includes(sourceSearch.trim().toLowerCase()));
  const lastSourcePage = Math.max(0, Math.ceil(filteredChannels.length / 20) - 1);
  const currentSourcePage = Math.min(sourcePage, lastSourcePage);
  const sourcePageItems = filteredChannels.slice(currentSourcePage * 20, (currentSourcePage + 1) * 20);
  useEffect(() => { setSourcePage(0); setSourceSearch(""); }, [activeProfileId]);
  const weeklyPeriod = weeklyDiscoveryPeriodKey();
  const discoverKey = ["weekly-picks", activeProfileId, weeklyPeriod, interestIds.join(","), [...followedIds].sort().join(",")];
  const discoverQuery = useQuery({
    queryKey: discoverKey,
    networkMode: "always",
    queryFn: () => weeklyEditionService.get(activeProfileId, interestIds, [...followedIds]),
    enabled: FOUNDATION_CAPABILITIES.weeklyDiscovery && activeProfile?.role !== "managed" && section === "discover" && !showInterestEditor,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    activeProfileRef.current = activeProfileId;
    setFollowBusyId(null);
    setEditingInterests(false);
    setEditionBusy(false);
    setFollowFeedback({}); setLastFollow(null);
  }, [activeProfileId]);

  useEffect(() => { if (activeProfile?.role === "managed") setSection("followed"); }, [activeProfile?.role]);

  useEffect(() => {
    if (params.requestVideo === "1" && activeProfile?.role === "managed") {
      setRequestVideo(true); setSection("followed"); setAddOpen(true);
      router.setParams({ requestVideo: undefined });
    }
  }, [activeProfile?.role, params.requestVideo]);

  useEffect(() => {
    if (params.showFollowed === "1") { setSection("followed"); router.setParams({ showFollowed: undefined }); }
  }, [params.showFollowed]);

  const openAddSource = (): void => {
    setRequestVideo(activeProfile?.role === "managed" && managedOverview?.policy.mode === "selectedVideos");
    setAddOpen(true);
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
      if (result.ok) setLastFollow({ id: sourceId, message: result.message });
    } catch {
      if (activeProfileRef.current !== requestProfileId) return;
      setFollowFeedback((current) => ({ ...current, [sourceId]: { ok: false, message: "Frame couldn’t add this source. Try again." } }));
    } finally {
      if (activeProfileRef.current === requestProfileId) setFollowBusyId(null);
    }
  };

  const retryDiscover = (): void => { void discoverQuery.refetch(); };

  const changeEdition = async (kind: "dismiss" | "more" | "previous", sourceId?: string): Promise<void> => {
    if (editionBusy || !discoverQuery.data) return;
    const requestProfileId = activeProfileId;
    setEditionBusy(true);
    try {
      const result = kind === "dismiss"
        ? await weeklyEditionService.dismiss(requestProfileId, sourceId ?? "", discoverQuery.data, [...followedIds])
        : kind === "previous" ? await weeklyEditionService.showPrevious(requestProfileId, discoverQuery.data, [...followedIds]) : await weeklyEditionService.showMore(requestProfileId, discoverQuery.data, [...followedIds]);
      if (activeProfileRef.current === requestProfileId) queryClient.setQueryData(discoverKey, result);
    } catch {
      if (activeProfileRef.current === requestProfileId) Alert.alert("Weekly picks", "That change could not be saved. Try again.");
    } finally {
      if (activeProfileRef.current === requestProfileId) setEditionBusy(false);
    }
  };

  const selectedVideosOnly = managedOverview?.policy.mode === "selectedVideos";
  const emptyLibrary = visibleChannels.length === 0 && !libraryLoading && !sourcesError
    && (activeProfile?.role !== "managed" || managedContentQuery.isSuccess);
  const addLabel = selectedVideosOnly ? "Request a video" : "Add a source";
  const startAdding = () => {
    if (activeProfile?.role === "managed") openAddSource();
    else router.push("/add-source");
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + 104 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.page}>
          <ScreenHeader editorial compact={visibleChannels.length > 0 || section === "discover"} eyebrow="Sources" title="Sources" subtitle={activeProfile?.role === "managed" && !emptyLibrary ? "Videos and sources need the Owner’s approval." : undefined} />
          {FOUNDATION_CAPABILITIES.weeklyDiscovery && activeProfile?.role !== "managed" ? <SectionTabs<SourcesSection>
            label="Sources sections" value={section} onChange={setSection}
            tabs={[{ value: "followed", label: "Followed", accessibilityLabel: "Followed sources" }, { value: "discover", label: "Discover", accessibilityLabel: "Discover weekly picks" }]}
          /> : null}

          <MotionView changeKey={section}>
          {section === "followed" ? (
            <View style={styles.section}>
              {emptyLibrary ? <CollectionPrompt
                caption={selectedVideosOnly ? "Request a video for the Owner to review." : activeProfile?.role === "managed" ? "Ask the Owner to add a source for this profile." : "Follow a creator to browse their videos and choose whether Today can pick from them."}
                action={{ label: addLabel, onPress: startAdding, prominentAdd: true, testID: "sources-add-source" }}
              /> : null}
              {activeProfile?.role === "managed" && managedOverview?.policy.mode === "approvedSources" ? <ImportSubscriptionsAction /> : null}
              {libraryLoading || managedContentQuery.isLoading ? (
                <VideoFeedSkeleton variant="source" count={3} accessibilityLabel="Loading followed sources" />
              ) : activeProfile?.role === "managed" && managedContentQuery.isError ? (
                <EmptyState title="Approvals couldn’t load" body="Try again to see this profile’s approved sources." action={{ label: "Try again", onPress: () => { void managedContentQuery.refetch(); } }} />
              ) : sourcesError ? (
                <EmptyState title="Sources couldn’t load" body="Try again to reload your followed sources." action={{ label: "Try again", onPress: () => { void refreshLibrary().catch(() => Alert.alert("Sources unavailable", "Try again in a moment.")); } }} />
              ) : emptyLibrary ? null : activeProfile?.role !== "managed" ? <SourceLibrary /> : (
                <View style={styles.sourceList}>
                  {visibleChannels.length > 20 ? <TextField value={sourceSearch} onChangeText={(value) => { setSourceSearch(value); setSourcePage(0); }} placeholder="Find a followed source" accessibilityLabel="Find a followed source" /> : null}
                  {sourcePageItems.map((channel) => (
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
                        <Text style={styles.supporting}>{(sourceRules.data?.find((rule) => rule.sourceId === channel.id)?.mutedUntil ?? 0) > Date.now() ? "Library only" : channel.fetchedAt ? "Included in Today" : "Still followed · details unavailable"}</Text>
                      </View>
                      <ArrowRight size={17} color={palette.inkMuted} />
                    </Pressable>
                  ))}
                  {filteredChannels.length === 0 ? <Text style={styles.supporting}>No followed sources match.</Text> : null}
                  {filteredChannels.length > 20 ? <View style={{ gap: spacing.sm }}>
                    <Text style={styles.supporting}>Sources {currentSourcePage * 20 + 1}–{Math.min((currentSourcePage + 1) * 20, filteredChannels.length)} of {filteredChannels.length}</Text>
                    {currentSourcePage > 0 ? <Pressable style={styles.settingsButton} accessibilityRole="button" onPress={() => setSourcePage(currentSourcePage - 1)}><Text style={styles.settingsButtonText}>Previous sources</Text></Pressable> : null}
                    {currentSourcePage < lastSourcePage ? <Pressable style={styles.settingsButton} accessibilityRole="button" onPress={() => setSourcePage(currentSourcePage + 1)}><Text style={styles.settingsButtonText}>Next sources</Text></Pressable> : null}
                  </View> : null}
                </View>
              )}
              {!emptyLibrary ? <Pressable onPress={startAdding} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} accessibilityRole="button" testID="sources-add-source">
                <Plus size={17} color={palette.active} />
                <Text style={[type.label, styles.flex]}>{addLabel}</Text>
                <ArrowRight size={17} color={palette.inkMuted} />
              </Pressable> : null}
            </View>
          ) : (
            <View style={styles.section}>
              {lastFollow ? <MotionView enter changeKey={lastFollow.id} style={{ marginBottom: spacing.lg }}><Text style={type.bodySoft} accessibilityLiveRegion="polite">{lastFollow.message}</Text><Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }} onPress={() => router.push({ pathname: "/channel/[id]", params: { id: lastFollow.id } })}><Text style={[type.label, { color: palette.active }]}>Browse source now</Text></Pressable></MotionView> : null}
              {activeProfile?.role === "owner" && !showInterestEditor && interests.length > 0
                ? <WeeklyPicksInfo anchor={<Text style={type.caption}>Weekly picks</Text>} />
                : <View style={styles.weeklyHeader}><Text style={type.caption}>Weekly picks</Text></View>}
              {!showInterestEditor ? <Pressable style={styles.settingsButton} accessibilityRole="button" onPress={() => setEditingInterests(true)}><Text style={styles.settingsButtonText}>Edit interests</Text><ArrowRight size={17} color={palette.active} /></Pressable> : null}
              {!showInterestEditor && interests.length > 0 ? <GenerateWeeklyPicks onPresentationStage={setSearchStage} onPrepared={(hasPicks) => { arrivingEdition.current = hasPicks; }} hasEdition={Boolean(discoverQuery.data && ["success", "cached_success"].includes(discoverQuery.data.status) && (!discoverQuery.data.reason || discoverQuery.data.reason === "empty"))} /> : null}
              {showInterestEditor ? (
                <View>
                  <Heading style={type.heading}>Choose your interests</Heading>
                  <InterestChoices />
                  <Pressable style={styles.settingsButton} accessibilityRole="button" onPress={() => { setEditingInterests(false); if (interests.length === 0) setSection("followed"); }}><Text style={styles.settingsButtonText}>Done</Text><ArrowRight size={17} color={palette.active} /></Pressable>
                </View>
              ) : searchStage ? <CuratingSelection stage={searchStage} /> : discoverQuery.isLoading && discoverQuery.fetchStatus !== "idle" ? (
                <VideoFeedSkeleton variant="full" count={WEEKLY_DISCOVERY_DISPLAY_MAX} accessibilityLabel="Loading weekly picks" />
              ) : discoverQuery.data?.reason === "offline" ? (
                <View>
                  <EmptyState title="Discover is offline" body="Connect to the internet to load this week’s picks. Your sources and preferences are saved." action={{ label: "Open followed sources", onPress: () => setSection("followed") }} />
                  <RetryButton busy={discoverQuery.isFetching} onPress={retryDiscover} styles={styles} />
                </View>
              ) : discoverQuery.data?.reason === "configuration" ? (
                <Pressable style={styles.settingsButton} accessibilityRole="button" onPress={() => setSection("followed")}><Text style={styles.settingsButtonText}>Open followed sources</Text></Pressable>
              ) : discoverQuery.data?.reason === "maintenance" ? (
                <EmptyState title="Weekly picks are paused" body="Please try again later. Your followed sources are still available." action={{ label: "Open followed sources", onPress: () => setSection("followed") }} />
              ) : discoverQuery.data?.reason === "empty" ? (
                <EmptyState title="No picks this week" body={discoverQuery.data?.message ?? "There are no new suggestions for your interests this week. You can still open a source you follow."} action={{ label: "Open followed sources", onPress: () => setSection("followed") }} />
              ) : discoverQuery.isError || discoverQuery.data?.reason === "backend" || discoverQuery.data?.status === "temporarily_unavailable" ? (
                <View>
                  <EmptyState title="Discover couldn't load" body="Try again, or open a source you follow." action={{ label: "Open followed sources", onPress: () => setSection("followed") }} />
                  <RetryButton busy={discoverQuery.isFetching} onPress={retryDiscover} styles={styles} />
                </View>
              ) : discoverQuery.data && (discoverQuery.data.items.length > 0 || discoverQuery.data.canShowMore) ? (
                <View style={styles.weeklyList}>
                  {discoverQuery.data.status === "cached_success" ? <Text style={styles.cacheNote}>Showing previously loaded picks.</Text> : null}
                  {discoverQuery.data.items.length === 0 ? <EmptyState title="You've seen these picks" body="Explore more from this week’s selection below." /> : null}
                  {discoverQuery.data.items.map((suggestion, index) => (
                    <PositionedRow transitionKey={discoverQuery.data.items.map((item) => item.providerSourceId).join(",")} key={`${activeProfileId}:${suggestion.provider}:${suggestion.providerSourceId}`}><WeeklyPickCard
                      suggestion={suggestion}
                      reveal={index === 0 && arrivingEdition.current}
                      onRevealed={() => { arrivingEdition.current = false; }}
                      interestName={interestTopicFromId(suggestion.interestId)?.name ?? "Your interests"}
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

                </View>
              ) : (
                <EmptyState gallery complete title="You're caught up" body="You’ve reached the end of this week’s selection. You can still browse sources you follow." action={{ label: "Open followed sources", onPress: () => setSection("followed") }} />
              )}
              {discoverQuery.data?.canShowPrevious ? <Pressable onPress={() => { void changeEdition("previous"); }} disabled={editionBusy} style={styles.settingsButton} accessibilityRole="button"><Text style={styles.settingsButtonText}>Previous picks</Text></Pressable> : null}
              {discoverQuery.data?.canShowMore ? <Pressable onPress={() => { void changeEdition("more"); }} disabled={editionBusy} style={styles.settingsButton} accessibilityRole="button" testID="weekly-picks-more"><Text style={styles.settingsButtonText}>Next picks from this week</Text></Pressable> : null}
              {discoverQuery.data && ["success", "cached_success"].includes(discoverQuery.data.status) && !discoverQuery.data.canShowMore ? <View style={styles.endState} accessible accessibilityLabel="End of weekly picks">
                <View style={styles.endLine} />
                <Text style={styles.endText}>End of weekly picks</Text>
                <View style={styles.endLine} />
              </View> : null}
              <Text style={styles.discoverNote}>Up to {WEEKLY_DISCOVERY_DISPLAY_MAX} picks at a time. Next edition can be generated: {discoverQuery.data?.nextRefreshDate ? new Date(`${discoverQuery.data.nextRefreshDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "when available"}.</Text>
            </View>
          )}
          </MotionView>
        </View>
      </ScrollView>
      <AddChannelModal requestVideo={requestVideo} visible={addOpen} onClose={() => setAddOpen(false)} />
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
    screen: { flex: 1, backgroundColor: "transparent" },
    page: { ...boundedCollection, paddingHorizontal: spacing.page },
    flex: { flex: 1 },
    section: { marginTop: spacing.lg },
    addButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSoft },
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

