import { PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import { makePreviewLibrary } from "@/preview/library";
import Text from "@/components/FrameText";
import PrimaryAction from "@/components/PrimaryAction";
import { useCallback, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Pressable from "./motion/ChoicePressable";
import { Search } from "lucide-react-native";
import TextField from "./TextField";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { radii, spacing } from "@/constants/theme";
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
      const channels = PREVIEW_LIBRARY_ENABLED
        ? makePreviewLibrary(Date.now()).channels.filter((channel) => `${channel.title} ${channel.description}`.toLowerCase().includes(term.toLowerCase()))
        : await byokYouTube.searchChannels(term, controller.signal);
      if (!controller.signal.aborted) { setResults(channels); setSearched(term); }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof ProviderError ? error.message : "Channels couldn’t load. Try again.");
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  return <View style={{ gap: spacing.sm }}>
    <Text style={type.label}>Search by creator or subject</Text>
    <TextField leading={<Search size={18} color={palette.inkMuted} />} value={query} onChangeText={setQuery} maxLength={120} editable={!busy} accessibilityLabel="Search by creator or subject" placeholder="Name or topic" autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => { void search(); }} />
    <PrimaryAction depth={palette.primaryButtonDepth} onPress={() => { void search(); }} disabled={busy || !query.trim()} accessibilityState={{ disabled: busy || !query.trim(), busy }} style={{ minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep, opacity: busy || !query.trim() ? 0.5 : 1 }}><Text style={[type.label, { color: palette.onDark }]}>{busy ? "Finding channels…" : "Find channels"}</Text></PrimaryAction>
    {error ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{error}</Text> : null}
    {searched ? <Text style={type.caption} accessibilityLiveRegion="polite">{results.length ? `${results.length} ${results.length === 1 ? "channel" : "channels"} for “${searched}”` : `No channels found for “${searched}”. Try a more specific name.`}</Text> : null}
    {results.map((channel) => <Pressable key={channel.id} accessibilityRole="button" accessibilityLabel={`Review ${channel.title}`} onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })} style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.borderSoft, gap: spacing.xs }}>
      <Text style={type.label}>{channel.title}</Text>
      {channel.description ? <Text style={type.bodySoft} numberOfLines={2}>{channel.description}</Text> : null}
      <Text style={[type.caption, { color: palette.active }]}>Review channel</Text>
    </Pressable>)}
    {results.length ? <Text style={type.bodySoft}>End of this selection. Refine your search to find a different channel.</Text> : null}
  </View>;
}
