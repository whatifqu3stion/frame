import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { Check, Play, Save } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { formatDuration } from "@/services/youtube";
import type { Video } from "@/types";

export default function SessionBuilder() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { savedVideos, watchLater, sessions, createSession, renameSession, updateSessionVideos, requirePurchase } = useApp();
  const existingSession = useMemo(() => sessions.find((session) => session.id === id), [id, sessions]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState<string>("");
  const [didHydrate, setDidHydrate] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (didHydrate || !id || !existingSession) return;
    setSelected(existingSession.orderedVideoIds.slice(0, 3));
    setName(existingSession.name);
    setDidHydrate(true);
  }, [didHydrate, existingSession, id]);

  const pool = useMemo<Video[]>(() => {
    const videos = new Map<string, Video>();
    [...watchLater, ...savedVideos].forEach((video) => {
      if (!videos.has(video.id)) videos.set(video.id, video);
    });
    return Array.from(videos.values());
  }, [savedVideos, watchLater]);

  const totalSeconds = useMemo<number>(
    () => selected.reduce((sum, videoId) => sum + (pool.find((video) => video.id === videoId)?.durationSeconds ?? 0), 0),
    [pool, selected],
  );

  const toggle = useCallback((videoId: string): void => {
    if (!requirePurchase()) return;
    void Haptics.selectionAsync().catch(() => {});
    setSelected((previous) => {
      if (previous.includes(videoId)) return previous.filter((candidate) => candidate !== videoId);
      if (previous.length >= 3) return previous;
      return [...previous, videoId];
    });
  }, [requirePurchase]);

  const persistSession = useCallback(async (): Promise<string | null> => {
    if (!requirePurchase()) return null;
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
      const created = await createSession(name, selected);
      return created.id;
    } finally {
      setIsSaving(false);
    }
  }, [createSession, existingSession, name, renameSession, requirePurchase, selected, updateSessionVideos]);

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
      pathname: "/watch/[id]",
      params: { id: selected[0], session: selected.join(","), i: "0", savedSessionId: sessionId },
    });
  }, [persistSession, selected]);

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{existingSession ? "Edit named session" : "New named session"}</Text>
      <Text style={styles.title} accessibilityRole="header">Choose a few.{"\n"}Watch. Stop.</Text>
      <Text style={styles.subtitle}>Pick one to three videos. Frame keeps the order, then stops when the final video ends.</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Evening at home"
        placeholderTextColor={palette.inkMuted}
        style={styles.nameInput}
        returnKeyType="done"
        accessibilityLabel="Session name"
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList<Video>
        data={pool}
        keyExtractor={(video) => video.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="Nothing to sit with yet" body="Save videos or add them to Watch Later, then build a named session from them." />}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          const order = selected.indexOf(item.id) + 1;
          const isDisabled = selected.length >= 3 && !isSelected;
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

      {selected.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.summary}>
            <Text style={type.caption}>{selected.length} video{selected.length === 1 ? "" : "s"}</Text>
            <Text style={styles.total}>{formatDuration(totalSeconds)} total</Text>
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
    nameInput: { ...type.heading, minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: palette.surface, borderRadius: radii.control, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    flex: { flex: 1 },
    row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSoft },
    indexBox: { width: 34, height: 34, borderRadius: radii.control, backgroundColor: palette.surface, justifyContent: "center", alignItems: "center" },
    indexBoxOn: { backgroundColor: palette.accentDeep },
    indexText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    rowDisabled: { opacity: 0.45 },
    rowTitle: { ...type.heading, fontSize: 16, lineHeight: 20, marginTop: 2 },
    selectedTitle: { color: palette.accent },
    duration: { ...type.caption, color: palette.inkMuted },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: palette.surfaceHigh, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
    summary: { flex: 1 },
    total: { ...type.heading, marginTop: 2 },
    saveBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.activeSoft },
    beginBtn: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.accentDeep, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.control },
    beginText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
