import Image from "@/components/MediaImage";
import { router } from "expo-router";
import { BookmarkPlus, Link2, Play, UserPlus, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Sheet from "@/components/Sheet";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { resolutionVideoToVideo } from "@/services/youtube";
import type { SourceResolution } from "@/types";

type Props = { visible: boolean; onClose: () => void };
type Feedback = { ok: boolean; message: string };

/** Resolves a shared source first, then requires an explicit profile-local follow. */
export default function AddChannelModal({ visible, onClose }: Props) {
  const { resolveSourceInput, confirmSource, requirePurchase, saveVideo, activeProfileId } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const requestId = useRef(0);
  const locked = useRef(false);
  const profileRef = useRef(activeProfileId);
  profileRef.current = activeProfileId;
  useEffect(() => () => { requestId.current += 1; }, []);
  const [value, setValue] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [resolution, setResolution] = useState<SourceResolution | null>(null);
  const [resolutionProfileId, setResolutionProfileId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const close = (): void => {
    if (locked.current) return;
    requestId.current += 1;
    setValue("");
    setBusy(false);
    setResolution(null);
    setResolutionProfileId(null);
    setFeedback(null);
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!value.trim() || locked.current || !requirePurchase("creators")) return;
    const request = ++requestId.current;
    const expectedProfile = activeProfileId;
    locked.current = true; setBusy(true); setResolution(null); setFeedback(null);
    try {
      const result = await resolveSourceInput(value.trim());
      if (requestId.current !== request || profileRef.current !== expectedProfile) return;
      if (result.status === "success") {
        setResolutionProfileId(expectedProfile); setResolution(result.data);
        setFeedback({ ok: true, message: "Source found. Check the details, then choose Follow source." });
      } else setFeedback({ ok: false, message: result.message ?? "That source could not be verified." });
    } catch { if (requestId.current === request) setFeedback({ ok: false, message: "Couldn’t check this source. Check your connection and try again." }); }
    finally { if (requestId.current === request) { locked.current = false; setBusy(false); } }
  };

  const follow = async (): Promise<void> => {
    if (!resolution || resolutionProfileId !== activeProfileId || locked.current) return;
    locked.current = true; setBusy(true);
    try {
      const result = await confirmSource(resolution); setFeedback(result);
      if (result.ok) { setResolution(null); setValue(""); }
    } catch { setFeedback({ ok: false, message: "Couldn’t follow this source. Try again." }); }
    finally { locked.current = false; setBusy(false); }
  };

  const watch = (): void => {
    if (!resolution || resolutionProfileId !== activeProfileId || locked.current) return;
    const video = resolutionVideoToVideo(resolution);
    if (!video) return;
    close();
    router.push({
      pathname: FRAME_PLAYBACK_ROUTE,
      params: {
        id: video.id,
        title: video.title,
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        durationSeconds: String(video.durationSeconds),
        fetchedAt: String(video.fetchedAt ?? 0),
        cachedMetadata: "1",
      },
    });
  };

  const save = async (): Promise<void> => {
    if (!resolution || resolutionProfileId !== activeProfileId || locked.current) return;
    const video = resolutionVideoToVideo(resolution);
    if (!video) return;
    locked.current = true; setBusy(true);
    try {
      await saveVideo(video);
      setFeedback({ ok: true, message: `Saved ${video.title}.` });
    } catch {
      setFeedback({ ok: false, message: "That video couldn’t be saved. Try again." });
    } finally {
      locked.current = false; setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>Add a source</Text>
            <Pressable disabled={busy} onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={palette.inkMuted} />
            </Pressable>
          </View>
          <Text style={styles.heading}>Find a source</Text>
          <Text style={styles.body}>Use a channel or video link, an @handle, or a channel ID. Check the result before following.</Text>
          <Text style={[type.label, { marginTop: spacing.md }]}>Source or video link</Text>
          <View style={styles.inputRow}>
            <Link2 size={17} color={palette.inkMuted} strokeWidth={1.6} />
            <TextInput
              value={value}
              onChangeText={(text) => { setValue(text); setResolution(null); setResolutionProfileId(null); setFeedback(null); }}
              placeholder="@creator"
              placeholderTextColor={palette.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={styles.input}
              onSubmitEditing={() => { void submit(); }}
              returnKeyType="done"
              editable={!busy}
              accessibilityLabel="Source or video link"
              testID="add-channel-input"
            />
          </View>
          {feedback ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text> : null}

          {resolution ? (
            <View style={styles.preview} testID="resolved-source-preview">
              <Image source={resolution.source.thumbnailUrl ? { uri: resolution.source.thumbnailUrl } : null} style={styles.avatar} contentFit="cover" cachePolicy="none" />
              <View style={styles.previewCopy}>
                <Text style={styles.previewTitle} numberOfLines={2}>{resolution.source.displayName}</Text>
                <Text style={styles.previewMeta} numberOfLines={1}>{resolution.source.handle ?? "Channel"}</Text>
                {resolution.video ? <Text style={styles.videoTitle} numberOfLines={2}>Video · {resolution.video.title}</Text> : null}
              </View>
            </View>
          ) : null}

          {resolution?.video ? (
            <View style={styles.actionRow}>
              <Pressable disabled={busy} onPress={watch} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} accessibilityRole="button" testID="watch-resolved-video">
                <Play size={16} color={palette.accent} fill={palette.accent} />
                <Text style={styles.secondaryText}>Watch</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => { void save(); }} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} accessibilityRole="button" testID="save-resolved-video">
                <BookmarkPlus size={17} color={palette.accent} />
                <Text style={styles.secondaryText}>Save</Text>
              </Pressable>
            </View>
          ) : null}

          {resolution ? (
            <Pressable onPress={() => { void follow(); }} style={({ pressed }) => [styles.button, pressed && styles.pressed]} disabled={busy} accessibilityRole="button" testID="confirm-source-follow">
              {busy ? <ActivityIndicator color={palette.onDark} size="small" /> : <View style={styles.buttonContent}><UserPlus size={17} color={palette.onDark} /><Text style={styles.buttonText}>Follow source</Text></View>}
            </Pressable>
          ) : (
            <Pressable onPress={() => { void submit(); }} style={({ pressed }) => [styles.button, pressed && styles.pressed]} disabled={busy || !value.trim()} accessibilityRole="button" testID="resolve-source-submit">
              {busy ? <ActivityIndicator color={palette.onDark} size="small" /> : <Text style={styles.buttonText}>Find source</Text>}
            </Pressable>
          )}
    </Sheet>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: palette.overlay, justifyContent: "flex-end", padding: spacing.md },
    card: { ...softShadow, backgroundColor: palette.surfaceHigh, padding: spacing.lg, paddingTop: spacing.md, borderRadius: radii.large, borderWidth: 1, borderColor: palette.border },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: palette.surfaceDeep, alignSelf: "center", marginBottom: spacing.md },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    eyebrow: { ...type.caption, color: palette.accent },
    closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -12 },
    heading: { ...type.heading, fontSize: 24, marginTop: spacing.xs },
    body: { ...type.bodySoft, marginTop: spacing.sm, maxWidth: 350 },
    inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.surface, paddingHorizontal: spacing.md, minHeight: 52, marginTop: spacing.lg, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft },
    input: { flex: 1, ...type.body, paddingVertical: 0, fontSize: 15 },
    feedback: { ...type.label, marginTop: spacing.md },
    preview: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginTop: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: palette.surfaceDeep },
    avatarFallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: palette.surfaceDeep },
    previewCopy: { flex: 1 },
    previewTitle: { ...type.label, fontSize: 16 },
    previewMeta: { ...type.caption, color: palette.inkMuted, marginTop: 2 },
    videoTitle: { ...type.bodySoft, marginTop: spacing.xs },
    actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    secondaryButton: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border },
    secondaryText: { ...type.label, color: palette.accent },
    button: { minHeight: 52, marginTop: spacing.md, backgroundColor: palette.accentDeep, borderRadius: radii.control, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.active },
    buttonContent: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    buttonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
    pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  });
}

