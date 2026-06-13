import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Clock, Link2, Search as SearchIcon, X } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { extractYouTubeId, searchVideos } from "@/services/youtube";

const SUGGESTIONS = ["Slow design", "Tarkovsky", "Architecture talks", "Bookbinding", "Long-form documentary"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { prefs, recentSearches, addRecentSearch, clearRecentSearches } = useApp();
  const [query, setQuery] = useState<string>("");
  const [submitted, setSubmitted] = useState<string>("");

  const searchQuery = useQuery({
    queryKey: ["search", submitted, prefs.youtubeApiKey],
    queryFn: () => searchVideos(submitted, prefs.youtubeApiKey),
    enabled: submitted.length > 0,
  });

  const runSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const videoId = extractYouTubeId(trimmed);
    if (videoId) {
      Keyboard.dismiss();
      router.push({ pathname: "/watch/[id]", params: { id: videoId } });
      return;
    }
    setQuery(trimmed);
    setSubmitted(trimmed);
    addRecentSearch(trimmed);
    Keyboard.dismiss();
  };

  const pastedLink = extractYouTubeId(query) !== null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Search" title={"Find\nsomething."} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        <View style={styles.searchRow}>
          <SearchIcon size={18} color={palette.inkMuted} strokeWidth={1.6} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            placeholder="Search or paste a YouTube link"
            placeholderTextColor={palette.inkMuted}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.input}
            testID="search-input"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setSubmitted(""); }} hitSlop={8}>
              <X size={16} color={palette.inkMuted} />
            </Pressable>
          )}
        </View>
        {pastedLink && (
          <Pressable onPress={() => runSearch(query)} style={styles.linkBanner} testID="open-link">
            <Link2 size={16} color={palette.accent} strokeWidth={1.6} />
            <Text style={[type.label, { color: palette.accent, flex: 1 }]}>Open this video in Frame</Text>
            <Text style={[type.caption, { color: palette.accent }]}>Play →</Text>
          </Pressable>
        )}
      </View>

      {submitted.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          {recentSearches.length > 0 && (
            <View style={{ marginBottom: spacing.xl }}>
              <View style={styles.sectionRow}>
                <Text style={type.caption}>Recent</Text>
                <Pressable onPress={clearRecentSearches} hitSlop={8} testID="clear-recent">
                  <Text style={[type.caption, { color: palette.inkMuted }]}>Clear</Text>
                </Pressable>
              </View>
              <View style={{ marginTop: spacing.md }}>
                {recentSearches.map((s) => (
                  <Pressable key={s} onPress={() => runSearch(s)} style={styles.recentRow} testID={`recent-${s}`}>
                    <Clock size={15} color={palette.inkMuted} strokeWidth={1.6} />
                    <Text style={styles.recentText} numberOfLines={1}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Text style={type.caption}>Try</Text>
          <View style={{ marginTop: spacing.md }}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => runSearch(s)}
                style={styles.suggestionRow}
                testID={`suggestion-${s}`}
              >
                <Text style={styles.suggestionText}>{s}</Text>
                <Text style={[type.caption, { color: palette.inkMuted }]}>↗</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {submitted.length > 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          {searchQuery.isLoading ? (
            <Text style={[type.bodySoft, { paddingVertical: spacing.lg }]}>Searching…</Text>
          ) : (searchQuery.data ?? []).length === 0 ? (
            <EmptyState title="Nothing found" body={`No results for "${submitted}".`} />
          ) : (
            <>
              <Text style={[type.caption, { marginBottom: spacing.md }]}>{(searchQuery.data ?? []).length} results</Text>
              {(searchQuery.data ?? []).map((v) => (
                <VideoCard key={v.id} video={v} variant="wide" />
              ))}
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  input: { flex: 1, ...type.body, padding: 0, fontSize: 16 },
  linkBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: palette.surfaceDeep,
  },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  recentText: { ...type.body, flex: 1 },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  suggestionText: { ...type.heading, fontSize: 18 },
});
