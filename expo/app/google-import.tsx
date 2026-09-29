import Image from "@/components/MediaImage";
import { router } from "expo-router";
import { Check, ChevronDown, Circle, Import, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import type { FollowedChannel } from "@/types";

type LoadState = "idle" | "loading" | "loadingMore";

export default function GoogleImportScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const {
    activeProfile,
    googleConnected,
    followedChannels,
    importing,
    loadGoogleSubscriptions,
    importGoogleSubscriptions,
  } = useApp();
  const loadLock = useRef(false);
  const importLock = useRef(false);
  const [query, setQuery] = useState("");
  const [subscriptions, setSubscriptions] = useState<FollowedChannel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const followedIds = useMemo(() => new Set(followedChannels.map((source) => source.id)), [followedChannels]);
  const availableSlots = Math.max(0, PRODUCT_LIMITS.futureSourcesPerProfile - followedIds.size);

  const loadPage = useCallback(async (pageToken?: string): Promise<void> => {
    if (!googleConnected || loadLock.current) return;
    loadLock.current = true;
    setLoadState(pageToken ? "loadingMore" : "loading");
    setFeedback(null);
    try {
    const result = await loadGoogleSubscriptions(pageToken);
    setLoadState("idle");
    if (result.status !== "success" && result.status !== "empty" && result.status !== "partial") {
      setFeedback({ ok: false, message: result.message });
      return;
    }
    setSubscriptions((current) => {
      const combined = pageToken ? [...current, ...result.data.items] : result.data.items;
      return [...new Map(combined.map((source) => [source.id, source])).values()];
    });
    setNextPageToken(result.data.nextPageToken);
    setTotalResults(result.data.totalResults);
    if (result.status === "partial" || result.status === "empty") {
      setFeedback({ ok: result.status === "empty", message: result.message ?? "No subscriptions were found." });
    }
    } catch { setFeedback({ ok: false, message: "Couldn’t load subscriptions. Check your connection and try again." }); }
    finally { loadLock.current = false; setLoadState("idle"); }
  }, [googleConnected, loadGoogleSubscriptions]);

  useEffect(() => {
    if (googleConnected && subscriptions.length === 0 && loadState === "idle" && !feedback) void loadPage();
  }, [feedback, googleConnected, loadPage, loadState, subscriptions.length]);

  const toggle = (sourceId: string): void => {
    if (importing || followedIds.has(sourceId)) return;
    setFeedback(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else if (next.size < availableSlots) next.add(sourceId);
      return next;
    });
  };

  const importSelected = async (): Promise<void> => {
    if (importLock.current || importing || selectedIds.size === 0) return;
    importLock.current = true;
    const selected = subscriptions.filter((source) => selectedIds.has(source.id));
    try {
      const result = await importGoogleSubscriptions(selected);
      setFeedback({ ok: result.ok, message: result.message });
      if (result.ok) setSelectedIds(new Set());
    } catch { setFeedback({ ok: false, message: "Import couldn’t finish. Check your sources before trying again." }); }
    finally { importLock.current = false; }
  };

  if (!googleConnected) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Google isn’t connected.</Text>
        <Text style={styles.emptyBody}>Return to Sources or Settings to connect, then choose subscriptions.</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
    <FlatList
      data={subscriptions.filter((source) => source.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}
      ListHeaderComponent={(
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>Optional setup</Text>
          <Text style={styles.title}>Choose what enters Frame.</Text>
          <Text style={styles.body}>Nothing is imported automatically. Select only the subscriptions you want for {activeProfile?.name ?? "this profile"}.</Text>
          <Text style={[type.label, { marginTop: spacing.md }]}>Search loaded subscriptions</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Source name" placeholderTextColor={palette.inkMuted} accessibilityLabel="Search loaded subscriptions" style={[type.body, { minHeight: 48, padding: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: radii.control }]} />
          <View style={styles.counterRow}>
            <Text style={styles.counter}>{selectedIds.size} selected</Text>
            <Text style={styles.capacity}>{availableSlots} spaces available</Text>
          </View>

        </View>
      )}
      renderItem={({ item }) => {
        const followed = followedIds.has(item.id);
        const selected = selectedIds.has(item.id);
        const selectionFull = !selected && selectedIds.size >= availableSlots;
        return (
          <Pressable
            onPress={() => toggle(item.id)}
            disabled={importing || followed || selectionFull}
            style={({ pressed }) => [styles.row, selected && styles.rowSelected, (followed || selectionFull) && styles.rowDisabled, pressed && styles.pressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: followed || selected, disabled: importing || followed || selectionFull }}
            accessibilityLabel={`${item.title}${followed ? ", already followed" : ""}`}
            testID={`google-subscription-${item.id}`}
          >
            <View style={styles.avatar}><Image source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : null} style={styles.avatarImage} contentFit="cover" cachePolicy="none" /></View>
            <View style={styles.rowCopy}><Text style={styles.sourceName} numberOfLines={2}>{item.title}</Text><Text style={styles.sourceState}>{followed ? "Already followed" : selected ? "Selected" : "Tap to select"}</Text></View>
            <View style={[styles.check, (selected || followed) && styles.checkSelected]}>{selected || followed ? <Check size={16} color={palette.onAccent} strokeWidth={2.4} /> : <Circle size={18} color={palette.inkMuted} strokeWidth={1.4} />}</View>
          </Pressable>
        );
      }}
      ListEmptyComponent={loadState === "loading" ? <View style={styles.loading}><ActivityIndicator color={palette.active} /><Text style={styles.loadingText}>Loading subscriptions…</Text></View> : feedback ? null : <View style={styles.loading}><Text style={styles.emptyTitle}>{query.trim() ? "No matching subscriptions." : "No subscriptions found."}</Text><Text style={styles.emptyBody}>{query.trim() ? "Search covers loaded subscriptions. Clear the search or load more below." : "You can still add any trusted source manually."}</Text></View>}
      ListFooterComponent={(
        <View style={styles.footer}>
          {nextPageToken ? <Pressable onPress={() => { void loadPage(nextPageToken); }} disabled={loadState !== "idle"} style={styles.loadMore} accessibilityRole="button" testID="google-import-load-more">{loadState === "loadingMore" ? <ActivityIndicator size="small" color={palette.active} /> : <ChevronDown size={17} color={palette.active} />}<Text style={styles.loadMoreText}>Load 50 more</Text></Pressable> : subscriptions.length > 0 ? <Text style={styles.endText}>{totalResults && totalResults > subscriptions.length ? `${subscriptions.length} shown` : "End of subscriptions"}</Text> : null}
          {feedback && !feedback.ok && subscriptions.length === 0 ? <Pressable onPress={() => { void loadPage(); }} disabled={loadState !== "idle"} style={styles.loadMore} accessibilityRole="button"><RefreshCw size={16} color={palette.active} /><Text style={styles.loadMoreText}>Try again</Text></Pressable> : null}

        </View>
      )}
    />
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}><Text style={styles.counter} accessibilityLiveRegion="polite">{selectedIds.size} selected · {availableSlots} spaces available</Text>
          {feedback ? <View accessibilityLiveRegion="polite" style={[styles.feedback, feedback.ok ? styles.feedbackGood : styles.feedbackBad]}><Text style={styles.feedbackText}>{feedback.message}</Text></View> : null}
          <Pressable onPress={() => { void importSelected(); }} disabled={selectedIds.size === 0 || importing} style={[styles.primaryButton, (selectedIds.size === 0 || importing) && styles.primaryButtonDisabled]} accessibilityRole="button" testID="google-import-confirm">
            {importing ? <ActivityIndicator color={palette.onDark} /> : <><Import size={17} color={palette.onDark} /><Text style={styles.primaryButtonText}>Add {selectedIds.size || "selected"} to Frame</Text></>}
          </Pressable>
    </View>
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    dock: { gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surfaceHigh },
    content: { padding: spacing.page, gap: spacing.sm, paddingBottom: spacing.xxl },
    intro: { paddingBottom: spacing.md }, eyebrow: { ...type.caption, color: palette.active }, title: { ...type.heading, fontSize: 28, lineHeight: 34, marginTop: spacing.sm }, body: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.sm },
    counterRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }, counter: { ...type.label, color: palette.active, fontVariant: ["tabular-nums"] }, capacity: { ...type.caption, color: palette.inkMuted, fontVariant: ["tabular-nums"] },
    feedback: { padding: spacing.md, borderRadius: radii.control, marginTop: spacing.sm, borderWidth: 1 }, feedbackGood: { backgroundColor: palette.activeSoft, borderColor: palette.active }, feedbackBad: { backgroundColor: palette.surface, borderColor: palette.danger }, feedbackText: { ...type.bodySoft, color: palette.ink },
    row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface }, rowSelected: { borderColor: palette.active, backgroundColor: palette.activeSoft }, rowDisabled: { opacity: 0.58 }, pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
    avatar: { width: 48, height: 48, borderRadius: 24, overflow: "hidden", backgroundColor: palette.surfaceDeep }, avatarImage: { width: "100%", height: "100%" }, rowCopy: { flex: 1 }, sourceName: { ...type.label, fontSize: 16 }, sourceState: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 }, check: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 }, checkSelected: { backgroundColor: palette.active },
    loading: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: spacing.sm }, loadingText: { ...type.bodySoft, color: palette.inkMuted }, emptyTitle: { ...type.heading, fontSize: 20, textAlign: "center" }, emptyBody: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },
    footer: { gap: spacing.md, paddingTop: spacing.md }, loadMore: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface }, loadMoreText: { ...type.label, color: palette.active }, endText: { ...type.caption, color: palette.inkMuted, textAlign: "center" },
    primaryButton: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep }, primaryButtonDisabled: { opacity: 0.45 }, primaryButtonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: palette.wall }, secondaryButton: { minHeight: 48, minWidth: 140, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface }, secondaryButtonText: { ...type.label, color: palette.active },
  });
}

