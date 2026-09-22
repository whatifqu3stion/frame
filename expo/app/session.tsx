import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronDown, ChevronUp, Play, Save, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeProfileId, savedVideos, sessions, sessionDraft, sessionDraftLoading, saveSessionDraft, clearSessionDraft, createSession, renameSession, updateSessionVideos, requirePurchase } = useApp();
  const existingSession = useMemo(() => sessions.find((session) => session.id === id), [id, sessions]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState<string>("");
  const [hydratedProfile, setHydratedProfile] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (hydratedProfile === activeProfileId || sessionDraftLoading) return;
    if (id && !existingSession) return;
    setSelected((id ? existingSession?.orderedVideoIds : sessionDraft?.orderedVideoIds)?.slice(0, PRODUCT_LIMITS.sessionDraftMaxItems) ?? []);
    setName((id ? existingSession?.name : sessionDraft?.name) ?? "");
    setHydratedProfile(activeProfileId);
  }, [activeProfileId, existingSession, hydratedProfile, id, sessionDraft, sessionDraftLoading]);

  const hasDraft = Boolean(sessionDraft);
  useEffect(() => {
    if (id || hydratedProfile !== activeProfileId) return;
    if (!name && !selected.length) {
      if (hasDraft) void clearSessionDraft().catch(() => Alert.alert("Couldn’t clear draft", "Try again in a moment."));
      return;
    }
    void saveSessionDraft({ name, orderedVideoIds: selected }).catch(() => Alert.alert("Draft not saved", "Try again before leaving this session."));
  }, [activeProfileId, clearSessionDraft, hasDraft, hydratedProfile, id, name, saveSessionDraft, selected]);

  const pool: Video[] = savedVideos;

  const runtime = useMemo(() => sessionRuntime(selected, pool), [pool, selected]);
  const durationSummary = `${runtime.seconds > 0 ? `${formatDuration(runtime.seconds)} known` : "No known runtime"}${runtime.unknown ? ` · ${runtime.unknown} unknown` : ""}`;
  const finishTime = runtime.unknown === 0 && runtime.seconds > 0 ? new Date(Date.now() + runtime.seconds * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;

  const move = useCallback((index: number, direction: -1 | 1): void => {
    setSelected((previous) => {
      const next = [...previous];
      if (index + direction < 0 || index + direction >= next.length) return previous;
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const toggle = useCallback((videoId: string): void => {
    if (!requirePurchase("sessions")) return;
    void Haptics.selectionAsync().catch(() => {});
    setSelected((previous) => {
      if (previous.includes(videoId)) return previous.filter((candidate) => candidate !== videoId);
      if (previous.length >= PRODUCT_LIMITS.sessionDraftMaxItems) return previous;
      return [...previous, videoId];
    });
  }, [requirePurchase]);

  const persistSession = useCallback(async (): Promise<string | null> => {
    if (!requirePurchase("sessions")) return null;
    if (!name.trim()) {
      Alert.alert("Name this session", "Give this small plan a name you’ll recognize later.");
      return null;
    }
    if (selected.length === 0) {
      Alert.alert("Choose a video", "A session needs at least one video.");
      return null;
    }

    setIsSaving(true);
    try {
      if (existingSession) {
        await renameSession(existingSession.id, name);
        await updateSessionVideos(existingSession.id, selected);
        return existingSession.id;
      }
      await saveSessionDraft({ name, orderedVideoIds: selected });
      const created = await createSession(name, selected);
      if (created) await clearSessionDraft();
      return created?.id ?? null;
    } catch {
      Alert.alert("Couldn’t save session", "Your draft is still here. Try again in a moment.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [clearSessionDraft, createSession, existingSession, name, renameSession, requirePurchase, saveSessionDraft, selected, updateSessionVideos]);

  const save = useCallback(async (): Promise<void> => {
    const sessionId = await persistSession();
    if (!sessionId) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace({ pathname: "/session/[id]", params: { id: sessionId } });
  }, [persistSession]);

  const saveAndBegin = useCallback(async (): Promise<void> => {
    const sessionId = await persistSession();
    if (!sessionId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.replace({
      pathname: FRAME_PLAYBACK_ROUTE,
      params: { id: selected[0], savedSessionId: sessionId, sessionProfileId: activeProfileId },
    });
  }, [activeProfileId, persistSession, selected]);

  if (hydratedProfile !== activeProfileId || (id && !existingSession)) {
    return <View style={styles.screen}><EmptyState title={id && !existingSession ? "Session unavailable" : "Opening your draft"} body={id && !existingSession ? "It may have been removed from this profile." : "Finding your place on this device."} /></View>;
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{existingSession ? "Edit named session" : "New named session"}</Text>
      <Text style={styles.title} accessibilityRole="header">Choose a few.{"\n"}Watch. Stop.</Text>
      <Text style={styles.subtitle}>Pick up to {PRODUCT_LIMITS.sessionDraftMaxItems} videos. Your draft stays on this device. Only you decide when to continue.</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Evening at home"
        placeholderTextColor={palette.inkMuted}
        style={styles.nameInput}
        returnKeyType="done"
        accessibilityLabel="Session name"
        maxLength={64}
      />
      {selected.length ? (
        <View style={styles.tray}>
          <Text style={styles.trayLabel}>YOUR SHORT PLAN · {selected.length}/{PRODUCT_LIMITS.sessionDraftMaxItems}</Text>
          {selected.map((videoId, index) => {
            const video = pool.find((candidate) => candidate.id === videoId);
            return <View key={videoId} style={styles.trayRow}>
              <Text style={styles.trayNumber}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.trayTitle} numberOfLines={1}>{video?.title ?? "Video details unavailable"}</Text>
              <Pressable onPress={() => move(index, -1)} disabled={index === 0 || isSaving} style={styles.trayControl} accessibilityRole="button" accessibilityLabel={`Move ${video?.title ?? "video"} earlier`}><ChevronUp size={18} color={palette.inkSoft} /></Pressable>
              <Pressable onPress={() => move(index, 1)} disabled={index === selected.length - 1 || isSaving} style={styles.trayControl} accessibilityRole="button" accessibilityLabel={`Move ${video?.title ?? "video"} later`}><ChevronDown size={18} color={palette.inkSoft} /></Pressable>
              <Pressable onPress={() => toggle(videoId)} disabled={isSaving} style={styles.trayControl} accessibilityRole="button" accessibilityLabel={`Remove ${video?.title ?? "video"} from draft`}><X size={18} color={palette.danger} /></Pressable>
            </View>;
          })}
          <Text style={styles.trayFoot}>{durationSummary}{finishTime ? ` · Finish around ${finishTime}` : " · Finish time unavailable"}</Text>
        </View>
      ) : null}
      <Text style={styles.pickLabel}>CHOOSE FROM SAVED</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList<Video>
        data={hydratedProfile === activeProfileId ? pool : []}
        keyExtractor={(video) => video.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="Nothing to sit with yet" body="Save a few videos, then build a named session from them." />}
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
                {isSelected ? <Text style={styles.indexText}>{order}</Text> : <Check size={14} color={palette.inkMuted} strokeWidth={1.6} />}
              </View>
              <View style={styles.flex}>
                <Text style={type.caption} numberOfLines={1}>{item.channelTitle || "YouTube"}</Text>
                <Text style={[styles.rowTitle, isSelected && styles.selectedTitle]} numberOfLines={2}>{item.title}</Text>
              </View>
              <Text style={styles.duration}>{formatDuration(item.durationSeconds)}</Text>
            </Pressable>
          );
        }}
        contentContainerStyle={[styles.content, { paddingBottom: selected.length > 0 ? insets.bottom + 148 : insets.bottom + spacing.xxl }]}
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
          <Pressable onPress={() => { void save(); }} disabled={isSaving} style={({ pressed }) => [styles.saveBtn, (pressed || isSaving) && styles.pressed]} accessibilityRole="button" testID="save-session">
            <Save size={16} color={palette.accent} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => { void saveAndBegin(); }} disabled={isSaving} style={({ pressed }) => [styles.beginBtn, (pressed || isSaving) && styles.pressed]} accessibilityRole="button" testID="begin-session">
            <Play size={16} color={palette.onDark} strokeWidth={1.8} fill={palette.onDark} />
            <Text style={styles.beginText}>{isSaving ? "Saving…" : "Save & begin"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    content: { flexGrow: 1, paddingHorizontal: spacing.lg },
    header: { paddingBottom: spacing.xl },
    eyebrow: { ...type.caption, color: palette.accent },
    title: { ...type.title, marginTop: spacing.xs },
    subtitle: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 340 },
    nameInput: { ...type.heading, minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: palette.surface, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft },
    flex: { flex: 1 },
    row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.borderSoft },
    indexBox: { width: 34, height: 34, borderRadius: radii.control, backgroundColor: palette.surface, justifyContent: "center", alignItems: "center" },
    indexBoxOn: { backgroundColor: palette.accentDeep },
    indexText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    rowDisabled: { opacity: 0.45 },
    rowTitle: { ...type.heading, fontSize: 16, lineHeight: 20, marginTop: 2 },
    selectedTitle: { color: palette.accent },
    duration: { ...type.caption, color: palette.inkMuted },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: palette.surfaceHigh, borderTopWidth: 1, borderTopColor: palette.border },
    summary: { flex: 1 },
    total: { ...type.heading, marginTop: 2 },
    saveBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.activeSoft },
    beginBtn: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.accentDeep, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.control },
    beginText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    tray: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    trayLabel: { ...type.caption, color: palette.accent },
    trayRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: palette.borderSoft },
    trayNumber: { ...type.caption, color: palette.accent, width: 24 },
    trayTitle: { ...type.label, flex: 1 },
    trayControl: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    trayFoot: { ...type.caption, color: palette.inkMuted, marginTop: spacing.md },
    pickLabel: { ...type.caption, color: palette.inkMuted, marginTop: spacing.xl },
    pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
