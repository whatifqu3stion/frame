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

export function onboardingNextAction(step: typeof ONBOARDING_STEPS[number], sourceCount: number, replay: boolean, savedCount = 0, returnTo: "source" | "your-frame" | null = null, manual = false): { label: string; finish: boolean; target?: typeof ONBOARDING_STEPS[number] } {
  if (step === "welcome") return { label: "Set up connections", finish: false, target: "keys" };
  if (step === "keys" && returnTo) return { label: returnTo === "source" ? "Back to your source" : "Back to my picks", finish: false, target: returnTo };
  if (step === "keys") return { label: manual ? "Choose a creator" : "Choose my interests", finish: false };
  if (step === "source" && !manual) return { label: "See my picks", finish: false };
  if (step === "source") return sourceCount === 0 && !replay
    ? { label: "Finish for now", finish: true }
    : { label: sourceCount > 0 ? "See my selection" : "Preview selection", finish: false };
  return { label: replay ? "Back to Settings" : savedCount > 0 ? "Open Saved" : sourceCount > 0 ? "Open Today" : "Explore Sources", finish: true };
}

/** Retain only this profile’s eligible selection and fresh cards saved in this reveal. */
export function onboardingSelection(items: readonly TodaySnapshotItem[], profileId: string, sources: ReadonlySet<string>, rules: ReadonlyMap<string, TodaySourceRule>, now: number, savedHere: ReadonlySet<string>): TodaySnapshotItem[] {
  const scoped = items.filter((item) => item.profileId === profileId && isLongFormVideo(item));
  const visible = visibleTodayItems(scoped, sources, rules, now);
  const visibleIds = new Set(visible.map((item) => item.id));
  const justSaved = scoped.filter((item) => savedHere.has(item.id) && item.disposition === "saved" && sources.has(item.sourceId) && (rules.get(item.sourceId)?.mutedUntil ?? 0) <= now && isMetadataCurrent(item.fetchedAt, now) && !visibleIds.has(item.id));
  return [...visible, ...justSaved].sort((a, b) => a.position - b.position);
}

/** Completion goes to useful content; replay always returns to Settings. */
export function onboardingDestination(sourceCount: number, replay: boolean, savedCount: number = 0) {
  return replay ? "/(tabs)/settings" as const : savedCount > 0 ? "/(tabs)/saved" as const : sourceCount > 0 ? "/(tabs)" as const : "/(tabs)/sources" as const;
}
