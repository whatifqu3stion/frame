import TextField from "@/components/TextField";
import { useHeaderHeight } from "@react-navigation/elements";
import { usePreventRemove } from "@react-navigation/native";
import { useDiscardChanges } from "@/hooks/useDiscardChanges";
import PositionedRow from "@/components/motion/PositionedRow";
import { useFeedback } from "@/hooks/useFeedback";
import Pressable from "@/components/motion/ChoicePressable";
import { useQuery } from "@tanstack/react-query";
import { todayRepository } from "@/repositories/todayRepository";
import { expireVideo } from "@/domain/metadataRetention";
import { router, useLocalSearchParams, useNavigation, type Href } from "expo-router";
import { Search, ChevronDown, ChevronUp, Play, Save, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { formatDuration } from "@/services/youtube";
import { sessionRuntime } from "@/domain/sessionFlow";
import type { Video } from "@/types";

export default function SessionBuilder() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeProfileId, profileSwitching, prefs, savedVideos, sessions, sessionDraft, sessionDraftLoading, libraryError, refreshLibrary, saveSessionDraft, clearSessionDraft, createSession, renameSession, updateSessionVideos, requirePurchase } = useApp();
  const existingSession = useMemo(() => sessions.find((session) => session.id === id), [id, sessions]);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const persistLock = useRef(false);
  const savedDraft = useRef(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState<string>("");
  const [hydratedProfile, setHydratedProfile] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [draftState, setDraftState] = useState<"saving" | "saved" | "error" | null>(null);
  const [draftAttempt, setDraftAttempt] = useState(0);
  const draftRevision = JSON.stringify([name, selected]);
  const [savedRevision, setSavedRevision] = useState<string | null>(null);

  const [destination, setDestination] = useState<Href | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const canLeaveScope = hydratedProfile === activeProfileId && !profileSwitching && prefs.hasCompletedOnboarding;
  const scope = useRef({ profile: activeProfileId, active: canLeaveScope });
  scope.current = { profile: activeProfileId, active: canLeaveScope };
  const dirty = Boolean(existingSession ? (name.trim() !== existingSession.name || selected.join(",") !== existingSession.orderedVideoIds.join(",")) : !id && (name || selected.length) && savedRevision !== draftRevision);
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
    setHydratedProfile(activeProfileId);
  }, [activeProfileId, existingSession, hydratedProfile, id, sessionDraft, sessionDraftLoading, libraryError]);

  const hasDraft = Boolean(sessionDraft);
  useEffect(() => {
    if (id || hydratedProfile !== activeProfileId || isSaving || destination || savedDraft.current) return;
    let current = true;
    setDraftState("saving");
    const write = !name && !selected.length
      ? hasDraft ? clearSessionDraft() : Promise.resolve()
      : saveSessionDraft({ name, orderedVideoIds: selected });
    void write.then(() => { if (current) { setSavedRevision(draftRevision); setDraftState("saved"); } })
      .catch(() => { if (current) setDraftState("error"); });
    return () => { current = false; };
  }, [activeProfileId, clearSessionDraft, hasDraft, hydratedProfile, id, name, saveSessionDraft, selected, draftAttempt, draftRevision, isSaving, destination]);

  const selectedMedia = useQuery({
    queryKey: ["session-editor-media", activeProfileId, selected.join(",")], networkMode: "always",
    queryFn: async () => Promise.all(selected.map((videoId) => todayRepository.getVideo(activeProfileId, videoId))),
    enabled: hydratedProfile === activeProfileId && selected.length > 0,
  });
  const pool = useMemo<Video[]>(() => [...new Map([
    ...(selectedMedia.data ?? []).filter((video): video is Video => Boolean(video)),
    ...savedVideos,
  ].map((video) => [video.id, expireVideo(video, Date.now())])).values()], [savedVideos, selectedMedia.data]);

  const filteredPool = useMemo(() => pool.filter((video) => `${video.title} ${video.channelTitle}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [pool, search]);

  const runtime = useMemo(() => sessionRuntime(selected, pool), [pool, selected]);
  const durationSummary = `${runtime.seconds > 0 ? `${runtime.unknown ? "At least " : ""}${formatDuration(runtime.seconds)}` : "Duration unavailable"}${runtime.seconds > 0 && runtime.unknown ? " · some durations unavailable" : ""}`;
  const finishTime = runtime.unknown === 0 && runtime.seconds > 0 ? new Date(Date.now() + runtime.seconds * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;

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
    if (!name.trim()) {
      Alert.alert("Name this session", "Choose a name you’ll recognize later.");
      return null;
    }
    if (selected.length === 0) {
      Alert.alert("Choose a video", "A session needs at least one video.");
      return null;
    }

    persistLock.current = true;
    setIsSaving(true);
    try {
      if (existingSession) {
        await renameSession(existingSession.id, name);
        await updateSessionVideos(existingSession.id, selected);
        return existingSession.id;
      }
      await saveSessionDraft({ name, orderedVideoIds: selected });
      const created = await createSession(name, selected);
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
  }, [clearSessionDraft, createSession, existingSession, name, renameSession, requirePurchase, saveSessionDraft, selected, updateSessionVideos]);

  const save = useCallback(async (): Promise<void> => {
    const done = feedback.capture();
    const sessionId = await persistSession();
    if (!sessionId || !alive.current || !scope.current.active || scope.current.profile !== activeProfileId) return;
    done(existingSession ? "commit" : "milestone", !existingSession || existingSession.name !== name.trim() || existingSession.orderedVideoIds.join(",") !== selected.join(","));
    setDestination({ pathname: "/session/[id]", params: { id: sessionId } });
  }, [activeProfileId, existingSession, feedback, name, persistSession, selected]);

  const saveAndBegin = useCallback(async (): Promise<void> => {
    const done = feedback.capture();
    const sessionId = await persistSession();
    if (!sessionId || !alive.current || !scope.current.active || scope.current.profile !== activeProfileId) return;
    done("commit");
    setDestination({
      pathname: FRAME_PLAYBACK_ROUTE,
      params: { id: selected[0], savedSessionId: sessionId, sessionProfileId: activeProfileId },
    });
  }, [activeProfileId, feedback, persistSession, selected]);

  if (libraryError) return <View style={styles.screen}><EmptyState title="Your library couldn’t load" body="Try again before editing this session." action={{ label: "Try again", onPress: () => { void refreshLibrary().catch(() => Alert.alert("Library unavailable", "Close and reopen Frame to try again.")); } }} /></View>;

  if (hydratedProfile !== activeProfileId || (id && !existingSession)) {
    return <View style={styles.screen}><EmptyState title={id && !existingSession ? "Session unavailable" : "Opening your draft"} body={id && !existingSession ? "It may have been removed from this profile." : "Loading your saved draft."} /></View>;
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">{existingSession ? "Edit session" : "New session"}</Text>
      <Text style={styles.subtitle}>Pick up to {PRODUCT_LIMITS.sessionDraftMaxItems} videos and choose their order. {existingSession ? "Save your changes before leaving." : "Your draft saves automatically on this device."}</Text>
      {!id && !isSaving && draftState ? <View accessibilityLiveRegion="polite">
        <Text style={[type.bodySoft, { marginTop: spacing.sm, color: draftState === "error" ? palette.danger : palette.inkMuted }]}>{draftState !== "error" && savedRevision !== draftRevision ? "Saving draft…" : draftState === "error" ? "Draft couldn’t save. Try again before leaving." : "Draft saved on this device"}</Text>
        {draftState === "error" ? <Pressable accessibilityRole="button" onPress={() => setDraftAttempt((value) => value + 1)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={type.label}>Retry saving draft</Text></Pressable> : null}
      </View> : null}
      <Text style={[type.label, { marginTop: spacing.lg }]}>Session name</Text>
      <TextField
        editable={!isSaving}
        value={name}
        onChangeText={setName}
        placeholder="Evening at home"
        placeholderTextColor={palette.inkMuted}
        containerStyle={styles.nameInput}
        returnKeyType="done"
        accessibilityLabel="Session name"
        maxLength={64}
      />
      {selected.length ? (
        <View style={styles.tray}>
          <Text style={styles.trayLabel}>Video order · {selected.length}/{PRODUCT_LIMITS.sessionDraftMaxItems}</Text>
          {selected.map((videoId, index) => {
            const video = pool.find((candidate) => candidate.id === videoId);
            return <PositionedRow transitionKey={selected.join(",")} key={videoId} style={styles.trayRow}>
              <Text style={styles.trayNumber}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.trayTitle} numberOfLines={3}>{video?.title ?? "Video details unavailable"}</Text>
              <Pressable onPress={() => move(videoId, -1)} disabled={index === 0 || isSaving} accessibilityState={{ disabled: index === 0 || isSaving }} style={[styles.trayControl, (index === 0 || isSaving) && styles.rowDisabled]} accessibilityRole="button" accessibilityLabel={`Move ${video?.title ?? "video"} earlier`}><ChevronUp size={18} color={palette.inkSoft} /></Pressable>
              <Pressable onPress={() => move(videoId, 1)} disabled={index === selected.length - 1 || isSaving} accessibilityState={{ disabled: index === selected.length - 1 || isSaving }} style={[styles.trayControl, (index === selected.length - 1 || isSaving) && styles.rowDisabled]} accessibilityRole="button" accessibilityLabel={`Move ${video?.title ?? "video"} later`}><ChevronDown size={18} color={palette.inkSoft} /></Pressable>
              <Pressable onPress={() => toggle(videoId)} disabled={isSaving} style={styles.trayControl} accessibilityRole="button" accessibilityLabel={`Remove ${video?.title ?? "video"} from draft`}><X size={18} color={palette.danger} /></Pressable>
            </PositionedRow>;
          })}
          <Text style={styles.trayFoot}>{durationSummary}{finishTime ? ` · Ends around ${finishTime} without breaks` : " · Finish time unavailable"}</Text>
        </View>
      ) : null}
      <Text style={styles.pickLabel}>Choose videos</Text>
      <TextField containerStyle={styles.searchField} leading={<Search size={18} color={palette.inkMuted} />} value={search} onChangeText={setSearch} placeholder="Search titles or sources" placeholderTextColor={palette.inkMuted} accessibilityLabel="Search session videos" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={headerHeight}>
      <FlatList<Video>
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={hydratedProfile === activeProfileId ? filteredPool : []}
        keyExtractor={(video) => video.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title={search.trim() ? "No matching videos" : "No videos to choose yet"} body={search.trim() ? "Try another title or source." : "Save a few videos, then build a session from them."} />}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          const order = selected.indexOf(item.id) + 1;
          const isDisabled = selected.length >= PRODUCT_LIMITS.sessionDraftMaxItems && !isSelected;
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              disabled={isDisabled || isSaving}
              style={({ pressed }) => [styles.row, isDisabled && styles.rowDisabled, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: isDisabled || isSaving }}
              accessibilityLabel={`${item.title}${isSelected ? `, selection ${order}` : ""}`}
              testID={`session-pick-${item.id}`}
            >
              <View style={[styles.indexBox, isSelected && styles.indexBoxOn]}>
                {isSelected ? <Text style={styles.indexText}>{order}</Text> : null}
              </View>
              <View style={styles.flex}>
                <Text style={type.caption} numberOfLines={1}>{item.channelTitle || "Source"}</Text>
                <Text style={[styles.rowTitle, isSelected && styles.selectedTitle]} numberOfLines={2}>{item.title}</Text>
              </View>
              <Text style={styles.duration}>{formatDuration(item.durationSeconds)}</Text>
            </Pressable>
          );
        }}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.lg }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
      />

      {hydratedProfile === activeProfileId && selected.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.summary}>
            <Text style={type.caption}>{selected.length} video{selected.length === 1 ? "" : "s"}</Text>
            <Text style={styles.total}>{durationSummary}</Text>
          </View>
          <Pressable onPress={() => { void save(); }} disabled={isSaving} style={({ pressed }) => [styles.saveBtn, (pressed || isSaving) && styles.pressed]} accessibilityRole="button" accessibilityLabel="Save session" accessibilityState={{ busy: isSaving, disabled: isSaving }} testID="save-session">
            <Save size={16} color={palette.accent} strokeWidth={1.8} />
            <Text style={styles.saveText}>Save session</Text>
          </Pressable>
          <Pressable onPress={() => { void saveAndBegin(); }} disabled={isSaving} style={({ pressed }) => [styles.beginBtn, (pressed || isSaving) && styles.pressed]} accessibilityRole="button" testID="begin-session">
            <Play size={16} color={palette.onDark} strokeWidth={1.8} fill={palette.onDark} />
            <Text style={styles.beginText}>{isSaving ? "Saving…" : "Save & begin"}</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    searchField: { marginTop: spacing.sm },
    screen: { flex: 1, backgroundColor: palette.wall },
    content: { flexGrow: 1, paddingHorizontal: spacing.lg },
    header: { paddingBottom: spacing.xl },
    eyebrow: { ...type.caption, color: palette.accent },
    title: { ...type.title, marginTop: spacing.xs },
    subtitle: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 340 },
    nameInput: { marginTop: spacing.sm },
    flex: { flex: 1 },
    row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.borderSoft },
    indexBox: { width: 34, height: 34, borderRadius: radii.control, backgroundColor: palette.surface, justifyContent: "center", alignItems: "center" },
    indexBoxOn: { backgroundColor: palette.accentDeep },
    indexText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    rowDisabled: { opacity: 0.45 },
    rowTitle: { ...type.heading, fontSize: 16, lineHeight: 20, marginTop: 2 },
    selectedTitle: { color: palette.accent },
    duration: { ...type.caption, color: palette.inkMuted },
    footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: palette.surfaceHigh, borderTopWidth: 1, borderTopColor: palette.border },
    summary: { width: "100%" },
    total: { ...type.heading, marginTop: 2 },
    saveBtn: { flexGrow: 1, flexBasis: 140, minHeight: 48, flexDirection: "row", gap: spacing.sm, padding: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.activeSoft },
    saveText: { ...type.label, color: palette.accent, flexShrink: 1 },
    beginBtn: { flexGrow: 1, flexBasis: 140, paddingVertical: spacing.sm, minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.accentDeep, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.control },
    beginText: { flexShrink: 1, color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    tray: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    trayLabel: { ...type.caption, color: palette.accent },
    trayRow: { minHeight: 48, flexDirection: "row", flexWrap: "wrap", paddingVertical: spacing.sm, alignItems: "center", gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: palette.borderSoft },
    trayNumber: { ...type.caption, color: palette.accent, width: 24 },
    trayTitle: { ...type.label, flexGrow: 1, flexBasis: "80%" },
    trayControl: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    trayFoot: { ...type.caption, color: palette.inkMuted, marginTop: spacing.md },
    pickLabel: { ...type.label, marginTop: spacing.xl },
    pressed: { opacity: 0.7 },
  });
}

