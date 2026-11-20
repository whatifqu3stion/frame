import { useDiscoveryRun } from "@/hooks/useDiscoveryRun";
import { discoveryRun } from "@/services/discoveryRunInstance";
import WeeklyPicksInfo from "@/components/WeeklyPicksInfo";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Text from "@/components/FrameText";
import PickGallery from "@/components/PickGallery";
import FirstDiscoveries from "@/components/FirstDiscoveries";
import { interestPickWatchItem } from "@/domain/onboarding";
import GenerateWeeklyPicks from "@/components/GenerateWeeklyPicks";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { featureFirstPick, onboardingPreviewPage } from "@/domain/onboardingPreview";
import { useFeedback } from "@/hooks/useFeedback";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";
import { weeklyDiscoveryPeriodKey, weeklyPickToSourceResolution } from "@/services/discovery";
import { weeklyEditionService } from "@/services/weeklyEditionInstance";
import type { WeeklyPickSourceSuggestion } from "@/types";

type Props = {
  finalReveal?: boolean;
  interestIds: string[];
  onChooseCreator?(): void;
  onChooseTopics(): void;
  onSetUpKeys(): void;
  onWatch(pick: WeeklyPickSourceSuggestion): void;
  onBrowse(): void;
  onBusyChange?(busy: boolean): void;
};
export default function InterestPicksReveal({ finalReveal = false, interestIds, onChooseCreator, onChooseTopics, onSetUpKeys, onWatch, onBrowse, onBusyChange }: Props) {
  const { activeProfile, activeProfileId, interests, followedChannels, confirmSource } = useApp();
  const { palette, type } = useFrameTheme();
  const feedback = useFeedback();
  const shown = useRef(false);
  const search = useDiscoveryRun();
  const firstIds = useRef<string[]>([]);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const { run, busy: following } = useScreenAction(activeProfileId);
  const busy = following || generating;
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const ids = [...interestIds].sort();
  const picks = useQuery({
    queryKey: ["onboarding-picks", activeProfileId, weeklyDiscoveryPeriodKey(), ids.join(",")],
    queryFn: () => weeklyEditionService.preview(ids, activeProfileId),
    enabled: ids.length > 0, networkMode: "always", staleTime: Infinity, retry: false, refetchOnWindowFocus: false,
  });
  const result = picks.data;
  const issued = result?.status === "success" || result?.status === "cached_success";
  const pool = issued ? featureFirstPick(result.items) : [];
  const { items, previousPage, nextPage } = onboardingPreviewPage(pool, [], page);
  const watchable = finalReveal ? pool.filter(pick => interestPickWatchItem(pick, activeProfileId, Date.now())) : [];
  if (!firstIds.current.length && watchable.length) firstIds.current = watchable.slice(0, 3).map(pick => pick.providerSourceId);
  const firstFilms = firstIds.current.flatMap(id => watchable.filter(pick => pick.providerSourceId === id));
  const ownSearch = search.profileId === activeProfileId && search.interestKey === ids.join(",");
  const browsePage = (index: number) => { setPage(index); setNotice(""); onBrowse(); };
  const action = (label: string, press: () => void, disabled = busy, accessibilityLabel = label) => <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} accessibilityState={{ disabled }} onPress={press} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.xs }}><Text style={[type.label, { color: disabled ? palette.inkMuted : palette.active }]}>{label}</Text></Pressable>;
  const follow = (pick: WeeklyPickSourceSuggestion) => {
    const done = feedback.capture();
    setNotice("");
    void run(() => confirmSource(weeklyPickToSourceResolution(pick)), (outcome) => {
      if (!outcome.ok) { setNotice(outcome.message); return; }
      done("commit"); setNotice(outcome.message);
    }, () => setNotice("Couldn’t follow this creator. Try again."));
  };
  const title = <Text style={type.title} accessibilityRole="header">Your weekly picks.</Text>;
  const showPicksInfo = activeProfile?.role === "owner" && ids.length > 0 && !picks.isPending && !picks.isError && (issued || result?.reason === "configuration");
  if (firstFilms.length) return <View style={{ gap: spacing.md }}><FirstDiscoveries disabled={busy} items={firstFilms.map(pick => ({
    id: pick.providerSourceId, title: pick.featuredMedia!.title, creator: pick.displayName,
    image: { uri: pick.featuredMedia!.thumbnailUrl ?? undefined }, durationSeconds: pick.featuredMedia!.durationSeconds ?? undefined,
    reason: pick.recommendationReason ?? undefined, interest: interests.find(interest => interest.id === pick.interestId)?.name,
  }))} onWatch={id => { const pick = firstFilms.find(item => item.providerSourceId === id); if (pick) onWatch(pick); }} />
    {ownSearch && search.status === "running" ? <View style={{ paddingTop: spacing.sm }}>
      <Text style={type.bodySoft} accessibilityLiveRegion="polite">Your first picks are ready. Looking for a few more…</Text>
      {action("Stop searching", () => discoveryRun.cancel(), false)}
    </View> : ownSearch && (search.status === "failed" || search.status === "stopped" || search.message.startsWith("Saved the fully reviewed picks.")) ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{search.message}</Text> : null}
  </View>;
  return <View style={{ gap: spacing.md }}>
    {!generating && !items.length && (showPicksInfo ? <WeeklyPicksInfo anchor={title} onSetUpKeys={onSetUpKeys} /> : title)}
    {!ids.length ? action("Choose my interests", onChooseTopics) : picks.isPending ? <ActivityIndicator accessibilityLabel="Loading your picks" color={palette.active} />
      : picks.isError || (!issued && result?.reason !== "configuration") ? <>
        <Text style={type.bodySoft} accessibilityLiveRegion="polite">{result?.message ?? "Your picks couldn’t load."}</Text>
        {action("Try again", () => { void picks.refetch(); }, picks.isFetching)}
      </> : <>
        {!items.length ? <>
          {!generating && issued ? <Text style={type.bodySoft}>{result.reason === "empty" ? "No creators met the review criteria this week." : "This week’s edition has no picks for these topics."}</Text> : null}
          <GenerateWeeklyPicks hasEdition={issued} onSetUpKeys={onSetUpKeys} onBusyChange={setGenerating} />
        </> : <PickGallery key={`${page}:${items[0].providerSourceId}`} featuredId={pool[0]?.providerSourceId} items={items} busy={busy} animate={!shown.current} onPresented={() => { shown.current = true; }} onBrowse={() => { setNotice(""); onBrowse(); }} isFollowed={(pick) => followedChannels.some((channel) => channel.id === pick.providerSourceId)} onFollow={follow} onWatch={onWatch} />}
        {result?.message?.startsWith("Saved the fully reviewed picks.") ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{result.message}</Text> : null}
        {notice ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{notice}</Text> : null}
        {previousPage !== null || nextPage !== null ? <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {previousPage !== null ? action("Previous picks", () => browsePage(previousPage)) : null}
          {nextPage !== null ? action("More picks", () => browsePage(nextPage)) : null}
        </View> : null}
      </>}
    {onChooseCreator && !items.length && !busy ? action("Add a creator I know instead", onChooseCreator) : null}
  </View>;
}
