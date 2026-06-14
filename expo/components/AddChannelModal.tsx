import { Link2, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** A calm sheet for adding a creator by pasting a YouTube channel or video link. */
export default function AddChannelModal({ visible, onClose }: Props) {
  const { addChannelByLink } = useApp();
  const [value, setValue] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const reset = () => {
    setValue("");
    setBusy(false);
    setFeedback(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setFeedback(null);
    const result = await addChannelByLink(value.trim());
    setBusy(false);
    setFeedback(result);
    if (result.ok) {
      setValue("");
      setTimeout(close, 900);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <Pressable onPress={close} style={styles.backdrop}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={type.caption}>Add a channel</Text>
            <Pressable onPress={close} hitSlop={10}>
              <X size={16} color={palette.inkMuted} />
            </Pressable>
          </View>
          <Text style={[type.heading, { marginTop: spacing.xs }]}>Paste a link.</Text>
          <Text style={[type.bodySoft, { marginTop: spacing.sm }]}>
            A channel link or a single video link. We add the creator so their videos show up.
          </Text>

          <View style={styles.inputRow}>
            <Link2 size={16} color={palette.inkMuted} strokeWidth={1.6} />
            <TextInput
              value={value}
              onChangeText={(t) => {
                setValue(t);
                setFeedback(null);
              }}
              placeholder="youtube.com/@channel or a video URL"
              placeholderTextColor={palette.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={styles.input}
              onSubmitEditing={submit}
              returnKeyType="done"
              testID="add-channel-input"
            />
          </View>

          {feedback ? (
            <Text style={[type.label, { marginTop: spacing.md, color: feedback.ok ? palette.accent : "#8C3A2E" }]}>
              {feedback.message}
            </Text>
          ) : null}

          <Pressable onPress={submit} style={styles.button} disabled={busy} testID="add-channel-submit">
            {busy ? (
              <ActivityIndicator color={palette.wall} size="small" />
            ) : (
              <Text style={styles.buttonText}>Add channel</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(26,28,26,0.4)", justifyContent: "center", padding: spacing.lg },
  card: { backgroundColor: palette.wall, padding: spacing.lg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  input: { flex: 1, ...type.body, padding: 0, fontSize: 15 },
  button: {
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: palette.wall, fontFamily: "Georgia", fontSize: 15 },
});
