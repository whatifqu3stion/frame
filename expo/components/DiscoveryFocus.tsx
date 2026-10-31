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

export default function DiscoveryFocus({ compact = false }: { compact?: boolean }) {
  const { activeProfileId, interests } = useApp();
  const { type } = useFrameTheme();
  const client = useQueryClient();
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
  const shown = [...interests.filter((topic) => selected.includes(topic.id)), ...matching.filter((topic) => !selected.includes(topic.id))].slice(0, 12);
  const toggle = async (id: string) => {
    if (busy || !focus.data) return;
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : selected.length < 3 ? [...selected, id] : selected;
    setBusy(true); setError("");
    try { await AsyncStorage.setItem(profileStorageKey("discoveryFocus", activeProfileId), JSON.stringify(next)); client.setQueryData(key, next); }
    catch { setError("Your discovery focus couldn’t save. Try again."); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: spacing.sm, marginTop: compact ? 0 : spacing.lg }}>
    {!compact ? <Text style={type.heading} accessibilityRole="header">Focus for next edition</Text> : null}
    <Text style={type.bodySoft}>Choose up to three of your interests to include in the next edition’s research. The rest rotate. Your current picks stay the same.</Text>
    {interests.length > 12 ? <TextField value={search} onChangeText={setSearch} placeholder="Find a selected interest" accessibilityLabel="Find an interest to prioritize" /> : null}
    {shown.map((topic) => <ChoiceOption role="checkbox" accessibilityLabel={`Prioritize ${topic.name}`} key={topic.id} label={topic.name} selected={selected.includes(topic.id)} disabled={busy || focus.isPending || (!selected.includes(topic.id) && selected.length >= 3)} onPress={() => { void toggle(topic.id); }} />)}
    {focus.isError || error ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{error || "Your discovery focus couldn’t load. Reopen this screen to try again."}</Text> : null}
  </View>;
}
