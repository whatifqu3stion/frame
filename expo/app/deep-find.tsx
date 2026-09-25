import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { requestDeepFind, type DeepFindResult, type DeepFindSource } from "@/services/deepFindClient";

export default function DeepFindScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    content: { padding: 24, paddingBottom: insets.bottom + 36, gap: 18 },
    title: { ...type.heading, color: palette.ink, fontSize: 27 },
    body: { ...type.bodySoft, color: palette.inkSoft },
    input: { color: palette.ink, borderColor: palette.border, borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 90, textAlignVertical: "top" },
    button: { backgroundColor: palette.accentDeep, borderRadius: 12, padding: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
    buttonText: { ...type.label, color: palette.onDark },
    card: { backgroundColor: palette.surfaceHigh, borderRadius: 14, padding: 16, gap: 9, borderColor: palette.borderSoft, borderWidth: 1 },
    name: { ...type.label, color: palette.ink, fontSize: 17 },
    link: { ...type.label, color: palette.active },
  }), [insets.bottom, palette, type]);
  const { activeProfileId, isPremium, requirePurchase, confirmSource, followedChannels } = useApp();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeepFindResult | null>(null);
  const [followFeedback, setFollowFeedback] = useState<string | null>(null);
  const profileRef = useRef(activeProfileId);

  useEffect(() => {
    profileRef.current = activeProfileId;
    setResult(null);
    setFollowFeedback(null);
    if (isPremium) void requestDeepFind().then((value) => { if (profileRef.current === activeProfileId) setResult(value); });
  }, [activeProfileId, isPremium]);

  const search = async (): Promise<void> => {
    const request = query.trim();
    if (busy || request.length < 8 || request.length > 160 || !requirePurchase("deepFind")) return;
    setBusy(true);
    setFollowFeedback(null);
    const response = await requestDeepFind(request);
    if (profileRef.current === activeProfileId) {
      setResult(response);
      setBusy(false);
    }
  };

  const follow = async (source: DeepFindSource): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const response = await confirmSource({ source, provenance: "cache", fetchedAt: Date.now() });
    if (profileRef.current === activeProfileId) {
      setFollowFeedback(response.message);
      setBusy(false);
    }
  };

  const remaining = result && "remaining" in result ? result.remaining : undefined;
  const resetAt = result && "resetAt" in result ? result.resetAt : undefined;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Deep Find</Text>
      <Text style={styles.body}>Describe a specific kind of creator or channel. One deliberate request returns up to three verified sources, with no endless results.</Text>
      {isPremium ? <>
        <Text style={styles.body}>{remaining === undefined ? "Checking your allowance…" : `${remaining} of 3 searches left this month`}{resetAt ? ` · Resets ${new Date(resetAt).toLocaleDateString()}` : ""}</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="For example: calm explanations of how bridges are built" placeholderTextColor={palette.inkMuted} style={styles.input} multiline maxLength={160} accessibilityLabel="Specific channel request" />
        <Pressable onPress={() => { void search(); }} disabled={busy || query.trim().length < 8 || remaining === 0} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>{busy ? "Searching…" : "Find sources"}</Text></Pressable>
      </> : <Pressable onPress={() => { requirePurchase("deepFind"); router.back(); }} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>See Premium</Text></Pressable>}
      {busy ? <ActivityIndicator color={palette.active} /> : null}
      {result && "message" in result ? <Text style={styles.body}>{result.message}</Text> : null}
      {result?.state === "ready" && result.sources.length === 0 ? <Text style={styles.body}>No verified channels matched that request. This search has an end; try a different request after considering the remaining allowance.</Text> : null}
      {result?.state === "ready" ? result.sources.map((source) => <View key={source.providerSourceId} style={styles.card}>
        <Text style={styles.name}>{source.displayName}</Text>
        {source.description ? <Text style={styles.body} numberOfLines={3}>{source.description}</Text> : null}
        <Pressable onPress={() => { void follow(source); }} disabled={busy || followedChannels.some((channel) => channel.id === source.providerSourceId)} accessibilityRole="button"><Text style={styles.link}>{followedChannels.some((channel) => channel.id === source.providerSourceId) ? "Following" : "Follow source"}</Text></Pressable>
      </View>) : null}
      {followFeedback ? <Text style={styles.body}>{followFeedback}</Text> : null}
      <Text style={styles.body}>End of Deep Find results</Text>
    </ScrollView>
  );
}
