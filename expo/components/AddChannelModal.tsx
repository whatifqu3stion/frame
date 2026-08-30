import { router } from "expo-router";
import { Link2, Play, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { extractYouTubeId } from "@/services/youtube";

type Props = { visible: boolean; onClose: () => void };

/** A calm sheet for adding a source or explicitly opening a pasted video. */
export default function AddChannelModal({ visible, onClose }: Props) {
  const { addChannelByLink, requirePurchase } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [value, setValue] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const videoId = extractYouTubeId(value);

  const close = (): void => { setValue(""); setBusy(false); setFeedback(null); onClose(); };
  const submit = async (): Promise<void> => {
    if (!value.trim() || busy || !requirePurchase("creators")) return;
    setBusy(true);
    setFeedback(null);
    const result = await addChannelByLink(value.trim());
    setBusy(false);
    setFeedback(result);
    if (result.ok) { setValue(""); setTimeout(close, 900); }
  };
  const watchVideo = (): void => {
    if (!videoId) return;
    close();
    router.push({ pathname: "/watch/[id]", params: { id: videoId } });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={close}>
      <Pressable onPress={close} style={styles.backdrop} accessibilityLabel="Close add source">
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.card} accessibilityRole="none">
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>Add a trusted source</Text>
            <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={palette.inkMuted} />
            </Pressable>
          </View>
          <Text style={styles.heading}>Paste a link.</Text>
          <Text style={styles.body}>Use a supported channel, handle, or video link. A video link can be watched directly or used to follow its source.</Text>
          <View style={styles.inputRow}>
            <Link2 size={17} color={palette.inkMuted} strokeWidth={1.6} />
            <TextInput
              value={value}
              onChangeText={(text) => { setValue(text); setFeedback(null); }}
              placeholder="youtube.com/@source"
              placeholderTextColor={palette.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={styles.input}
              onSubmitEditing={() => { void submit(); }}
              returnKeyType="done"
              accessibilityLabel="YouTube source or video link"
              testID="add-channel-input"
            />
          </View>
          {feedback ? <Text style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text> : null}
          {videoId ? (
            <Pressable onPress={watchVideo} style={({ pressed }) => [styles.watchButton, pressed && styles.pressed]} accessibilityRole="button" testID="watch-pasted-video">
              <Play size={16} color={palette.accent} fill={palette.accent} />
              <Text style={styles.watchButtonText}>Watch this video</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => { void submit(); }} style={({ pressed }) => [styles.button, pressed && styles.pressed]} disabled={busy || !value.trim()} accessibilityRole="button" testID="add-channel-submit">
            {busy ? <ActivityIndicator color={palette.onDark} size="small" /> : <Text style={styles.buttonText}>Add source</Text>}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
    body: { ...type.bodySoft, marginTop: spacing.sm, maxWidth: 340 },
    inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.surface, paddingHorizontal: spacing.md, minHeight: 52, marginTop: spacing.lg, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft },
    input: { flex: 1, ...type.body, paddingVertical: 0, fontSize: 15 },
    feedback: { ...type.label, marginTop: spacing.md },
    watchButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border },
    watchButtonText: { ...type.label, color: palette.accent },
    button: { minHeight: 52, marginTop: spacing.md, backgroundColor: palette.accentDeep, borderRadius: radii.control, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.active },
    buttonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
    pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  });
}
