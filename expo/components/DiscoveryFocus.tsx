import { useFeedback } from "@/hooks/useFeedback";
import SettingsGroup from "./SettingsGroup";
import SettingsRow from "./SettingsRow";
import { router } from "expo-router";
import Text from "@/components/FrameText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { useApp } from "@/providers/AppProvider";
import { profileStorageKey } from "@/storage/profileStorage";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import ChoiceOption from "./ChoiceOption";
import TextField from "./TextField";

export default function DiscoveryFocus({ overview = false }: { overview?: boolean }) {
  const { activeProfileId, interests } = useApp();
  const { type } = useFrameTheme();
  const client = useQueryClient();
  const feedback = useFeedback();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = ["discovery-focus", activeProfileId];
  const focus = useQuery({ queryKey: key, networkMode: "always", queryFn: async (): Promise<string[]> => {
    const raw = JSON.parse(await AsyncStorage.getItem(profileStorageKey("discoveryFocus", activeProfileId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string").slice(0, 3) : [];
  } });
  const selected = (focus.data ?? []).filter((id) => interests.some((topic) => topic.id === id));
  const matching = interests.filter((topic) => topic.name.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = async (id: string) => {
    if (busy || !focus.data) return;
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : selected.length < 3 ? [...selected, id] : selected;
    if (next === selected) return;
    const acknowledge = feedback.capture();
    setBusy(true); setError("");
    try { await AsyncStorage.setItem(profileStorageKey("discoveryFocus", activeProfileId), JSON.stringify(next)); client.setQueryData(key, next); acknowledge("selection"); }
    catch { setError("Your discovery focus couldn’t save. Try again."); }
    finally { setBusy(false); }
  };
  const names = interests.filter((topic) => selected.includes(topic.id)).map((topic) => topic.name);
  if (overview) return <SettingsGroup label="Next weekly search">
    <SettingsRow grouped last title="Priority topics" summary={focus.isPending ? "Loading…" : focus.isError ? "Priorities unavailable" : names.join(", ") || "Rotate through my topics"} onPress={() => router.push("/settings/priorities")} />
  </SettingsGroup>;
  if (focus.isError) return <SettingsRow title="Try again" summary="Your priority topics couldn’t load." busy={focus.isFetching} onPress={() => { void focus.refetch(); }} navigation={false} />;
  if (!interests.length) return <SettingsRow title="Choose topics" summary="Add an interest before choosing a priority." onPress={() => router.push("/settings/topics")} />;
  return <View style={{ gap: spacing.md }}>
    <Text style={type.bodySoft}>Choose up to three topics for your next search. Frame rotates through the others. Leave all unchecked to rotate through every topic.</Text>
    {interests.length > 12 ? <TextField value={search} onChangeText={setSearch} placeholder="Find a topic" accessibilityLabel="Find an interest to prioritize" /> : null}
    <SettingsGroup label={focus.isPending ? "Loading priorities…" : `${selected.length} of 3 selected`}>
      {matching.map((topic) => <ChoiceOption variant="ruled" style={{ paddingHorizontal: spacing.md }} role="checkbox" accessibilityLabel={`Prioritize ${topic.name}`} key={topic.id} label={topic.name} selected={selected.includes(topic.id)} disabled={busy || focus.isPending || (!selected.includes(topic.id) && selected.length >= 3)} onPress={() => { void toggle(topic.id); }} />)}
      {!matching.length && <Text style={[type.bodySoft, { padding: spacing.md }]}>No matching topics.</Text>}
    </SettingsGroup>
    {error ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{error}</Text> : null}
  </View>;
}
