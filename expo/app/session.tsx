import PlaybackAction from "@/components/PlaybackAction";
import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import SelectionArtwork from "@/components/motion/SelectionArtwork";
import ProgrammeArtwork from "@/components/ProgrammeArtwork";
import { motion } from "@/constants/motion";
import Heading from "@/components/Heading";
import InfoDisclosure from "@/components/InfoDisclosure";
import { getLatestTodayVideos, resetSessionRun } from "@/db/database";
import { isLongFormVideo } from "@/domain/contentPolicy";
import { boundedCollection } from "@/constants/layout";
import MediaImage from "@/components/MediaImage";
import TextField from "@/components/TextField";
import { useHeaderHeight } from "@react-navigation/elements";
import { usePreventRemove } from "@react-navigation/native";
import { useDiscardChanges } from "@/hooks/useDiscardChanges";
import PositionedRow from "@/components/motion/PositionedRow";
import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import { useQuery } from "@tanstack/react-query";
import { expireVideo } from "@/domain/metadataRetention";
import { router, useLocalSearchParams, useNavigation, type Href } from "expo-router";
import { Search, ChevronDown, ChevronUp, Save, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, SectionList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { formatDuration } from "@/services/youtube";
import { defaultSessionName, normalizeSessionTarget, SESSION_TARGET_MINUTES, sessionAdditionSummary, sessionBudgetSummary, sessionRuntime } from "@/domain/sessionFlow";
import type { Video } from "@/types";

export default function SessionBuilder() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeProfileId, profileSwitching, prefs, savedVideos, sessions, sessionDraft, sessionDraftLoading, libraryError, refreshLibrary, saveSessionDraft, clearSessionDraft, createSession, updateSessionVideos, requirePurchase } = useApp();
  const defaultName = defaultSessionName(sessions);
  const existingSession = useMemo(() => sessions.find((session) => session.id === id), [id, sessions]);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const persistLock = useRef(false);
  const savedDraft = useRef(false);
  const [search, setSearch] = useState("");
  const [budgetMinutes, setBudgetMinutes] = useState<number | null>(30);
  const [customMinutes, setCustomMinutes] = useState("30");
  const [name, setName] = useState<string>("");
  const [hydratedProfile, setHydratedProfile] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [draftState, setDraftState] = useState<"saving" | "saved" | "error" | null>(null);
  const [draftAttempt, setDraftAttempt] = useState(0);
  const draftRevision = JSON.stringify([name, selected, budgetMinutes]);
  const [savedRevision, setSavedRevision] = useState<string | null>(null);

  const [destination, setDestination] = useState<Href | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const canLeaveScope = hydratedProfile === activeProfileId && !profileSwitching && (Platform.isTV || prefs.hasCompletedOnboarding);
  const scope = useRef({ profile: activeProfileId, active: canLeaveScope });
  scope.current = { profile: activeProfileId, active: canLeaveScope };
  const dirty = Boolean(existingSession ? (name.trim() !== existingSession.name || selected.join(",") !== existingSession.orderedVideoIds.join(",") || budgetMinutes !== normalizeSessionTarget(existingSession.targetMinutes)) : !id && (name || selected.length || budgetMinutes) && savedRevision !== draftRevision);
  const confirmExit = useDiscardChanges(dirty, `${activeProfileId}:${id ?? "new"}`, canLeaveScope && !isSaving && !destination);
  usePreventRemove(canLeaveScope && !destination && (dirty || isSaving), ({ data }) => {
    // Wait for a write to finish before honoring a user exit.
    if (persistLock.current) return;
    confirmExit(() => navigation.dispatch(data.action));
  });
  useEffect(() => {
    // Render once with the removal guard disabled before replacing a saved editor.
    if (destination && canLeaveScope) router.replace(destination);
  }, [canLeaveScope, destination]);

  useEffect(() => {
    if (hydratedProfile === activeProfileId || sessionDraftLoading || libraryError) return;
    if (id && !existingSession) return;
    setSelected((id ? existingSession?.orderedVideoIds : sessionDraft?.orderedVideoIds)?.slice(0, PRODUCT_LIMITS.sessionDraftMaxItems) ?? []);
    setName((id ? existingSession?.name : sessionDraft?.name) ?? "");
    setBudgetMinutes((normalizeSessionTarget(id ? existingSession?.targetMinutes : sessionDraft?.targetMinutes) ?? 30));
    setCustomMinutes(String(normalizeSessionTarget(id ? existingSession?.targetMinutes : sessionDraft?.targetMinutes) ?? 30));
    setHydratedProfile(activeProfileId);
  }, [activeProfileId, existingSession, hydratedProfile, id, sessionDraft, sessionDraftLoading, libraryError]);

  const hasDraft = Boolean(sessionDraft);
  useEffect(() => {
    if (id || hydratedProfile !== activeProfileId || isSaving || destination || savedDraft.current) return;
    let current = true;
    setDraftState("saving");
    const write = !name && !selected.length && (budgetMinutes === 30 || budgetMinutes === null)
      ? hasDraft ? clearSessionDraft() : Promise.resolve()
      : saveSessionDraft({ name, orderedVideoIds: selected, targetMinutes: budgetMinutes });
    void write.then(() => { if (current) { setSavedRevision(draftRevision); setDraftState("saved"); } })
      .catch(() => { if (current) setDraftState("error"); });
    return () => { current = false; };
  }, [activeProfileId, budgetMinutes, clearSessionDraft, hasDraft, hydratedProfile, id, name, saveSessionDraft, selected, draftAttempt, draftRevision, isSaving, destination]);

  const metadataIds = [...new Set(selected)].filter(id => !savedVideos.some(video => video.id === id)).sort();
  const selectedMedia = useQuery({
    queryKey: ["session-editor-media", activeProfileId, metadataIds.join(",")], networkMode: "always",
    queryFn: async () => getLatestTodayVideos(activeProfileId, metadataIds),
    enabled: hydratedProfile === activeProfileId && selected.length > 0,
  });
  const pool = useMemo<Video[]>(() => [...new Map([
    ...(selectedMedia.data ?? []).filter((video): video is Video => Boolean(video)),
    ...savedVideos,
  ].map((video) => [video.id, expireVideo(video, Date.now())])).values()], [savedVideos, selectedMedia.data]);

  const mediaById = useMemo(() => new Map(pool.map(video => [video.id, video])), [pool]);
  const positions = useMemo(() => new Map(selected.map((id, index) => [id, index + 1])), [selected]);
  const selectionKey = selected.join(",");

  const filteredPool = useMemo(() => pool.filter((video) => (selected.includes(video.id) || isLongFormVideo(video)) && `${video.title} ${video.channelTitle}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [pool, search, selected]);

  const runtime = useMemo(() => sessionRuntime(selected, pool), [pool, selected]);
  const durationSummary = `${runtime.seconds > 0 ? `${runtime.unknown ? "At least " : ""}${formatDuration(runtime.seconds)}` : "Duration unavailable"}${runtime.seconds > 0 && runtime.unknown ? " · some durations unavailable" : ""}`;

  const move = useCallback((videoId: string, direction: -1 | 1): void => {
    const next = [...selectedRef.current];
    const index = next.indexOf(videoId);
    if (persistLock.current || index < 0 || index >= next.length || index + direction < 0 || index + direction >= next.length) return;
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    selectedRef.current = next; setSelected(next); feedback.selection();
    AccessibilityInfo.announceForAccessibility(`Video moved to position ${index + direction + 1}.`);
  }, [feedback]);

  const toggle = useCallback((videoId: string): void => {
    if (persistLock.current || !requirePurchase("sessions")) return;
    const previous = selectedRef.current;
    if (!previous.includes(videoId) && previous.length >= PRODUCT_LIMITS.sessionDraftMaxItems) return;
    const next = previous.includes(videoId) ? previous.filter((id) => id !== videoId) : [...previous, videoId];
    selectedRef.current = next; setSelected(next); feedback.selection();
  }, [feedback, requirePurchase]);

  const persistSession = useCallback(async (): Promise<string | null> => {
    if (persistLock.current || !requirePurchase("sessions")) return null;
    const sessionName = name.trim() || existingSession?.name || defaultName;
    if (!budgetMinutes) { Alert.alert("Choose a duration", "Enter a whole number of minutes from 1 to 1440."); return null; }
    if (selected.length === 0) {
      Alert.alert("Choose a video", "A session needs at least one video.");
      return null;
    }

    if (selected.some((id) => !isLongFormVideo(pool.find((video) => video.id === id)))) {
      Alert.alert("Long-form videos only", "Remove short-form videos or refresh unavailable details in Saved before saving. Every video must be at least four minutes long.");
      return null;
    }
    persistLock.current = true;
    setIsSaving(true);
    try {
      if (existingSession) {
        await updateSessionVideos(existingSession.id, selected, budgetMinutes, sessionName);
        return existingSession.id;
      }
      await saveSessionDraft({ name: sessionName, orderedVideoIds: selected, targetMinutes: budgetMinutes });
      const created = await createSession(sessionName, selected, budgetMinutes);
      if (created) {
        savedDraft.current = true;
        try { await clearSessionDraft(); }
        catch { Alert.alert("Session saved", "The draft couldn’t be cleared. Your new session is ready in Saved."); }
      }
      return created?.id ?? null;
    } catch {
      Alert.alert("Couldn’t save session", "Your edits are still open. Try saving again before leaving.");
      return null;
    } finally {
      persistLock.current = false;
      setIsSaving(false);
    }
  }, [budgetMinutes, clearSessionDraft, createSession, defaultName, existingSession, name, requirePurchase, saveSessionDraft, selected, updateSessionVideos, pool]);

  const save = useCallback(async (): Promise<void> => {
    const done = feedback.capture();
    const sessionId = await persistSession();
    if (!sessionId || !alive.current || !scope.current.active || scope.current.profile !== activeProfileId) return;
    done(existingSession ? "commit" : "milestone", !existingSession || existingSession.name !== name.trim() || existingSession.orderedVideoIds.join(",") !== selected.join(","));
    setDestination({ pathname: "/session/[id]", params: { id: sessionId, assembled: "1" } });
  }, [activeProfileId, existingSession, feedback, name, persistSession, selected]);

  const saveAndBegin = useCallback(async (): Promise<void> => {
    const done = feedback.capture();
    const sessionId = await persistSession();
    if (!sessionId || !alive.current || !scope.current.active || scope.current.profile !== activeProfileId) return;
    try { await resetSessionRun(activeProfileId, sessionId); } catch { Alert.alert("Couldn’t start session", "Your plan is saved. Open it from Saved to try again."); return; }
    done("commit");
    setDestination({
      pathname: FRAME_PLAYBACK_ROUTE,
      params: { id: selected[0], savedSessionId: sessionId, sessionProfileId: activeProfileId },
    });
  }, [activeProfileId, feedback, persistSession, selected]);

  const openToday = useCallback((): void => {
    if (persistLock.current) return;
    confirmExit(() => setDestination("/(tabs)"));
  }, [confirmExit]);

  if (libraryError) return <View style={styles.screen}><EmptyState title="Your library couldn’t load" body="Try again before editing this session." action={{ label: "Try again", onPress: () => { void refreshLibrary().catch(() => Alert.alert("Library unavailable", "Close and reopen Frame to try again.")); } }} /></View>;

  if (hydratedProfile !== activeProfileId || (id && !existingSession)) {
    return <View style={styles.screen}><EmptyState title={id && !existingSession ? "Session unavailable" : "Opening your draft"} body={id && !existingSession ? "It may have been removed from this profile." : "Loading your saved draft."} /></View>;
  }

  const header = (
    <View style={styles.header}>
      <Heading level={1} style={styles.title}>{existingSession ? "Edit session" : "New session"}</Heading>
      <Text style={styles.subtitle}>{existingSession ? "Changes apply when you save." : "Your draft saves automatically."}</Text>
      {!id && !isSaving && draftState ? <View accessibilityLiveRegion="polite">
        <Text style={[type.bodySoft, { marginTop: spacing.sm, color: draftState === "error" ? palette.danger : palette.inkMuted }]}>{draftState !== "error" && savedRevision !== draftRevision ? "Saving draft…" : draftState === "error" ? "Draft couldn’t save. Try again before leaving." : "Draft saved on this device"}</Text>
        {draftState === "error" ? <Pressable accessibilityRole="button" onPress={() => setDraftAttempt((value) => value + 1)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={type.label}>Retry saving draft</Text></Pressable> : null}
      </View> : null}
      <Text style={[type.label, { marginTop: spacing.lg }]}>Session name · optional</Text>
      <TextField
        editable={!isSaving}
        value={name}
        onChangeText={setName}
        placeholder={existingSession?.name || defaultName}
        placeholderTextColor={palette.inkMuted}
        containerStyle={styles.nameInput}
        returnKeyType="done"
        accessibilityLabel="Session name"
        maxLength={64}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <InfoDisclosure label="How session timing works" anchor={<Text style={type.label}>Session duration</Text>}>
          <Text style={type.bodySoft}>Only playback counts. At your limit, Frame pauses and offers to finish the current video. Profile limits still apply.</Text>
          {budgetMinutes ? <Text style={type.bodySoft}>{sessionBudgetSummary(runtime, budgetMinutes)}</Text> : null}
        </InfoDisclosure>
        <View accessibilityRole="radiogroup" accessibilityLabel="Session duration" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {SESSION_TARGET_MINUTES.map((minutes) => <Pressable key={minutes ?? "none"} disabled={isSaving} accessibilityRole="radio" aria-checked={budgetMinutes === minutes} accessibilityState={{ checked: budgetMinutes === minutes }} onPress={() => { setBudgetMinutes(minutes); setCustomMinutes(String(minutes)); }} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.control, backgroundColor: budgetMinutes === minutes ? palette.activeSoft : "transparent" }}><Text style={[type.label, { color: budgetMinutes === minutes ? palette.active : palette.inkMuted }]}>{minutes} min</Text></Pressable>)}
        </View>
        <Text style={type.bodySoft}>Custom minutes · 1–1440</Text>
        <TextField accessibilityLabel="Custom session duration in minutes" placeholder="Custom minutes (1–1440)" keyboardType="number-pad" value={customMinutes} onChangeText={(value) => { setCustomMinutes(value); setBudgetMinutes(normalizeSessionTarget(Number(value))); }} maxLength={4} />
        {budgetMinutes === null ? <Text style={[type.bodySoft, { color: palette.danger }]}>Choose a whole number of minutes from 1 to 1440.</Text> : null}

      </View>

    </View>
  );

  const renderOrderedVideo = (videoId: string, index: number) => {
    const video = mediaById.get(videoId);
    return <View style={styles.trayMiddle}><PositionedRow transitionKey={selectionKey} key={videoId}><MotionView enter distance={16} duration={motion.reorder} style={styles.trayRow}>
              <Text style={styles.trayNumber}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={styles.trayMedia}><MediaImage source={video?.thumbnailUrl ? { uri: video.thumbnailUrl } : null} style={styles.thumbnail} contentFit="cover" cachePolicy="none" /><View style={styles.flex}><Text style={styles.trayTitle}>{video?.title ?? "Video details unavailable"}</Text><Text style={styles.duration}>{!isLongFormVideo(video) ? "Unavailable · remove or verify a 4+ minute video" : video?.durationSeconds ? formatDuration(video.durationSeconds) : "Duration unavailable"}</Text></View></View>
              <View style={styles.trayControls}>
              <Pressable onPress={() => move(videoId, -1)} disabled={index === 0 || isSaving} accessibilityState={{ disabled: index === 0 || isSaving }} style={[styles.trayControl, (index === 0 || isSaving) && styles.rowDisabled]} accessibilityRole="button" accessibilityLabel={`Move ${video?.title ?? "video"} earlier`}><ChevronUp size={18} color={palette.inkSoft} /></Pressable>
              <Pressable onPress={() => move(videoId, 1)} disabled={index === selected.length - 1 || isSaving} accessibilityState={{ disabled: index === selected.length - 1 || isSaving }} style={[styles.trayControl, (index === selected.length - 1 || isSaving) && styles.rowDisabled]} accessibilityRole="button" accessibilityLabel={`Move ${video?.title ?? "video"} later`}><ChevronDown size={18} color={palette.inkSoft} /></Pressable>
              <Pressable onPress={() => toggle(videoId)} disabled={isSaving} style={styles.trayControl} accessibilityRole="button" accessibilityLabel={`Remove ${video?.title ?? "video"} from draft`}><X size={18} color={palette.danger} /></Pressable>
              </View>
            </MotionView></PositionedRow></View>;
  };
  const sections = [
    ...(selected.length ? [{ key: "ordered", data: selected }] : []),
    { key: "candidates", data: filteredPool.map(video => video.id) },
  ];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={headerHeight}>
      <SectionList<string, { key: string; data: string[] }>
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        sections={sections}
        stickySectionHeadersEnabled={false}
        keyExtractor={(videoId) => videoId}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => section.key === "ordered" ? <View style={styles.trayTop}>
          <ProgrammeArtwork videos={selected.map(id => mediaById.get(id))} enter />
          <Text style={styles.trayLabel}>Video order · {selected.length} selected</Text>
        </View> : <View>
          <Text style={styles.pickLabel}>Choose videos</Text>
          <TextField containerStyle={styles.searchField} leading={<Search size={18} color={palette.inkMuted} />} value={search} onChangeText={setSearch} placeholder="Search titles or sources" placeholderTextColor={palette.inkMuted} accessibilityLabel="Search session videos" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
        </View>}
        renderSectionFooter={({ section }) => section.key === "ordered" ? <View style={styles.trayBottom}>
          <MotionView changeKey={durationSummary} distance={4}><Text style={styles.trayFoot}>{durationSummary} of video in your plan</Text></MotionView>
        </View> : !filteredPool.length ? <EmptyState title={search.trim() ? "No matching videos" : "No videos to choose yet"} body={search.trim() ? "Try another title or source." : "Save a few videos from Today, then build a session from them."} action={search.trim() ? undefined : { label: "Open Today", onPress: openToday }} /> : null}
        renderItem={({ item: videoId, index, section }) => {
          if (section.key === "ordered") return renderOrderedVideo(videoId, index);
          const item = mediaById.get(videoId)!;
          const order = positions.get(item.id) ?? 0;
          const isSelected = order > 0;
          const isDisabled = selected.length >= PRODUCT_LIMITS.sessionDraftMaxItems && !isSelected;
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              disabled={isDisabled || isSaving}
              style={({ pressed }) => [styles.row, isDisabled && styles.rowDisabled, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              aria-checked={isSelected}
              accessibilityState={{ checked: isSelected, disabled: isDisabled || isSaving }}
              accessibilityLabel={`${item.title}${isSelected ? `, selection ${order}` : ""}`}
              testID={`session-pick-${item.id}`}
            >
              <View style={[styles.indexBox, isSelected && styles.indexBoxOn]}>
                {isSelected ? <Text style={styles.indexText}>{order}</Text> : null}
              </View>
              <SelectionArtwork selected={isSelected}><MediaImage source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : null} style={styles.thumbnail} contentFit="cover" cachePolicy="none" /></SelectionArtwork>
              <View style={styles.videoCopy}>
                <Text style={type.caption} numberOfLines={1}>{item.channelTitle || "Source"}</Text>
                <Text style={[styles.rowTitle, isSelected && styles.selectedTitle]}>{item.title}</Text>
                <Text style={styles.duration}>{item.durationSeconds ? formatDuration(item.durationSeconds) : "Duration unavailable"}</Text>
                {budgetMinutes && !isSelected ? <Text style={type.bodySoft}>{sessionAdditionSummary(runtime, item.durationSeconds, budgetMinutes)}</Text> : null}
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={[styles.content, boundedCollection, { paddingLeft: spacing.page + insets.left, paddingRight: spacing.page + insets.right, paddingBottom: spacing.lg }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
      />

      {hydratedProfile === activeProfileId && selected.length > 0 ? (
        <View style={[styles.footer, boundedCollection, { paddingLeft: spacing.lg + insets.left, paddingRight: spacing.lg + insets.right, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.summary}>
            <Text style={type.label}>{budgetMinutes ? `Session duration: ${budgetMinutes} min` : "Choose a session duration"}</Text>
            <Text style={type.bodySoft}>Queue: {selected.length} video{selected.length === 1 ? "" : "s"} · {durationSummary}</Text>
          </View>
          <Pressable onPress={() => { void save(); }} disabled={isSaving} style={({ pressed }) => [styles.saveBtn, (pressed || isSaving) && styles.pressed]} accessibilityRole="button" accessibilityLabel="Save session" accessibilityState={{ busy: isSaving, disabled: isSaving }} testID="save-session">
            <Save size={16} color={palette.accent} strokeWidth={1.8} />
            <Text style={styles.saveText}>Save session</Text>
          </Pressable>
          <PlaybackAction onPress={() => { void saveAndBegin(); }} disabled={isSaving} style={[styles.beginBtn, isSaving && styles.pressed]} accessibilityRole="button" testID="begin-session">
            <Text style={styles.beginText}>{isSaving ? "Saving…" : "Save & begin"}</Text>
          </PlaybackAction>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    thumbnail: { width: 72, aspectRatio: 16 / 9, borderRadius: radii.media }, videoCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 120 }, trayMedia: { flexGrow: 1, flexShrink: 1, flexBasis: 240, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    searchField: { marginTop: spacing.sm },
    screen: { flex: 1, backgroundColor: "transparent" },
    content: { flexGrow: 1, paddingHorizontal: spacing.lg },
    header: { paddingBottom: spacing.xl },
    eyebrow: { ...type.caption, color: palette.accent },
    title: { ...type.title, marginTop: spacing.xs },
    subtitle: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 340 },
    nameInput: { marginTop: spacing.sm },
    flex: { flex: 1 },
    row: { minHeight: 76, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.borderSoft },
    indexBox: { width: 34, height: 34, borderRadius: radii.control, backgroundColor: palette.surface, justifyContent: "center", alignItems: "center" },
    indexBoxOn: { backgroundColor: palette.accentDeep },
    indexText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    rowDisabled: { opacity: 0.45 },
    rowTitle: { ...type.heading, fontSize: 16, lineHeight: 20, marginTop: 2 },
    selectedTitle: { color: palette.accent },
    duration: { ...type.caption, color: palette.inkMuted },
    footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: palette.surfaceHigh, borderTopWidth: 1, borderTopColor: palette.border },
    summary: { width: "100%" },
    saveBtn: { flexGrow: 1, flexBasis: 140, minHeight: 48, flexDirection: "row", gap: spacing.sm, padding: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.activeSoft },
    saveText: { ...type.label, color: palette.accent, flexShrink: 1 },
    beginBtn: { flexGrow: 1, flexBasis: 140, paddingVertical: spacing.sm, minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.accentDeep, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.control },
    beginText: { flexShrink: 1, color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    trayTop: { marginTop: spacing.lg, padding: spacing.md, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.borderSoft },
    trayMiddle: { paddingHorizontal: spacing.md, backgroundColor: palette.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: palette.borderSoft },
    trayBottom: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomLeftRadius: radii.card, borderBottomRightRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderTopWidth: 0, borderColor: palette.borderSoft },
    trayLabel: { ...type.caption, color: palette.accent },
    trayRow: { minHeight: 48, flexDirection: "row", flexWrap: "wrap", paddingVertical: spacing.sm, alignItems: "center", gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: palette.borderSoft },
    trayNumber: { ...type.caption, color: palette.accent, width: 24 },
    trayTitle: { ...type.label },
    trayControls: { flexDirection: "row", flexShrink: 0, marginLeft: "auto" },
    trayControl: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    trayFoot: { ...type.caption, color: palette.inkMuted, marginTop: spacing.md },
    pickLabel: { ...type.label, marginTop: spacing.xl },
    pressed: { opacity: 0.7 },
  });
}

