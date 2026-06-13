import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import VideoCard from "@/components/VideoCard";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { searchVideos } from "@/services/youtube";

const SUGGESTIONS = ["Slow design", "Tarkovsky", "Architecture talks", "Bookbinding", "Long-form documentary"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { prefs } = useApp();
  const [query, setQuery] = useState<string>("");
  const [submitted, setSubmitted] = useState<string>("");

  const searchQuery = useQuery({
    queryKey: ["search", submitted, prefs.youtubeApiKey],
    queryFn: () => searchVideos(submitted, prefs.youtubeApiKey),
    enabled: submitted.length > 0,
  });

  const onSubmit = () => {
    setSubmitted(query.trim());
    Keyboard.dismiss();
  };

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
            onSubmitEditing={onSubmit}
            placeholder="Search YouTube"
            placeholderTextColor={palette.inkMuted}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.input}
            testID="search-input"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setSubmitted(""); }} hitSlop={8}>
              <X size={16} color={palette.inkMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {submitted.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={type.caption}>Try</Text>
          <View style={{ marginTop: spacing.md }}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => { setQuery(s); setSubmitted(s); }}
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
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  suggestionText: { ...type.heading, fontSize: 18 },
});
