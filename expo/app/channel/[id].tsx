import Text from "@/components/FrameText";
import { PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import { makePreviewLibrary } from "@/preview/library";
import { isLongFormVideo } from "@/domain/contentPolicy";
import TextField from "@/components/TextField";
import ChoiceOption from "@/components/ChoiceOption";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
import { byokYouTube } from "@/services/byok";
import type { ChannelBrowseOptions, ChannelPage } from "@/services/byokYouTube";
import { listTodaySourceRules, refreshStoredLibraryMetadata } from "@/db/database";
import { defaultTodaySourceRule, LIBRARY_ONLY_UNTIL } from "@/domain/today";
import { useIsFocused } from "@react-navigation/native";
import { boundedCollection } from "@/constants/layout";
import OutcomeIcon from "@/components/motion/OutcomeIcon";
import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "@/components/MediaImage";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Check, Plus, RotateCcw, Search } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, AppState, FlatList, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { cachedContentService } from "@/services/youtube";
import { expireChannel, isMetadataCurrent } from "@/domain/metadataRetention";
import type { Video } from "@/types";

export default function ChannelScreen() {
  const touch = useFeedback();
  const followLock = useRef(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [expandedDescriptionId, setExpandedDescriptionId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProfileId, activeProfile, changeSourceRule, followedChannels, isChannelFollowed, followChannel, unfollowChannel, canUseLibrary, requirePurchase } = useApp();

  const focused = useIsFocused();
  const [searchText, setSearchText] = useState("");
  const [duration, setDuration] = useState<"any" | "medium" | "long">("any");
  const [recent, setRecent] = useState(false);
  const [browse, setBrowse] = useState<ChannelBrowseOptions>({});
  const [previousPages, setPreviousPages] = useState<(string | undefined)[]>([]);
  const listRef = useRef<FlatList<Video>>(null);
  const [ruleBusy, setRuleBusy] = useState(false);
  const ruleLock = useRef(false);
  const rulesQuery = useQuery({ queryKey: ["today-rules", activeProfileId], queryFn: () => listTodaySourceRules(activeProfileId), networkMode: "always", staleTime: Infinity });
  const sourceRule = rulesQuery.data?.find((rule) => rule.sourceId === id) ?? defaultTodaySourceRule(activeProfileId, id);
  const libraryOnly = sourceRule.mutedUntil === LIBRARY_ONLY_UNTIL;
  const personal = activeProfile?.role !== "managed";
  const changeParticipation = async () => {
    if (ruleLock.current || !personal) return;
    ruleLock.current = true; setRuleBusy(true);
    try {
      if (await changeSourceRule({ ...sourceRule, mutedUntil: libraryOnly ? null : LIBRARY_ONLY_UNTIL, updatedAt: Date.now() })) setFeedback(libraryOnly ? "Included in the next daily selection. Today won’t refill." : "Library only. This source stays followed and leaves Today.");
    } catch { setFeedback("This source’s Today setting couldn’t save. Try again."); }
    finally { ruleLock.current = false; setRuleBusy(false); }
  };
  const changeFavorite = async () => {
    if (ruleLock.current || !personal || !rulesQuery.data) return;
    ruleLock.current = true; setRuleBusy(true);
    try {
      if (await changeSourceRule({ ...sourceRule, favorite: !sourceRule.favorite, updatedAt: Date.now() })) setFeedback(sourceRule.favorite ? "Favorite removed. Today’s selection stays the same." : "Favorited for future daily selections. Today stays the same.");
    } catch { setFeedback("Your favorite setting couldn’t save. Try again."); }
    finally { ruleLock.current = false; setRuleBusy(false); }
  };
  const videosQuery = useQuery({
    queryKey: ["cached-channel", activeProfileId, id, personal ? browse : null],
    queryFn: async ({ signal }) => {
      const preview = PREVIEW_LIBRARY_ENABLED ? makePreviewLibrary(Date.now()) : null;
      const sampleChannel = preview?.channels.find((channel) => channel.id === id);
      if (sampleChannel && preview) return { channel: sampleChannel, nextPageToken: null, videos: preview.videos.filter((video) => video.channelId === id && (!browse.query || video.title.toLowerCase().includes(browse.query.toLowerCase())) && (browse.duration !== "long" || video.durationSeconds >= 1200) && (browse.duration !== "medium" || video.durationSeconds < 1200)) };
      const shelf = personal ? await byokYouTube.browseChannel(id, browse, signal) : { ...await cachedContentService.getChannelShelf(id), nextPageToken: null };
      if (signal.aborted) throw new Error("Request cancelled.");
      await refreshStoredLibraryMetadata(activeProfileId, shelf.videos, { ...shelf.channel, followedAt: 0, source: "manual" });
      await queryClient.invalidateQueries({ queryKey: ["library", activeProfileId] });
      return shelf;
    },
    enabled: !!id && canUseLibrary && focused,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useFocusEffect(useCallback(() => {
    const cancel = () => { void queryClient.cancelQueries({ queryKey: ["cached-channel", activeProfileId, id] }); };
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") cancel(); });
    return () => { cancel(); subscription.remove(); };
  }, [activeProfileId, id, queryClient]));

  const submitSearch = () => {
    const query = searchText.trim();
    if (!query || videosQuery.isFetching) return;
    setPreviousPages([]);
    if (browse.query === query && browse.duration === duration && browse.recent === recent && !browse.pageToken) void videosQuery.refetch();
    else setBrowse({ query, duration, recent });
  };

  const savedChannel = followedChannels.find((candidate) => candidate.id === id);
  const rawChannel = videosQuery.data?.channel ?? queryClient.getQueryData<ChannelPage>(["cached-channel", activeProfileId, id, personal ? {} : null])?.channel ?? savedChannel;
  const channel = rawChannel ? expireChannel(rawChannel, Date.now()) : undefined;
  const videos = (videosQuery.data?.videos ?? []).filter((video) => isLongFormVideo(video) && isMetadataCurrent(video.fetchedAt, Date.now()));
  const videosMessage = videosQuery.isError ? (videosQuery.error instanceof Error ? videosQuery.error.message : "Videos couldn’t refresh. Try again.") : undefined;
  const following = id ? isChannelFollowed(id) : false;

  const toggleFollow = useCallback(async (): Promise<void> => {
    if (!channel || followLock.current) return;
    const done = touch.capture();
    followLock.current = true; setFollowBusy(true); setFeedback(null);
    try {
      if (following) { await unfollowChannel(channel.id); setFeedback("Source unfollowed. You can follow it again here."); }
      else if (requirePurchase("creators")) { await followChannel({ ...channel, followedAt: Date.now(), source: "manual" }); setFeedback("Source followed"); done("commit"); }
    } catch {
      Alert.alert("Source unchanged", "Owner authorization was cancelled or the source could not be updated.");
    } finally { followLock.current = false; setFollowBusy(false); }
  }, [channel, followChannel, following, requirePurchase, touch, unfollowChannel]);

  const retryUploads = useCallback((): void => {
    void videosQuery.refetch();
  }, [videosQuery]);

  const header = (
    <>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Image source={channel?.thumbnailUrl ? { uri: channel.thumbnailUrl } : null} style={styles.avatarImage} contentFit="cover" cachePolicy="none" recyclingKey={channel?.id} />
          </View>
          <Text style={[type.title, styles.channelName]} accessibilityRole="header">{channel?.title ?? (videosQuery.isLoading && canUseLibrary ? "Loading source…" : "Source details unavailable")}</Text>
        </View>
        <View style={styles.headerActions}>
        {channel ? (
          <Pressable
            onPress={() => { if (following) Alert.alert("Unfollow source?", "New videos from this source will stop appearing in Today. Saved videos stay in your library.", [{ text: "Cancel", style: "cancel" }, { text: "Unfollow", onPress: () => { void toggleFollow(); } }]); else void toggleFollow(); }}
            disabled={followBusy}
            style={({ pressed }) => [styles.followBtn, following && styles.followBtnActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: following, busy: followBusy, disabled: followBusy }}
            accessibilityLabel={following ? `Unfollow ${channel.title}` : `Follow ${channel.title}`}
            testID="follow-channel"
          >
            <OutcomeIcon key={`${activeProfileId}:${id}`} confirmed={following} busy={followBusy} size={18} color={following ? palette.active : palette.onDark} idle={<Plus size={15} color={palette.onDark} strokeWidth={1.8} />}><Check size={15} color={palette.active} strokeWidth={1.8} /></OutcomeIcon>
            <Text style={[styles.followText, { color: following ? palette.active : palette.onDark }]}>{followBusy ? "Updating…" : following ? "Following" : "Follow source"}</Text>
          </Pressable>
        ) : null}
          {channel?.description ? <Pressable onPress={() => setExpandedDescriptionId(expandedDescriptionId === id ? null : id)} accessibilityRole="button" accessibilityState={{ expanded: expandedDescriptionId === id }} style={styles.inlineAction}>
            <Text style={styles.retryText}>About this source</Text><DisclosureIndicator expanded={expandedDescriptionId === id} color={palette.accent} />
          </Pressable> : null}
        </View>
        {channel?.description && expandedDescriptionId === id ? <Text style={styles.description}>{channel.description}</Text> : null}
        {following && personal ? <View style={styles.settingsSection}>
          <Pressable onPress={() => setSettingsOpen(!settingsOpen)} accessibilityRole="button" accessibilityState={{ expanded: settingsOpen }} style={styles.disclosureRow}>
            <View style={styles.flex}><Text style={type.label}>Source settings</Text><Text style={type.bodySoft}>{libraryOnly ? "Library only" : "Included in Today"}{sourceRule.favorite ? " · Favorite" : ""}</Text></View>
            <DisclosureIndicator expanded={settingsOpen} color={palette.inkSoft} />
          </Pressable>
          {settingsOpen ? <View style={styles.settingsBody}>
            <View style={styles.settingRow}>
              <View style={styles.flex}><Text style={type.label}>Include in Today</Text><Text style={type.bodySoft}>{libraryOnly ? "Off. Browse this source here anytime." : "On. Videos can appear in your daily selection."}</Text></View>
              <Switch value={!libraryOnly} onValueChange={() => { void changeParticipation(); }} disabled={ruleBusy || !rulesQuery.data} accessibilityLabel="Include in Today" trackColor={{ true: palette.active }} />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.flex}><Text style={type.label}>Favorite source</Text><Text style={type.bodySoft}>{libraryOnly ? "Takes effect in Today when you include this source." : "Prioritize this source when others have waited equally long."}</Text></View>
              <Switch value={sourceRule.favorite === true} onValueChange={() => { void changeFavorite(); }} disabled={ruleBusy || !rulesQuery.data} accessibilityLabel="Favorite source" trackColor={{ true: palette.active }} />
            </View>
            <Text style={type.bodySoft}>Turning Today off removes this source from today’s selection. Turning it on or changing a favorite applies to future selections.</Text>
            {rulesQuery.isError ? <Pressable accessibilityRole="button" onPress={() => { void rulesQuery.refetch(); }} style={styles.inlineAction}><Text style={styles.retryText}>Settings couldn’t load. Retry</Text></Pressable> : null}
          </View> : null}
        </View> : null}
      </View>
      {feedback ? <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text> : null}
      <View style={styles.videoSection}>
        <View style={styles.videoToolbar}>
          <Text style={[type.heading, styles.flex]} accessibilityRole="header">{browse.query ? "Search results" : "Recent uploads"}</Text>
          {personal ? <Pressable accessibilityRole="button" accessibilityLabel="Search this source" accessibilityState={{ expanded: searchOpen }} onPress={() => setSearchOpen(!searchOpen)} style={styles.inlineAction}><Search size={18} color={palette.accent} /><Text style={styles.retryText}>Search</Text><DisclosureIndicator expanded={searchOpen} color={palette.accent} /></Pressable> : null}
        </View>
        {personal && searchOpen ? <View style={styles.searchBody}>
          <Text style={type.label}>Search this source</Text>
          <TextField value={searchText} onChangeText={setSearchText} maxLength={120} placeholder="Topic or video title" accessibilityLabel="Search this source" returnKeyType="search" onSubmitEditing={submitSearch} />
          <Text style={type.label}>Duration</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Video duration" style={styles.durationChoices}>
            {(["any", "medium", "long"] as const).map((option) => <ChoiceOption key={option} label={({ any: "Any", medium: "4–20 min", long: "20+ min" })[option]} selected={duration === option} onPress={() => setDuration(option)} style={styles.durationChoice} />)}
          </View>
          <ChoiceOption label="Past year only" role="checkbox" selected={recent} onPress={() => setRecent(!recent)} />
          <Text style={type.bodySoft}>Only videos of four minutes or longer are shown.</Text>
          <Pressable accessibilityRole="button" disabled={!searchText.trim() || videosQuery.isFetching} accessibilityState={{ disabled: !searchText.trim() || videosQuery.isFetching, busy: videosQuery.isFetching }} onPress={submitSearch} style={[styles.searchButton, (!searchText.trim() || videosQuery.isFetching) && styles.disabled]}><Text style={styles.searchButtonText}>{videosQuery.isFetching ? "Searching…" : "Search videos"}</Text></Pressable>
        </View> : null}
        {browse.query ? <Text style={type.bodySoft}>For “{browse.query}”{browse.duration === "long" ? " · 20+ min" : browse.duration === "medium" ? " · 4–20 min" : ""}{browse.recent ? " · Past year" : ""}</Text> : null}
        {browse.query || browse.pageToken ? <Pressable accessibilityRole="button" onPress={() => { setBrowse({}); setPreviousPages([]); setSearchText(""); setDuration("any"); setRecent(false); }} style={styles.inlineAction}><Text style={styles.retryText}>Back to recent uploads</Text></Pressable> : null}
        {videosMessage ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{videosMessage}</Text> : null}
      </View>
    </>
  );

  const empty = videosQuery.isLoading ? (
    <VideoFeedSkeleton count={5} style={styles.loadingFeed} accessibilityLabel="Loading recent videos" />
  ) : videosQuery.data && videos.length === 0 ? (
    <EmptyState title={browse.query ? "No matching videos" : "No videos to show"} body={browse.query ? "Try another topic or adjust your filters, or check the next page if available." : "Frame shows videos of four minutes or longer. Check for new uploads later, or browse older uploads if available."} />
  ) : (
    <View>
      <EmptyState title={browse.query ? "Search couldn’t load" : "Couldn't refresh uploads"} body={videosMessage ?? "Check your connection and try again."} />
      <Pressable onPress={retryUploads} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} accessibilityRole="button">
        <RotateCcw size={16} color={palette.accent} />
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList<Video>
      ref={listRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={videos}
      keyExtractor={(video) => video.id}
      renderItem={({ item }) => <View style={{ paddingHorizontal: spacing.lg }}><VideoCard video={item} variant="wide" /></View>}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={personal && videosQuery.data ? <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <Text style={type.bodySoft}>{videosQuery.data.nextPageToken || previousPages.length ? `End of page ${previousPages.length + 1}` : browse.query ? "End of results" : "End of uploads"}</Text>
        {previousPages.length ? <Pressable accessibilityRole="button" disabled={videosQuery.isFetching} onPress={() => { setBrowse({ ...browse, pageToken: previousPages[previousPages.length - 1] }); setPreviousPages(previousPages.slice(0, -1)); listRef.current?.scrollToOffset({ offset: 0, animated: false }); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={styles.retryText}>Previous page</Text></Pressable> : null}
        {videosQuery.data.nextPageToken && videosQuery.data.nextPageToken !== browse.pageToken ? <Pressable accessibilityRole="button" disabled={videosQuery.isFetching} onPress={() => { setPreviousPages([...previousPages, browse.pageToken]); setBrowse({ ...browse, pageToken: videosQuery.data.nextPageToken! }); listRef.current?.scrollToOffset({ offset: 0, animated: false }); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={styles.retryText}>{browse.query ? "Next results page" : "Browse older uploads"}</Text></Pressable> : null}
        <Pressable accessibilityRole="button" disabled={videosQuery.isFetching} onPress={() => { setBrowse({}); setPreviousPages([]); void queryClient.invalidateQueries({ queryKey: ["cached-channel", activeProfileId, id] }); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={styles.retryText}>Check for new uploads</Text></Pressable>
      </View> : null}
      contentContainerStyle={[styles.content, boundedCollection, { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom + spacing.xxl }]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={50}
      windowSize={7}
      removeClippedSubviews
      refreshing={videosQuery.isRefetching}
      onRefresh={retryUploads}
      style={styles.list}
    />
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  list: { flex: 1, backgroundColor: "transparent" },
  content: { flexGrow: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radii.card, backgroundColor: palette.surfaceDeep, flexShrink: 0, overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  channelName: { flex: 1, minWidth: 0 },
  description: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 640 },

  followBtn: { minHeight: 48, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", backgroundColor: palette.accentDeep, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.control },
  followBtnActive: { backgroundColor: palette.activeSoft, borderWidth: 1, borderColor: palette.active },
  followText: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  inlineAction: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", paddingVertical: spacing.sm },
  settingsSection: { marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
  disclosureRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  settingsBody: { gap: spacing.md, paddingBottom: spacing.md },
  settingRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, minHeight: 64 },
  videoSection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
  videoToolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
  searchBody: { gap: spacing.md, paddingBottom: spacing.md },
  durationChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  durationChoice: { flexGrow: 1 },
  searchButton: { minHeight: 48, padding: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep, alignItems: "center", justifyContent: "center" },
  searchButtonText: { ...type.label, color: palette.onDark },
  disabled: { opacity: 0.5 },
  feedback: { ...type.bodySoft, marginHorizontal: spacing.lg, marginTop: spacing.md },
  loadingFeed: { paddingHorizontal: spacing.lg },
  retryButton: { minHeight: 48, marginHorizontal: spacing.lg, marginTop: -spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start" },
  retryText: { ...type.label, color: palette.accent },
  pressed: { opacity: 0.7 },
  });
}
