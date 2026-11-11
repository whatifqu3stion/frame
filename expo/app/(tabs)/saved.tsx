import SectionTabs from "@/components/SectionTabs";
import { isLongFormVideo } from "@/domain/contentPolicy";
import { expireVideo } from "@/domain/metadataRetention";
import { CollectionArrival } from "@/providers/CollectionArrivalProvider";
import Text from "@/components/FrameText";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import InfoButton from "@/components/InfoButton";
import ChoiceOption from "@/components/ChoiceOption";
import { resumeSession } from "@/domain/resumeSession";
import { boundedCollection } from "@/constants/layout";
import SavedRemovalNotice from "@/components/SavedRemovalNotice";
import { useSavedRemoval } from "@/hooks/useSavedRemoval";
import TextField from "@/components/TextField";
import { useFeedback } from "@/hooks/useFeedback";
import Heading from "@/components/Heading";
import MotionView from "@/components/motion/MotionView";
import Pressable from "@/components/motion/ChoicePressable";
import { router, useLocalSearchParams, useFocusEffect, useNavigation } from "expo-router";
import { ArrowRight, Play, Plus, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CollectionPrompt from "@/components/CollectionPrompt";
import EmptyState from "@/components/EmptyState";
import MediaImage from "@/components/MediaImage";
import SessionProgramme from "@/components/SessionProgramme";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { sessionPosition } from "@/domain/sessionFlow";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { shellProfileQueryKeys } from "@/domain/productShell";
import { filterSavedLibrary, resolveSavedCriteria, type SavedFilterCriteria, type SavedViewingFilter } from "@/domain/savedLibrary";
import { useApp } from "@/providers/AppProvider";

const FILTERS: readonly { id: SavedViewingFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "inProgress", label: "In progress" },
];

export default function SavedScreen() {
  const touch = useFeedback();
  const removal = useSavedRemoval();
  const [noticeHeight, setNoticeHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const { bottomBarHeight } = useNavigationLayout();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, activeProfile, followedChannels, sourcesLoading, sourcesError, savedVideos, resumeList, sessions, sessionDraft, libraryLoading, libraryError, refreshLibrary, requirePurchase } = useApp();
  const profileKeys = shellProfileQueryKeys(activeProfileId);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [searchProfile, setSearchProfile] = useState<string | null>(null);
  const { section, savedVideoId, arrivalProfile } = useLocalSearchParams<{ section?: string; savedVideoId?: string; arrivalProfile?: string }>();
  const navigation = useNavigation();
  const list = useRef<FlatList<{ video: (typeof savedVideos)[number]; progressSeconds: number }>>(null);
  const [arrival, setArrival] = useState<{ profile: string; id: string } | null>(null);
  useFocusEffect(useCallback(() => () => setArrival(null), []));
  const [helpProfile, setHelpProfile] = useState<string | null>(null);
  const editing = editingProfile === activeProfileId;
  const planning = section === "sessions";
  const helpOpen = helpProfile === activeProfileId;
  const [showOtherSessions, setShowOtherSessions] = useState(false);
  const [criteria, setCriteria] = useState<SavedFilterCriteria>({ profileId: activeProfileId, query: "", filter: "all" });
  const { query: searchQuery, filter: viewingFilter } = resolveSavedCriteria(criteria, activeProfileId);
  const filteredSaved = useMemo(() => filterSavedLibrary(savedVideos, resumeList, searchQuery, viewingFilter), [resumeList, savedVideos, searchQuery, viewingFilter]);
  const continueWatching = useMemo(() => resumeList.flatMap((resume) => {
    const video = savedVideos.find((candidate) => candidate.id === resume.videoId) ?? (resume.title ? {
      id: resume.videoId,
      fetchedAt: resume.fetchedAt ?? null,
      title: resume.title,
      channelId: "",
      channelTitle: resume.channelTitle ?? "",
      thumbnailUrl: resume.thumbnailUrl ?? "",
      publishedAt: "",
      durationSeconds: resume.durationSeconds ?? 0,
    } : null);
    return video && Number.isFinite(resume.timestampSeconds) && resume.timestampSeconds > 5 ? [{ video, progressSeconds: resume.timestampSeconds, session: resumeSession(resume, sessions) }] : [];
  }), [resumeList, savedVideos, sessions]);
  // Resume rows arrive newest first, including videos that were never saved.
  const latestResume = continueWatching[0];
  const currentSession = sessions.find((item) => item.orderedVideoIds.length > 0 && sessionPosition(item) < item.orderedVideoIds.length) ?? sessions[0] ?? null;
  const draft = sessionDraft?.name || sessionDraft?.orderedVideoIds.length || sessionDraft?.targetMinutes ? sessionDraft : null;
  const hasActiveFilter = searchQuery.trim().length > 0 || viewingFilter !== "all";
  const searchOpen = searchProfile === activeProfileId || hasActiveFilter;

  useEffect(() => {
    if (!savedVideoId || arrivalProfile !== activeProfileId || !navigation.isFocused()) return;
    setArrival({ profile: activeProfileId, id: savedVideoId });
    setEditingProfile(null);
    setSearchProfile(null);
    setCriteria({ profileId: activeProfileId, query: "", filter: "all" });
    router.setParams({ savedVideoId: undefined, arrivalProfile: undefined });
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeProfileId, arrivalProfile, navigation, savedVideoId]);
  const arriving = !planning && !editing && !searchOpen && arrival?.profile === activeProfileId
    ? filteredSaved.find((item) => item.video.id === arrival.id) : undefined;
  const showResume = !planning && !editing && !searchOpen && !arriving && Boolean(latestResume);
  const displayedSaved = useMemo(() => {
    if (arriving) return filteredSaved.filter((item) => item.video.id !== arriving.video.id);
    if (!showResume) return filteredSaved;
    const resumed = new Set(continueWatching.map((item) => item.video.id));
    return filteredSaved.filter((item) => !resumed.has(item.video.id));
  }, [arriving, continueWatching, filteredSaved, showResume]);

  const needsFirstSource = activeProfile?.role !== "managed" && !sourcesLoading && !sourcesError && followedChannels.length === 0;

  const hasSessionVideos = savedVideos.some((video) => isLongFormVideo(expireVideo(video, Date.now())));
  const findVideos = () => {
    if (needsFirstSource) router.push({ pathname: "/add-source", params: { from: "saved" } });
    else router.push("/(tabs)");
  };
  const openSessionBuilder = (): void => {
    if (requirePurchase("sessions")) router.push("/session");
  };

  if (libraryError) return <ScrollView style={styles.screen} contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + 104 }}><View style={styles.page}>
    <ScreenHeader editorial eyebrow="Saved" title="Saved" />
    <EmptyState title="Your library couldn’t load" body="Try again to see your saved videos and sessions." action={{ label: "Try again", onPress: () => { void refreshLibrary().catch(() => Alert.alert("Library unavailable", "Close and reopen Frame to try again.")); } }} />
  </View></ScrollView>;

  return (
    <View style={styles.screen}><FlatList
      ref={list}
      style={styles.screen}
      data={libraryLoading || planning ? [] : displayedSaved}
      keyExtractor={(item) => item.video.id}
      renderItem={({ item }) => <View style={styles.page}><CollectionArrival kind="video" id={item.video.id}><VideoCard video={item.video} variant="wide" progressSeconds={item.progressSeconds} /></CollectionArrival>{editing ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.video.title} from Saved`} style={{ minHeight: 48, alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }} disabled={removal.busy} accessibilityState={{ disabled: removal.busy }} onPress={() => { void removal.remove(item.video); }}><X size={16} color={palette.inkMuted} /><Text style={[type.label, { color: palette.inkMuted }]}>Remove from Saved</Text></Pressable> : null}</View>}
      contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + Math.max(104, removal.removed ? noticeHeight + spacing.lg : 0) }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={8}
      windowSize={7}
      ListHeaderComponent={(
      <View style={styles.page}>
        <ScreenHeader editorial compact={savedVideos.length > 0 || sessions.length > 0 || Boolean(latestResume)} title="Saved"
          titleAction={!libraryLoading && <InfoButton label="How Saved works" expanded={helpOpen}
            onPress={() => setHelpProfile(helpOpen ? null : activeProfileId)} testID="saved-help-toggle" />}
          subtitle={helpOpen && !libraryLoading
            ? "Watching a saved video requires an internet connection. Your saved links, sessions, and progress stay on this device."
            : undefined} />

        <SectionTabs<"videos" | "sessions"> label="Saved sections"
          tabs={[{ value: "videos", label: "Videos" }, { value: "sessions", label: "Sessions" }]}
          value={planning ? "sessions" : "videos"} onChange={(value) => router.setParams({ section: value })} />

        {!libraryLoading && arriving ? <View style={styles.resumeSection}>
          <Heading style={styles.resumeTitle}>Just saved</Heading>
          <VideoCard video={arriving.video} variant="wide" progressSeconds={arriving.progressSeconds} />
        </View> : null}
        {!libraryLoading && showResume && latestResume ? (
          <View style={styles.resumeSection} testID="saved-latest-resume">
            <Heading style={styles.resumeTitle}>Continue watching</Heading>
            {continueWatching.length === 1
              ? <VideoCard video={latestResume.video} variant="wide" progressSeconds={latestResume.progressSeconds} sessionId={latestResume.session?.id} sessionLabel={latestResume.session?.name} />
              : <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalList}>
                  {continueWatching.map((item) => <VideoCard key={item.video.id} video={item.video} variant="compact" progressSeconds={item.progressSeconds} sessionId={item.session?.id} sessionLabel={item.session?.name} />)}
                </ScrollView>}
          </View>
        ) : null}
        {planning ? <View>
        {!libraryLoading && draft ? (
          <Pressable onPress={openSessionBuilder} style={({ pressed }) => [styles.sessionCard, { marginBottom: spacing.sm }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Continue your session draft" testID="session-draft-card">
            <View style={styles.sessionIcon}><Plus size={18} color={palette.active} /></View>
            <View style={styles.flex}><Text style={styles.sessionName}>{draft.name || "Untitled session"}</Text><Text style={styles.sessionMeta}>Draft · {draft.orderedVideoIds.length} videos{draft.targetMinutes ? ` · ${draft.targetMinutes} min target` : ""}</Text></View>
            <ArrowRight size={17} color={palette.inkMuted} />
          </Pressable>
        ) : null}
        {libraryLoading ? <VideoFeedSkeleton count={1} accessibilityLabel="Loading sessions" /> : currentSession ? (
          <View style={styles.programme}><CollectionArrival kind="session" id={currentSession.id}><SessionProgramme profileId={activeProfileId} session={currentSession} savedVideos={savedVideos} onOpen={() => {
            if (requirePurchase("sessions")) router.push({ pathname: "/session/[id]", params: { id: currentSession.id } });
          }} /></CollectionArrival></View>
        ) : !draft ? (
          <CollectionPrompt
            caption={hasSessionVideos
              ? "Choose saved videos, put them in order, and set a time to stop."
              : "Save a video first. Then you can arrange your videos and set a time to stop."}
            action={hasSessionVideos
              ? { label: "Create a session", prominentAdd: true, onPress: openSessionBuilder }
              : { label: needsFirstSource ? "Find a source" : "Find videos", onPress: findVideos }}
          />
        ) : null}
        {currentSession && !draft && hasSessionVideos ? (
          <Pressable onPress={openSessionBuilder} style={({ pressed }) => [styles.createAnother, pressed && styles.pressed]} accessibilityRole="button"><Plus size={16} color={palette.active} /><Text style={[type.label, { color: palette.active }]}>Create another session</Text></Pressable>
        ) : null}
        {sessions.length > 1 ? <Pressable onPress={() => setShowOtherSessions((value) => !value)} style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ expanded: showOtherSessions }}><Text style={type.label}>{showOtherSessions ? "Hide other sessions" : `Other sessions · ${sessions.length - 1}`}</Text></Pressable> : null}
        {showOtherSessions ? <MotionView enter>{sessions.filter((item) => item.id !== currentSession?.id).map((item) => {
          const count = item.orderedVideoIds.length;
          const position = sessionPosition(item);
          const coverId = item.orderedVideoIds[position] ?? item.orderedVideoIds[0];
          const savedCover = savedVideos.find((video) => video.id === coverId);
          const thumbnail = savedCover && expireVideo(savedCover, Date.now()).thumbnailUrl;
          return <Pressable key={item.id} onPress={() => router.push({ pathname: "/session/[id]", params: { id: item.id } })}
            style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open session ${item.name}`}>
            <View style={styles.smallMount} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {thumbnail ? <MediaImage source={{ uri: thumbnail }} cachePolicy="none" contentFit="cover" style={styles.smallCover} />
                : <Play size={19} color={palette.onProgramme} />}
            </View>
            <View style={styles.flex}>
              <Text style={styles.sessionName}>{item.name}</Text>
              <Text style={styles.sessionMeta}>{count} {count === 1 ? "video" : "videos"} · {position >= count ? "Complete" : `Up next: ${position + 1} of ${count}`}</Text>
            </View>
          </Pressable>;
        })}</MotionView> : null}

        </View> : null}
        {!planning && savedVideos.length > 0 ? <>
        <View style={styles.collectionTools}>
          <Text style={type.caption} testID={`saved-${profileKeys.saved.join("-")}`} accessibilityLiveRegion="polite">{hasActiveFilter ? `${filteredSaved.length} of ${savedVideos.length} saved` : `${savedVideos.length} saved ${savedVideos.length === 1 ? "video" : "videos"}`}</Text>
          <View style={styles.toolButtons}>
          <Pressable onPress={() => setEditingProfile(editing ? null : activeProfileId)} style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ selected: editing }}><Text style={[type.label, { color: palette.active }]}>{editing ? "Done" : "Edit Saved"}</Text></Pressable>
          <Pressable style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ expanded: searchOpen }} onPress={() => {
            if (searchOpen) { setSearchProfile(null); setCriteria({ profileId: activeProfileId, query: "", filter: "all" }); }
            else setSearchProfile(activeProfileId);
          }}><Text style={[type.label, { color: palette.active }]}>{searchOpen ? hasActiveFilter ? "Clear & close search" : "Close search" : "Search & filter"}</Text></Pressable>
          </View>
        </View>
        {searchOpen ? <View style={styles.searchTools}><TextField
            leading={<Search size={18} color={palette.inkMuted} strokeWidth={1.8} />}
            value={searchQuery}
            onChangeText={(query) => setCriteria({ profileId: activeProfileId, query, filter: viewingFilter })}
            placeholder="Search titles or sources"
            placeholderTextColor={palette.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search saved videos by title or source"
            testID="saved-search"
            trailing={searchQuery ? (
            <Pressable onPress={() => setCriteria({ profileId: activeProfileId, query: "", filter: viewingFilter })} style={styles.clearSearch} accessibilityRole="button" accessibilityLabel="Clear Saved search" testID="clear-saved-search">
              <X size={17} color={palette.inkMuted} />
            </Pressable>
          ) : null}
          />
        <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Saved viewing status">
          {FILTERS.map((filter) => {
            const isSelected = viewingFilter === filter.id;
            return (
              <ChoiceOption key={filter.id} label={filter.label} selected={isSelected} onPress={() => { if (viewingFilter === filter.id) return; setCriteria({ profileId: activeProfileId, query: searchQuery, filter: filter.id }); touch.selection(); }} style={styles.filterChip} testID={`saved-filter-${filter.id}`} />
            );
          })}
        </View>
        </View> : null}
        </> : null}
      </View>
      )}
      ListEmptyComponent={planning ? null : <View style={styles.page}>
        {libraryLoading ? <VideoFeedSkeleton count={3} accessibilityLabel="Loading saved videos" /> : savedVideos.length === 0 ? (
          <CollectionPrompt
            caption={needsFirstSource ? "Find a creator, then save a video to watch later." : "Save a video from Today or while watching to find it here."}
            action={needsFirstSource
              ? { label: "Find a source", onPress: () => router.push({ pathname: "/add-source", params: { from: "saved" } }) }
              : { label: "Open Today", onPress: () => router.push("/(tabs)") }}
          />
        ) : hasActiveFilter ? <CollectionPrompt caption="No saved videos match this search or filter."
          action={{ label: "Clear filters", onPress: () => setCriteria({ profileId: activeProfileId, query: "", filter: "all" }) }} /> : null}
      </View>}

    />
    {removal.removed ? <View pointerEvents="box-none" style={{ position: "absolute", left: insets.left, right: insets.right, bottom: Math.max(insets.bottom, bottomBarHeight) + spacing.sm }}><View style={styles.page} onLayout={(event) => setNoticeHeight(event.nativeEvent.layout.height)}><SavedRemovalNotice targetId={removal.removed.id} title={removal.removed.title} busy={removal.busy} onUndo={() => { void removal.undo(); }} onDismiss={removal.dismiss} /></View></View> : null}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: "transparent" },
    page: { ...boundedCollection, paddingHorizontal: spacing.page },
    flex: { flex: 1 },
    resumeSection: { marginTop: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSoft },
    resumeTitle: { ...type.heading, marginBottom: spacing.md },
    collectionTools: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.md }, searchTools: { marginBottom: spacing.lg },
    toolButtons: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.md },
    programme: { marginTop: spacing.lg },
    otherSessions: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
    horizontalList: { gap: spacing.md, paddingRight: spacing.page },
    clearSearch: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
    filterChip: { flexGrow: 1, flexBasis: 140 },
    sessionCard: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
    smallMount: { width: 80, aspectRatio: 1.6, padding: 3, alignItems: "center", justifyContent: "center", backgroundColor: palette.programme, borderRadius: radii.mount },
    smallCover: { width: "100%", height: "100%" },
    sessionIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: palette.activeSoft },
    sessionName: { ...type.heading, fontSize: 18, lineHeight: 23 },
    sessionMeta: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    createAnother: { minHeight: 48, flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.sm },
    pressed: { opacity: 0.74 },
  });
}
