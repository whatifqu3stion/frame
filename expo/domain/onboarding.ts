import { isLongFormVideo } from "./contentPolicy";
import type { TodaySnapshotItem, TodaySourceRule } from "../models/today";
import { isMetadataCurrent } from "./metadataRetention";
import { visibleTodayItems } from "./today";
import { ONBOARDING_STEPS } from "../constants/navigation";
import type { SourceResolution, WeeklyPickSourceSuggestion } from "../types";

export type OnboardingWatchItem = Pick<TodaySnapshotItem, "profileId" | "id" | "title" | "sourceId" | "sourceTitle" | "thumbnailUrl" | "publishedAt" | "durationSeconds" | "fetchedAt"> & { periodKey?: string; madeForKids?: boolean | null };

export function interestPickWatchItem(pick: WeeklyPickSourceSuggestion, profileId: string, now: number): OnboardingWatchItem | null {
  const media = pick.featuredMedia;
  if (!media || !isLongFormVideo(media) || !pick.fetchedAt || !isMetadataCurrent(pick.fetchedAt, now)) return null;
  return { id: media.providerMediaId, profileId, title: media.title, sourceId: pick.providerSourceId, sourceTitle: pick.displayName, thumbnailUrl: media.thumbnailUrl ?? "", durationSeconds: media.durationSeconds!, publishedAt: media.publishedAt ?? "", fetchedAt: pick.fetchedAt };
}

/** Open the verified film from a pasted link without changing the followed library. */
export function resolvedOnboardingFilm(result: SourceResolution | null, profileId: string, now: number): OnboardingWatchItem | null {
  const media = result?.video;
  const fetchedAt = result?.fetchedAt;
  if (!media || !result || !fetchedAt || !isMetadataCurrent(fetchedAt, now) || !isLongFormVideo(media)
    || media.isLivestream || media.isUpcomingPremiere) return null;
  return {
    id: media.providerMediaId, title: media.title, profileId, fetchedAt,
    sourceId: result.source.providerSourceId, sourceTitle: result.source.displayName,
    thumbnailUrl: media.thumbnailUrl ?? "", publishedAt: media.publishedAt ?? "",
    durationSeconds: media.durationSeconds!, madeForKids: media.madeForKids,
  };
}

export function onboardingNextAction(step: typeof ONBOARDING_STEPS[number], sourceCount: number, replay: boolean, returnTo: "source" | "your-frame" | null = null, manual = false): { label: string; finish: boolean; target?: typeof ONBOARDING_STEPS[number] } {
  if (step === "study") return { label: "What happens after scrolling?", finish: false, target: "intentions" };
  if (step === "intentions") return { label: "What stays with you?", finish: false, target: "recall" };
  if (step === "recall") return { label: "Meet Frame", finish: false, target: "welcome" };
  if (step === "welcome") return { label: "See how Frame works", finish: false, target: "contrast" };
  if (step === "contrast") return { label: manual ? "Choose a creator" : "Choose my interests", finish: false, target: "source" };
  if (step === "keys" && returnTo) return { label: returnTo === "source" ? "Back to your source" : "Back to my picks", finish: false, target: returnTo };
  if (step === "keys") return { label: "Continue", finish: false, target: "study" };
  if (step === "source" && !manual) return { label: "Continue", finish: false, target: "bespoke" };
  if (step === "bespoke" && !manual) return { label: "See my discoveries", finish: false, target: "your-frame" };
  if (step === "source") return sourceCount === 0 && !replay
    ? { label: "Finish for now", finish: true }
    : { label: sourceCount > 0 ? "See my selection" : "Preview selection", finish: false, target: "your-frame" };
  return { label: "Open Today", finish: true };
}

/** Retain only this profile’s eligible selection and fresh cards saved in this reveal. */
export function onboardingSelection(items: readonly TodaySnapshotItem[], profileId: string, sources: ReadonlySet<string>, rules: ReadonlyMap<string, TodaySourceRule>, now: number, savedHere: ReadonlySet<string>): TodaySnapshotItem[] {
  const scoped = items.filter((item) => item.profileId === profileId && isLongFormVideo(item));
  const visible = visibleTodayItems(scoped, sources, rules, now);
  const visibleIds = new Set(visible.map((item) => item.id));
  const justSaved = scoped.filter((item) => savedHere.has(item.id) && item.disposition === "saved" && sources.has(item.sourceId) && (rules.get(item.sourceId)?.mutedUntil ?? 0) <= now && isMetadataCurrent(item.fetchedAt, now) && !visibleIds.has(item.id));
  return [...visible, ...justSaved].sort((a, b) => a.position - b.position);
}

/** An interests handoff opens the same profile’s discovery gallery on Today. */
export function onboardingDestination(profileId: string, showPicks: boolean) {
  return showPicks ? { pathname: "/(tabs)" as const, params: { picksFor: profileId } } : "/(tabs)" as const;
}
