import { Link2, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

type Props = { visible: boolean; onClose: () => void };

/** A calm sheet for adding a creator by pasting a YouTube channel or video link. */
export default function AddChannelModal({ visible, onClose }: Props) {
  const { addChannelByLink } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [value, setValue] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const close = (): void => { setValue(""); setBusy(false); setFeedback(null); onClose(); };
  const submit = async (): Promise<void> => {
    if (!value.trim() || busy) return;
    setBusy(true); setFeedback(null);
    const result = await addChannelByLink(value.trim());
    setBusy(false); setFeedback(result);
    if (result.ok) { setValue(""); setTimeout(close, 900); }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={close}>
      <Pressable onPress={close} style={styles.backdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.card}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>Add a channel</Text>
            <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={palette.inkMuted} />
            </Pressable>
          </View>
          <Text style={styles.heading}>Paste a link.</Text>
          <Text style={styles.body}>A channel link or a single video link. We’ll add the creator so their videos show up.</Text>
          <View style={styles.inputRow}>
            <Link2 size={17} color={palette.inkMuted} strokeWidth={1.6} />
            <TextInput value={value} onChangeText={(text) => { setValue(text); setFeedback(null); }} placeholder="youtube.com/@channel" placeholderTextColor={palette.inkMuted} autoCapitalize="none" autoCorrect={false} autoFocus style={styles.input} onSubmitEditing={() => { void submit(); }} returnKeyType="done" testID="add-channel-input" />
          </View>
          {feedback ? <Text style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text> : null}
          <Pressable onPress={() => { void submit(); }} style={({ pressed }) => [styles.button, pressed && styles.pressed]} disabled={busy} accessibilityRole="button" testID="add-channel-submit">
            {busy ? <ActivityIndicator color={palette.onDark} size="small" /> : <Text style={styles.buttonText}>Add channel</Text>}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: palette.overlay, justifyContent: "flex-end", padding: spacing.md },
    card: { ...softShadow, backgroundColor: palette.surfaceHigh, padding: spacing.lg, paddingTop: spacing.md, borderRadius: radii.large, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: palette.surfaceDeep, alignSelf: "center", marginBottom: spacing.md },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    eyebrow: { ...type.caption, color: palette.accent },
    closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -12 },
    heading: { ...type.heading, fontSize: 24, marginTop: spacing.xs },
    body: { ...type.bodySoft, marginTop: spacing.sm, maxWidth: 340 },
    inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: palette.surface, paddingHorizontal: spacing.md, minHeight: 52, marginTop: spacing.lg, borderRadius: radii.control, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    input: { flex: 1, ...type.body, paddingVertical: 0, fontSize: 15 },
    feedback: { ...type.label, marginTop: spacing.md },
    button: { minHeight: 52, marginTop: spacing.lg, backgroundColor: palette.accentDeep, borderRadius: radii.control, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: palette.active },
    buttonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
    pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  });
}
