import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowRight, CircleCheck } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ScreenHeader from "@/components/ScreenHeader";
import { VideoFeedSkeleton } from "@/components/VideoSkeleton";
import { MAX_ITEMS_PER_SOURCE, TODAY_MAX_ITEMS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { resolveTodayShellState, shellProfileQueryKeys } from "@/domain/productShell";
import { useApp } from "@/providers/AppProvider";
import { discoveryService } from "@/services/discovery";

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { activeProfileId, followedChannels, sourcesLoading, sourcesError } = useApp();
  const keys = shellProfileQueryKeys(activeProfileId);
  const todayQuery = useQuery({
    queryKey: keys.today,
    queryFn: () => discoveryService.getTodayFeed(activeProfileId),
    enabled: followedChannels.length > 0,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const state = resolveTodayShellState({
    followedSourceCount: followedChannels.length,
    isLoading: sourcesLoading || (todayQuery.isLoading && todayQuery.fetchStatus !== "idle"),
    isError: sourcesError || todayQuery.isError,
    status: todayQuery.data?.status,
    itemCount: todayQuery.data?.items.length ?? 0,
  });

  const stateContent = state === "loading" ? (
    <VideoFeedSkeleton count={3} accessibilityLabel="Loading today's finite inbox" />
  ) : state === "no_sources" ? (
    <>
      <EmptyState title="Choose one trusted source" body="Today begins with sources you select. Add one manually—Frame will never fill this space with invented recommendations." />
      <PrimaryLink label="Open Sources" onPress={() => router.push("/(tabs)/sources")} styles={styles} />
    </>
  ) : state === "offline" ? (
    <EmptyState title="Today is offline" body="Your saved videos remain available. Today will return when Frame can reach its shared service." />
  ) : state === "service_error" ? (
    <EmptyState title="Today couldn't load" body="The service is unavailable right now. No source was polled separately and nothing was substituted." />
  ) : state === "caught_up" ? (
    <View accessibilityLabel="Caught up">
      <EmptyState symbol="✓" title="You’re caught up" body="That is the end of today’s finite inbox. Come back when you choose to." />
    </View>
  ) : state === "ready" ? (
    <EmptyState title="Today is ready" body={`Up to ${TODAY_MAX_ITEMS} items will appear here, with no more than ${MAX_ITEMS_PER_SOURCE} from one source.`} />
  ) : (
    <EmptyState title="No qualifying videos today" body={todayQuery.data?.message ?? "Your sources are still here, but the shared Today service is not available yet. Open a source directly whenever you choose."} />
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.page}>
        <ScreenHeader eyebrow="Today" title={"A finite\ninbox."} subtitle="Trusted sources, a small number of choices, and a real stopping point." />
        <View style={styles.boundaryRow} accessible accessibilityLabel={`Today is limited to ${TODAY_MAX_ITEMS} videos, with at most ${MAX_ITEMS_PER_SOURCE} per source`}>
          <CircleCheck size={17} color={palette.active} strokeWidth={1.8} />
          <Text style={styles.boundaryText}>Up to {TODAY_MAX_ITEMS} videos · no more than {MAX_ITEMS_PER_SOURCE} per source</Text>
        </View>
        <View style={styles.content}>{stateContent}</View>
        {followedChannels.length > 0 ? (
          <Pressable onPress={() => router.push("/(tabs)/sources")} style={styles.secondaryLink} accessibilityRole="button" accessibilityLabel="Open followed sources">
            <Text style={styles.secondaryText}>Open a source directly</Text>
            <ArrowRight size={16} color={palette.accent} />
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function PrimaryLink({ label, onPress, styles }: { label: string; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  const { palette } = useFrameTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} accessibilityRole="button">
      <Text style={styles.primaryButtonText}>{label}</Text>
      <ArrowRight size={17} color={palette.onDark} />
    </Pressable>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall },
    page: { paddingHorizontal: spacing.page },
    boundaryRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.activeSoft, borderWidth: 1, borderColor: palette.borderSoft },
    boundaryText: { ...type.label, flex: 1, color: palette.active },
    content: { marginTop: spacing.lg },
    primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: -spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep },
    primaryButtonText: { ...type.label, color: palette.onDark },
    secondaryLink: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", marginTop: spacing.md },
    secondaryText: { ...type.label, color: palette.accent },
    pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  });
}
