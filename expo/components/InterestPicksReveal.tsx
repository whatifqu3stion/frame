import WeeklyPicksInfo from "@/components/WeeklyPicksInfo";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Text from "@/components/FrameText";
import PickGallery from "@/components/PickGallery";
import GenerateWeeklyPicks from "@/components/GenerateWeeklyPicks";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { interestTopicFromId } from "@/domain/interests";
import { featureFirstPick, onboardingPreviewPage } from "@/domain/onboardingPreview";
import { useFeedback } from "@/hooks/useFeedback";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";
import { weeklyDiscoveryPeriodKey, weeklyPickToSourceResolution } from "@/services/discovery";
import { weeklyEditionService } from "@/services/weeklyEditionInstance";
import type { WeeklyPickSourceSuggestion } from "@/types";
import { PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import { sampleInterestPicks } from "@/preview/interestPicks";

type Props = {
  interestIds: string[];
  onChooseCreator(): void;
  onChooseTopics(): void;
  onSetUpKeys(): void;
  onWatch(pick: WeeklyPickSourceSuggestion): void;
  onBrowse(): void;
  onBusyChange(busy: boolean): void;
};
export default function InterestPicksReveal({ interestIds, onChooseCreator, onChooseTopics, onSetUpKeys, onWatch, onBrowse, onBusyChange }: Props) {
  const { activeProfile, activeProfileId, followedChannels, confirmSource } = useApp();
  const { palette, type } = useFrameTheme();
  const feedback = useFeedback();
  const shown = useRef(false);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const { run, busy: following } = useScreenAction(activeProfileId);
  const busy = following || generating;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const ids = [...interestIds].sort();
  const picks = useQuery({
    queryKey: ["onboarding-picks", activeProfileId, weeklyDiscoveryPeriodKey(), ids.join(","), ...(PREVIEW_LIBRARY_ENABLED ? ["sample"] : [])],
    queryFn: () => PREVIEW_LIBRARY_ENABLED ? Promise.resolve(sampleInterestPicks(ids, Date.now())) : weeklyEditionService.preview(ids, activeProfileId),
    initialData: PREVIEW_LIBRARY_ENABLED && ids.length ? () => sampleInterestPicks(ids, Date.now()) : undefined,
    enabled: ids.length > 0, networkMode: "always", staleTime: Infinity, retry: false, refetchOnWindowFocus: false,
  });
  const result = picks.data;
  const issued = result?.status === "success" || result?.status === "cached_success";
  const pool = issued ? featureFirstPick(result.items) : [];
  const { items, previousPage, nextPage } = onboardingPreviewPage(pool, [], page);
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
  const showPicksInfo = activeProfile?.role === "owner" && !PREVIEW_LIBRARY_ENABLED && ids.length > 0 && !picks.isPending && !picks.isError && (issued || result?.reason === "configuration");
  return <View style={{ gap: spacing.md }}>
    {!generating && !items.length && (showPicksInfo ? <WeeklyPicksInfo anchor={title} onSetUpKeys={onSetUpKeys} /> : title)}
    {!ids.length ? action("Choose my interests", onChooseTopics) : picks.isPending ? <ActivityIndicator accessibilityLabel="Loading your picks" color={palette.active} />
      : picks.isError || (!issued && result?.reason !== "configuration") ? <>
        <Text style={type.bodySoft} accessibilityLiveRegion="polite">{result?.message ?? "Your picks couldn’t load."}</Text>
        {action("Try again", () => { void picks.refetch(); }, picks.isFetching)}
      </> : <>
        {!items.length ? <>
          {!generating ? <Text style={type.bodySoft}>{issued ? result.reason === "empty" ? "No creators met the review criteria this week." : "This week’s edition has no picks for these topics." : `For ${ids.map((id) => interestTopicFromId(id)?.name).filter(Boolean).slice(0, 3).join(", ")}.`}</Text> : null}
          {!PREVIEW_LIBRARY_ENABLED ? <GenerateWeeklyPicks hasEdition={issued} onSetUpKeys={onSetUpKeys} onBusyChange={setGenerating} /> : action("Choose different interests", onChooseTopics)}
        </> : <PickGallery key={`${page}:${items[0].providerSourceId}`} featuredId={pool[0]?.providerSourceId} items={items} busy={busy} animate={!shown.current} onPresented={() => { shown.current = true; }} onBrowse={() => { setNotice(""); onBrowse(); }} isFollowed={(pick) => followedChannels.some((channel) => channel.id === pick.providerSourceId)} onFollow={follow} onWatch={onWatch} />}
        {result?.message?.startsWith("Saved the fully reviewed picks.") ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{result.message}</Text> : null}
        {notice ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{notice}</Text> : null}
        {previousPage !== null || nextPage !== null ? <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {previousPage !== null ? action("Previous picks", () => browsePage(previousPage)) : null}
          {nextPage !== null ? action("More picks", () => browsePage(nextPage)) : null}
        </View> : null}
      </>}
    {!items.length && !busy ? action("Add a creator I know instead", onChooseCreator) : null}
    {PREVIEW_LIBRARY_ENABLED && <Text style={type.caption}>Sample selection · fictional videos</Text>}
  </View>;
}
