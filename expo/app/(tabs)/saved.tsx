import TextField from "@/components/TextField";
import { useFeedback } from "@/hooks/useFeedback";
import MotionView from "@/components/motion/MotionView";
import Pressable from "@/components/motion/ChoicePressable";
import { router } from "expo-router";
import { ArrowRight, Play, Plus, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import SessionProgramme from "@/components/SessionProgramme";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { sessionPosition } from "@/domain/sessionFlow";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { shellProfileQueryKeys } from "@/domain/productShell";
import { filterSavedLibrary, resolveSavedCriteria, type SavedFilterCriteria, type SavedViewingFilter } from "@/domain/savedLibrary";
import { useApp } from "@/providers/AppProvider";

const FILTERS: readonly { id: SavedViewingFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unwatched", label: "Unwatched" },
  { id: "inProgress", label: "In progress" },
];

export default function SavedScreen() {
  const touch = useFeedback();
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, savedVideos, resumeList, sessions, sessionDraft, libraryLoading, libraryError, refreshLibrary, requirePurchase, unsaveVideo } = useApp();
  const profileKeys = shellProfileQueryKeys(activeProfileId);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [planningProfile, setPlanningProfile] = useState<string | null>(null);
  const editing = editingProfile === activeProfileId;
  const planning = planningProfile === activeProfileId;
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
    return video ? [{ video, progressSeconds: resume.timestampSeconds }] : [];
  }), [resumeList, savedVideos]);
  const currentSession = sessions.find((item) => item.orderedVideoIds.length > 0 && sessionPosition(item) < item.orderedVideoIds.length) ?? sessions[0] ?? null;
  const draft = sessionDraft?.name || sessionDraft?.orderedVideoIds.length ? sessionDraft : null;
  const hasActiveFilter = searchQuery.trim().length > 0 || viewingFilter !== "all";

  const openSessionBuilder = (): void => {
    if (requirePurchase("sessions")) router.push("/session");
  };

  if (libraryError) return <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}><View style={styles.page}>
    <ScreenHeader eyebrow="Saved" title="Saved" />
    <EmptyState title="Your library couldn’t load" body="Try again to see your saved videos and sessions." action={{ label: "Try again", onPress: () => { void refreshLibrary().catch(() => Alert.alert("Library unavailable", "Close and reopen Frame to try again.")); } }} />
  </View></ScrollView>;

  return (
    <FlatList
      style={styles.screen}
      data={libraryLoading ? [] : filteredSaved}
      keyExtractor={(item) => item.video.id}
      renderItem={({ item }) => <View style={styles.page}><VideoCard video={item.video} variant="wide" progressSeconds={item.progressSeconds} />{editing ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.video.title} from Saved`} style={{ minHeight: 48, alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }} onPress={() => Alert.alert("Remove saved video?", `“${item.video.title}” will be removed from Saved.`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => { void unsaveVideo(item.video.id).catch(() => Alert.alert("Couldn’t remove video", "Try again when you’re ready.")); } }])}><X size={16} color={palette.inkMuted} /><Text style={[type.label, { color: palette.inkMuted }]}>Remove from Saved</Text></Pressable> : null}</View>}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={8}
      windowSize={7}
      ListHeaderComponent={(
      <View style={styles.page}>
        <ScreenHeader eyebrow="Saved" title="Your Saved" subtitle="Your finds, ready when you are." />

        <View style={styles.libraryActions}>
          <Pressable onPress={() => setPlanningProfile(planning ? null : activeProfileId)} style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ expanded: planning }}><Text style={[type.label, { color: palette.active }]}>{planning ? "Hide sessions & progress" : `Sessions & progress${draft ? " · draft" : currentSession ? ` · ${sessions.length}` : ""}`}</Text></Pressable>
          {savedVideos.length > 0 ? <Pressable onPress={() => setEditingProfile(editing ? null : activeProfileId)} style={styles.otherSessions} accessibilityRole="button" accessibilityState={{ selected: editing }}><Text style={[type.label, { color: palette.active }]}>{editing ? "Done" : "Edit Saved"}</Text></Pressable> : null}
        </View>
        {planning ? <View style={styles.planning}>
        <SectionTitle label="Current session" styles={styles} />
        {!libraryLoading && draft ? (
          <Pressable onPress={openSessionBuilder} style={({ pressed }) => [styles.sessionCard, { marginBottom: spacing.sm }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Continue your session draft" testID="session-draft-card">
            <View style={styles.sessionIcon}><Plus size={18} color={palette.active} /></View>
            <View style={styles.flex}><Text style={styles.sessionName}>{draft.name || "Untitled session"}</Text><Text style={styles.sessionMeta}>Draft · {draft.orderedVideoIds.length} of {PRODUCT_LIMITS.sessionDraftMaxItems} videos</Text></View>
            <ArrowRight size={17} color={palette.inkMuted} />
          </Pressable>
        ) : null}
        {libraryLoading ? <VideoFeedSkeleton count={1} accessibilityLabel="Loading sessions" /> : currentSession ? (
          <SessionProgramme profileId={activeProfileId} session={currentSession} savedVideos={savedVideos} onOpen={() => {
            if (requirePurchase("sessions")) router.push({ pathname: "/session/[id]", params: { id: currentSession.id } });
          }} />
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
            {continueWatching.map((item) => <VideoCard key={item.video.id} video={item.video} variant="compact" progressSeconds={item.progressSeconds} />)}
          </ScrollView>
        )}</> : null}

        </View> : null}
        <SectionTitle label="Saved videos" testID={`saved-${profileKeys.saved.join("-")}`} styles={styles} />
        <TextField
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
              <Pressable
                key={filter.id}
                onPress={() => { if (viewingFilter === filter.id) return; setCriteria({ profileId: activeProfileId, query: searchQuery, filter: filter.id }); touch.selection(); }}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                testID={`saved-filter-${filter.id}`}
              >
                <Text style={[styles.filterText, isSelected && styles.filterTextSelected]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {!libraryLoading && savedVideos.length > 0 ? (
          <Text style={styles.resultCount} accessibilityLiveRegion="polite">{filteredSaved.length} of {savedVideos.length} saved</Text>
        ) : null}
      </View>
      )}
      ListEmptyComponent={<View style={styles.page}>{libraryLoading ? <VideoFeedSkeleton count={3} accessibilityLabel="Loading saved videos" /> : savedVideos.length === 0 ? <EmptyState compact title="No saved videos yet" body="Save a video from Today or while watching to find it here." action={{ label: "Open Today", onPress: () => router.push("/(tabs)") }} /> : <EmptyState compact title="No matching videos" body={hasActiveFilter ? "Try another title, source, or filter." : "Your saved videos are still here."} />}</View>}
    />
  );
}

function SectionTitle({ label, testID, styles }: { label: string; testID?: string; styles: ReturnType<typeof createStyles> }) {
  return <Text accessibilityRole="header" style={styles.sectionTitle} testID={testID}>{label}</Text>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    page: { paddingHorizontal: spacing.page },
    flex: { flex: 1 },
    libraryActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: spacing.md }, planning: { paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
    otherSessions: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
    sectionTitle: { ...type.heading, marginTop: spacing.xl, marginBottom: spacing.md },
    horizontalList: { gap: spacing.md, paddingRight: spacing.page },
    clearSearch: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
    filters: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    filterChip: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    filterChipSelected: { backgroundColor: palette.activeSoft, borderColor: palette.active },
    filterText: { ...type.label, color: palette.inkSoft, textAlign: "center" },
    filterTextSelected: { color: palette.active },
    resultCount: { ...type.caption, marginTop: spacing.md, marginBottom: spacing.md, color: palette.inkMuted },
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

