import { CollectionArrival } from "@/providers/CollectionArrivalProvider";
import Text from "@/components/FrameText";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
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
import { router } from "expo-router";
import { ArrowRight, Play, Plus, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
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
  const { activeProfileId, savedVideos, resumeList, sessions, sessionDraft, libraryLoading, libraryError, refreshLibrary, requirePurchase } = useApp();
  const profileKeys = shellProfileQueryKeys(activeProfileId);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [searchProfile, setSearchProfile] = useState<string | null>(null);
  const [planningProfile, setPlanningProfile] = useState<string | null>(null);
  const [helpProfile, setHelpProfile] = useState<string | null>(null);
  const editing = editingProfile === activeProfileId;
  const planning = planningProfile === activeProfileId;
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
    return video ? [{ video, progressSeconds: resume.timestampSeconds, session: resumeSession(resume, sessions) }] : [];
  }), [resumeList, savedVideos, sessions]);
  // Resume rows arrive newest first, including videos that were never saved.
  const latestResume = continueWatching.find((item) => Number.isFinite(item.progressSeconds) && item.progressSeconds > 5);
  const currentSession = sessions.find((item) => item.orderedVideoIds.length > 0 && sessionPosition(item) < item.orderedVideoIds.length) ?? sessions[0] ?? null;
  const draft = sessionDraft?.name || sessionDraft?.orderedVideoIds.length || sessionDraft?.targetMinutes ? sessionDraft : null;
  const hasActiveFilter = searchQuery.trim().length > 0 || viewingFilter !== "all";
  const searchOpen = searchProfile === activeProfileId || hasActiveFilter;

  const openSessionBuilder = (): void => {
    if (requirePurchase("sessions")) router.push("/session");
  };

  if (libraryError) return <ScrollView style={styles.screen} contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + 104 }}><View style={styles.page}>
    <ScreenHeader editorial eyebrow="Saved" title="Saved" />
    <EmptyState title="Your library couldn’t load" body="Try again to see your saved videos and sessions." action={{ label: "Try again", onPress: () => { void refreshLibrary().catch(() => Alert.alert("Library unavailable", "Close and reopen Frame to try again.")); } }} />
  </View></ScrollView>;

  return (
    <View style={styles.screen}><FlatList
      style={styles.screen}
      data={libraryLoading || planning ? [] : filteredSaved}
      keyExtractor={(item) => item.video.id}
      renderItem={({ item }) => <View style={styles.page}><CollectionArrival kind="video" id={item.video.id}><VideoCard video={item.video} variant="wide" progressSeconds={item.progressSeconds} /></CollectionArrival>{editing ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.video.title} from Saved`} style={{ minHeight: 48, alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }} disabled={removal.busy} accessibilityState={{ disabled: removal.busy }} onPress={() => { void removal.remove(item.video); }}><X size={16} color={palette.inkMuted} /><Text style={[type.label, { color: palette.inkMuted }]}>Remove from Saved</Text></Pressable> : null}</View>}
      contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + Math.max(104, removal.removed ? noticeHeight + spacing.lg : 0) }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={8}
      windowSize={7}
      ListHeaderComponent={(
      <View style={styles.page}>
        <ScreenHeader editorial compact={savedVideos.length > 0 || planning || Boolean(latestResume)} eyebrow="Saved" title="Your Saved" subtitle={planning ? "A short plan, or a place to pick up again." : savedVideos.length > 0 || latestResume ? undefined : "Your finds, ready when you are."} />

        {!libraryLoading && !planning && !editing && !searchOpen && latestResume ? (
          <View style={styles.resumeSection} testID="saved-latest-resume">
            <Heading style={styles.resumeTitle}>{latestResume.session ? `Continue ${latestResume.session.name} · video ${latestResume.session.currentIndex + 1} of ${latestResume.session.orderedVideoIds.length}` : "Continue watching"}</Heading>
            <VideoCard video={latestResume.video} variant="wide" progressSeconds={latestResume.progressSeconds} sessionId={latestResume.session?.id} sessionLabel={latestResume.session?.name} />
          </View>
        ) : null}
        <View style={styles.libraryActions}>
          <Pressable onPress={() => setPlanningProfile(planning ? null : activeProfileId)} style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ selected: planning }}><Text style={[type.label, { color: palette.active }]}>{planning ? "Back to saved videos" : `Sessions & progress${draft ? " · draft" : currentSession ? ` · ${currentSession.name}` : ""}`}</Text></Pressable>
          {!planning && savedVideos.length > 0 ? <Pressable onPress={() => setEditingProfile(editing ? null : activeProfileId)} style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ selected: editing }}><Text style={[type.label, { color: palette.active }]}>{editing ? "Done" : "Edit Saved"}</Text></Pressable> : null}
        </View>
        {planning ? <View style={styles.planning}>
        <SectionTitle label={currentSession ? "Your session" : "Plan a session"} styles={styles} />
        {!libraryLoading && draft ? (
          <Pressable onPress={openSessionBuilder} style={({ pressed }) => [styles.sessionCard, { marginBottom: spacing.sm }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Continue your session draft" testID="session-draft-card">
            <View style={styles.sessionIcon}><Plus size={18} color={palette.active} /></View>
            <View style={styles.flex}><Text style={styles.sessionName}>{draft.name || "Untitled session"}</Text><Text style={styles.sessionMeta}>Draft · {draft.orderedVideoIds.length} videos{draft.targetMinutes ? ` · ${draft.targetMinutes} min target` : ""}</Text></View>
            <ArrowRight size={17} color={palette.inkMuted} />
          </Pressable>
        ) : null}
        {libraryLoading ? <VideoFeedSkeleton count={1} accessibilityLabel="Loading sessions" /> : currentSession ? (
          <CollectionArrival kind="session" id={currentSession.id}><SessionProgramme profileId={activeProfileId} session={currentSession} savedVideos={savedVideos} onOpen={() => {
            if (requirePurchase("sessions")) router.push({ pathname: "/session/[id]", params: { id: currentSession.id } });
          }} /></CollectionArrival>
        ) : (
          <View>
            <Pressable onPress={openSessionBuilder} style={({ pressed }) => [styles.createSession, pressed && styles.pressed]} accessibilityRole="button">
              <Plus size={16} color={palette.onDark} />
              <Text style={styles.createSessionText}>Create a session</Text>
            </Pressable>
          </View>
        )}
        {currentSession ? (
          <Pressable onPress={openSessionBuilder} style={({ pressed }) => [styles.createAnother, pressed && styles.pressed]} accessibilityRole="button"><Plus size={16} color={palette.active} /><Text style={[type.label, { color: palette.active }]}>Create another session</Text></Pressable>
        ) : null}
        {sessions.length > 1 ? <Pressable onPress={() => setShowOtherSessions((value) => !value)} style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ expanded: showOtherSessions }}><Text style={type.label}>{showOtherSessions ? "Hide other sessions" : `Other sessions · ${sessions.length - 1}`}</Text></Pressable> : null}
        {showOtherSessions ? <MotionView enter>{sessions.filter((item) => item.id !== currentSession?.id).map((item) => (
          <Pressable key={item.id} onPress={() => router.push({ pathname: "/session/[id]", params: { id: item.id } })} style={({ pressed }) => [styles.sessionCard, { marginTop: spacing.sm }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open session ${item.name}`}>
            <View style={styles.sessionIcon}><Play size={17} color={palette.active} /></View><View style={styles.flex}><Text style={styles.sessionName}>{item.name}</Text><Text style={styles.sessionMeta}>{item.orderedVideoIds.length} videos · {sessionPosition(item) >= item.orderedVideoIds.length ? "Complete" : `Next ${sessionPosition(item) + 1}`}</Text></View><ArrowRight size={17} color={palette.inkMuted} />
          </Pressable>
        ))}</MotionView> : null}

        {continueWatching.length > 0 ? <><SectionTitle label="Continue watching" testID={`continue-${profileKeys.continueWatching.join("-")}`} styles={styles} />
        {libraryLoading ? <VideoFeedSkeleton count={2} accessibilityLabel="Loading continue watching" /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {continueWatching.map((item) => <VideoCard key={item.video.id} video={item.video} variant="compact" progressSeconds={item.progressSeconds} sessionId={item.session?.id} sessionLabel={item.session?.name} />)}
          </ScrollView>
        )}</> : null}

        </View> : null}
        {!planning && savedVideos.length > 0 ? <>
        <View style={styles.collectionTools}>
          <Text style={type.caption} testID={`saved-${profileKeys.saved.join("-")}`} accessibilityLiveRegion="polite">{hasActiveFilter ? `${filteredSaved.length} of ${savedVideos.length} saved` : `${savedVideos.length} saved ${savedVideos.length === 1 ? "video" : "videos"}`}</Text>
          <Pressable style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ expanded: searchOpen }} onPress={() => {
            if (searchOpen) { setSearchProfile(null); setCriteria({ profileId: activeProfileId, query: "", filter: "all" }); }
            else setSearchProfile(activeProfileId);
          }}><Text style={[type.label, { color: palette.active }]}>{searchOpen ? hasActiveFilter ? "Clear & close search" : "Close search" : "Search & filter"}</Text></Pressable>
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
      ListEmptyComponent={planning ? null : <View style={styles.page}>{libraryLoading ? <VideoFeedSkeleton count={3} accessibilityLabel="Loading saved videos" /> : savedVideos.length === 0 ? <EmptyState gallery compact title="No saved videos yet" body="Save a video from Today or while watching to find it here." action={{ label: "Open Today", onPress: () => router.push("/(tabs)") }} /> : <EmptyState compact title="No matching videos" body={hasActiveFilter ? "Try another title, source, or filter." : "Your saved videos are still here."} />}</View>}
      ListFooterComponent={!planning && !libraryLoading ? (
        <View style={styles.page}>
          <View style={styles.savedHelp}>
            <Pressable onPress={() => setHelpProfile(helpOpen ? null : activeProfileId)} style={styles.helpToggle} accessibilityRole="button" aria-expanded={helpOpen} accessibilityState={{ expanded: helpOpen }} testID="saved-help-toggle">
              <Text style={styles.helpLabel}>How Saved works</Text>
              <DisclosureIndicator expanded={helpOpen} size={16} color={palette.inkMuted} />
            </Pressable>
            {helpOpen ? <MotionView enter><Text style={styles.helpBody}>Saved videos are links, not downloads. Watching needs an internet connection. Your saved videos, sessions, and progress stay on this device and don’t sync between devices.</Text></MotionView> : null}
          </View>
        </View>
      ) : null}
    />
    {removal.removed ? <View pointerEvents="box-none" style={{ position: "absolute", left: insets.left, right: insets.right, bottom: Math.max(insets.bottom, bottomBarHeight) + spacing.sm }}><View style={styles.page} onLayout={(event) => setNoticeHeight(event.nativeEvent.layout.height)}><SavedRemovalNotice targetId={removal.removed.id} title={removal.removed.title} busy={removal.busy} onUndo={() => { void removal.undo(); }} onDismiss={removal.dismiss} /></View></View> : null}
    </View>
  );
}

function SectionTitle({ label, testID, styles }: { label: string; testID?: string; styles: ReturnType<typeof createStyles> }) {
  return <Heading style={styles.sectionTitle} testID={testID}>{label}</Heading>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: "transparent" },
    page: { ...boundedCollection, paddingHorizontal: spacing.page },
    flex: { flex: 1 },
    resumeSection: { marginTop: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSoft },
    resumeTitle: { ...type.heading, marginBottom: spacing.md },
    savedHelp: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.borderSoft },
    helpToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm },
    helpLabel: { ...type.label, color: palette.inkMuted, flexShrink: 1 },
    helpBody: { ...type.bodySoft, color: palette.inkSoft, paddingBottom: spacing.md },
    collectionTools: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.md }, searchTools: { marginBottom: spacing.lg },
    libraryActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: spacing.md }, planning: { paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
    otherSessions: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
    sectionTitle: { ...type.heading, marginTop: spacing.xl, marginBottom: spacing.md },
    horizontalList: { gap: spacing.md, paddingRight: spacing.page },
    clearSearch: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
    filterChip: { flexGrow: 1, flexBasis: 140 },
    sessionCard: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
    sessionIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: palette.activeSoft },
    sessionName: { ...type.heading, fontSize: 18, lineHeight: 23 },
    sessionMeta: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    createAnother: { minHeight: 48, flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.sm },
    createSession: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep },
    createSessionText: { ...type.label, color: palette.onDark },
    pressed: { opacity: 0.74 },
  });
}
