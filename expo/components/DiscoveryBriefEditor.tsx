import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import Text from "./FrameText";
import Heading from "./Heading";
import PrimaryAction from "./PrimaryAction";
import SettingsRow from "./SettingsRow";
import TextField from "./TextField";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { DEFAULT_DISCOVERY_BRIEF, DISCOVERY_BRIEF_LIMIT, readDiscoveryBrief, validDiscoveryBrief } from "@/domain/discoveryBrief";
import { useDiscardChanges } from "@/hooks/useDiscardChanges";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";
import { profileStorageKey } from "@/storage/profileStorage";

export default function DiscoveryBriefEditor() {
  const { activeProfileId, authorizeProtectedAction, profileSwitching } = useApp();
  const { palette, type } = useFrameTheme();
  const client = useQueryClient();
  const navigation = useNavigation();
  const queryKey = ["discovery-brief", activeProfileId];
  const saved = useQuery({ queryKey, networkMode: "always", queryFn: () => readDiscoveryBrief(AsyncStorage, activeProfileId) });
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const { run, capture, busy } = useScreenAction(activeProfileId);
  const text = draft ?? saved.data ?? "";
  const dirty = saved.isSuccess && text.trim() !== saved.data;
  const discard = useDiscardChanges(dirty, activeProfileId, !busy && !profileSwitching);
  usePreventRemove(!profileSwitching && (dirty || busy), ({ data }) => discard(() => navigation.dispatch(data.action)));
  const update = (value: string) => { setDraft(value); setNotice(""); };
  const save = () => {
    if (!dirty || !validDiscoveryBrief(text)) return;
    const current = capture();
    const next = text.trim();
    Keyboard.dismiss();
    setNotice("");
    void run(async () => {
      if (!await authorizeProtectedAction(activeProfileId, true) || !current()) return false;
      const key = profileStorageKey("discoveryBrief", activeProfileId);
      if (next === DEFAULT_DISCOVERY_BRIEF) await AsyncStorage.removeItem(key);
      else await AsyncStorage.setItem(key, next);
      client.setQueryData(queryKey, next);
      return true;
    }, (didSave) => {
      if (didSave) { setDraft(null); setNotice("Saved for your next search."); }
    }, () => setNotice("Your changes couldn’t save. Try again."));
  };
  if (saved.isError) return <SettingsRow title="Try again" summary="Your discovery brief couldn’t load." navigation={false} onPress={() => { void saved.refetch(); }} />;
  if (!saved.isSuccess) return <Text style={type.bodySoft} accessibilityLiveRegion="polite">Loading your brief…</Text>;
  return <View style={styles.page}>
    <View style={styles.intro}>
      <Heading style={type.heading}>What makes a good pick for you?</Heading>
      <Text style={type.bodySoft}>Your topics guide what Frame looks for. Describe the kinds of creators or videos you enjoy within those topics.</Text>
    </View>
    <View style={styles.fieldGroup}>
      <Text style={type.label}>Your brief</Text>
      <TextField multiline disableFullscreenUI value={text} onChangeText={update} maxLength={DISCOVERY_BRIEF_LIMIT}
        editable={!busy} accessibilityLabel="Your discovery brief" textAlignVertical="top"
        style={styles.input} placeholder="I like studio visits where artists explain their choices." />
      <Text style={[type.caption, styles.count]}>{text.length} / {DISCOVERY_BRIEF_LIMIT}</Text>
    </View>
    <Text style={type.bodySoft}>Saved on this device. Frame sends your brief to Gemini when you start a new discovery search.</Text>
    <View style={styles.actions}>
      <PrimaryAction depth={palette.primaryButtonDepth} disabled={busy || !dirty || !validDiscoveryBrief(text)}
        accessibilityState={{ busy, disabled: busy || !dirty || !validDiscoveryBrief(text) }}
        style={[styles.save, { backgroundColor: palette.accentDeep }, (busy || !dirty || !validDiscoveryBrief(text)) && styles.disabled]} onPress={save}>
        <Text style={[type.label, { color: palette.onDark }]}>{busy ? "Saving…" : "Save changes"}</Text>
      </PrimaryAction>
      {text !== DEFAULT_DISCOVERY_BRIEF && <Pressable accessibilityRole="button" disabled={busy} style={styles.restore} onPress={() => {
        update(DEFAULT_DISCOVERY_BRIEF);
        setNotice(saved.data === DEFAULT_DISCOVERY_BRIEF ? "Frame’s wording is already saved." : "Original wording restored. Save changes to use it.");
      }}><Text style={[type.label, { color: palette.active }]}>Restore Frame’s wording</Text></Pressable>}
    </View>
    {notice ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{notice}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  intro: { gap: spacing.sm }, fieldGroup: { gap: spacing.xs },
  input: { minHeight: 108 }, count: { textAlign: "right" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
  save: { minHeight: 48, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.control },
  disabled: { opacity: 0.55 }, restore: { minHeight: 48, justifyContent: "center" },
});
