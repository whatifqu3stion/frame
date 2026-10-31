import Text from "@/components/FrameText";
import { useCallback, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Pressable from "./motion/ChoicePressable";
import Heading from "./Heading";
import TextField from "./TextField";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { byokYouTube } from "@/services/byok";
import { ProviderError } from "@/services/providerRequest";
import type { Channel } from "@/types";

/** An explicit, finite channel lookup. Opening a result never follows it. */
export default function ChannelSearch() {
  const { palette, type } = useFrameTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Channel[]>([]);
  const [searched, setSearched] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useFocusEffect(useCallback(() => {
    const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); };
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") cancel(); });
    return () => { cancel(); subscription.remove(); };
  }, []));
  const search = async () => {
    if (!query.trim() || request.current) return;
    const controller = new AbortController(); request.current = controller;
    const term = query.trim(); setBusy(true); setError(null); setResults([]); setSearched(null);
    try {
      const channels = await byokYouTube.searchChannels(term, controller.signal);
      if (!controller.signal.aborted) { setResults(channels); setSearched(term); }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof ProviderError ? error.message : "Channels couldn’t load. Try again.");
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  return <View style={{ gap: spacing.sm, marginVertical: spacing.lg }}>
    <Heading style={type.heading}>Find a channel</Heading>
    <Text style={type.bodySoft}>Search for a creator or subject. Review a channel before choosing to follow it.</Text>
    <TextField value={query} onChangeText={setQuery} maxLength={120} editable={!busy} accessibilityLabel="Search for channels" placeholder="Creator or subject" autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => { void search(); }} />
    <Pressable onPress={() => { void search(); }} disabled={busy || !query.trim()} accessibilityRole="button" accessibilityState={{ disabled: busy || !query.trim(), busy }} style={{ minHeight: 48, justifyContent: "center", opacity: busy || !query.trim() ? 0.5 : 1 }}><Text style={[type.label, { color: palette.active }]}>{busy ? "Finding channels…" : "Find channels"}</Text></Pressable>
    {error ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{error}</Text> : null}
    {searched ? <Text style={type.caption} accessibilityLiveRegion="polite">{results.length ? `${results.length} channels for “${searched}”` : `No channels found for “${searched}”. Try a more specific name.`}</Text> : null}
    {results.map((channel) => <Pressable key={channel.id} accessibilityRole="button" accessibilityLabel={`Review ${channel.title}`} onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })} style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.borderSoft, gap: spacing.xs }}>
      <Text style={type.label}>{channel.title}</Text>
      {channel.description ? <Text style={type.bodySoft} numberOfLines={2}>{channel.description}</Text> : null}
      <Text style={[type.caption, { color: palette.active }]}>Review channel</Text>
    </Pressable>)}
    {results.length ? <Text style={type.bodySoft}>End of this selection. Refine your search to find a different channel.</Text> : null}
  </View>;
}
