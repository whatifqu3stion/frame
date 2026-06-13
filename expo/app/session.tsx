import { router } from "expo-router";
import { Check, Play } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { formatDuration } from "@/services/youtube";
import type { Video } from "@/types";

export default function SessionBuilder() {
  const insets = useSafeAreaInsets();
  const { savedVideos, watchLater } = useApp();
  const [selected, setSelected] = useState<string[]>([]);

  const pool = useMemo<Video[]>(() => {
    const map = new Map<string, Video>();
    [...watchLater, ...savedVideos].forEach((v) => {
      if (!map.has(v.id)) map.set(v.id, v);
    });
    return Array.from(map.values());
  }, [savedVideos, watchLater]);

  const totalSeconds = useMemo(
    () => selected.reduce((sum, id) => sum + (pool.find((v) => v.id === id)?.durationSeconds ?? 0), 0),
    [selected, pool],
  );

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const begin = () => {
    if (selected.length === 0) return;
    const [first, ...rest] = selected;
    router.replace({
      pathname: "/watch/[id]",
      params: { id: first, session: [first, ...rest].join(","), i: "0" },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.wall }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <Text style={[type.caption, { color: palette.accent }]}>Session</Text>
        <Text style={[type.title, { marginTop: spacing.xs }]}>Choose a few.{"\n"}Watch. Stop.</Text>
        <Text style={[type.bodySoft, { marginTop: spacing.md, maxWidth: 320 }]}>
          Pick the videos for this sitting. When the last one ends, Frame stops. No feed, no next-up.
        </Text>

        {pool.length === 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState
              title="Nothing to sit with yet"
              body="Save videos or add them to Watch Later, then build a session from them."
            />
          </View>
        ) : (
          <View style={{ marginTop: spacing.xl }}>
            {pool.map((v) => {
              const isOn = selected.includes(v.id);
              const order = selected.indexOf(v.id) + 1;
              return (
                <Pressable key={v.id} onPress={() => toggle(v.id)} style={styles.row} testID={`session-pick-${v.id}`}>
                  <View style={[styles.indexBox, isOn && styles.indexBoxOn]}>
                    {isOn ? <Text style={styles.indexText}>{order}</Text> : <Check size={14} color={palette.inkMuted} strokeWidth={1.6} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.caption} numberOfLines={1}>{v.channelTitle || "YouTube"}</Text>
                    <Text style={[styles.rowTitle, isOn && { color: palette.accent }]} numberOfLines={2}>{v.title}</Text>
                  </View>
                  <Text style={[type.caption, { color: palette.inkMuted }]}>{formatDuration(v.durationSeconds)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {selected.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>{selected.length} video{selected.length === 1 ? "" : "s"}</Text>
            <Text style={[type.heading, { marginTop: 2 }]}>{formatDuration(totalSeconds)} total</Text>
          </View>
          <Pressable onPress={begin} style={styles.beginBtn} testID="begin-session">
            <Play size={16} color={palette.wall} strokeWidth={1.8} fill={palette.wall} />
            <Text style={styles.beginText}>Begin</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  indexBox: {
    width: 30,
    height: 30,
    backgroundColor: palette.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  indexBoxOn: { backgroundColor: palette.ink },
  indexText: { color: palette.wall, fontFamily: "Georgia", fontSize: 14 },
  rowTitle: { ...type.heading, fontSize: 16, lineHeight: 20, marginTop: 2 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: palette.surface,
  },
  beginBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
  },
  beginText: { color: palette.wall, fontFamily: "Georgia", fontSize: 15 },
});
