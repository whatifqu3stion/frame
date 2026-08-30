import { router, useLocalSearchParams } from "expo-router";
import { Check, ListPlus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

export default function AddToSessionModal() {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, updateSessionVideos, createSession, requirePurchase } = useApp();
  const [creating, setCreating] = useState<boolean>(false);
  const [name, setName] = useState<string>("");

  const onPick = async (sessionId: string) => {
    if (!id || !requirePurchase("sessions")) return;
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (!session || session.orderedVideoIds.includes(id) || session.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems) return;
    await updateSessionVideos(sessionId, [...session.orderedVideoIds, id]);
    router.back();
  };

  const onCreate = async () => {
    if (!name.trim() || !id || !requirePurchase("sessions")) return;
    await createSession(name, [id]);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.wall }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={type.caption}>Add to</Text>
        <Text style={[type.title, { marginTop: spacing.xs }]}>A named session.</Text>

        <View style={{ marginTop: spacing.xl }}>
          {sessions.length === 0 && !creating ? (
            <Text style={[type.bodySoft, { color: palette.inkMuted }]}>No named sessions yet. Create one below.</Text>
          ) : (
            sessions.map((q) => {
              const isAlreadyAdded = q.orderedVideoIds.includes(id ?? "");
              return (
                <Pressable key={q.id} onPress={() => onPick(q.id)} disabled={!isAlreadyAdded && q.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems} style={styles.row} testID={`session-${q.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.caption}>{q.orderedVideoIds.length} videos</Text>
                    <Text style={[type.heading, { marginTop: 2 }]}>{q.name}</Text>
                  </View>
                  {isAlreadyAdded ? <Check size={16} color={palette.accent} /> : null}
                </Pressable>
              );
            })
          )}
        </View>

        {creating ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={type.caption}>New named session</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={palette.inkMuted}
              autoFocus
              style={styles.input}
              onSubmitEditing={onCreate}
              returnKeyType="done"
            />
            <Pressable onPress={onCreate} style={styles.createBtn}>
              <Text style={styles.createText}>Create & Add</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setCreating(true)} style={styles.newRow} testID="open-new-session">
            <ListPlus size={16} color={palette.accent} strokeWidth={1.6} />
            <Text style={[type.label, { color: palette.accent }]}>New named session</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: palette.surface,
    marginBottom: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  newRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  input: {
    ...type.body,
    fontSize: 16,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: palette.surface,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  createBtn: {
    marginTop: spacing.md,
    backgroundColor: palette.accentDeep,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radii.control,
    minHeight: 48,
    justifyContent: "center",
  },
  createText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
  });
}
