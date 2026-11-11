import { PRODUCT_LIMITS } from "../constants/productConfig";
import { defaultTodaySourceRule, LIBRARY_ONLY_UNTIL } from "./today";
import type { TodaySourceRule } from "../models/today";

export function sourceParticipationLabel(mutedUntil: number | null | undefined, now: number) {
  if (mutedUntil === LIBRARY_ONLY_UNTIL) return "Library only";
  if (mutedUntil && mutedUntil > now) return `Snoozed until ${new Date(mutedUntil).toLocaleDateString()}`;
  return "Included in Today";
}

export function planSourceParticipation(profileId: string, sourceIds: readonly string[], rules: readonly TodaySourceRule[], selectedIds: readonly string[], include: boolean, now: number): TodaySourceRule[] {
  const byId = new Map(rules.filter((rule) => rule.profileId === profileId).map((rule) => [rule.sourceId, rule]));
  const selected = new Set(selectedIds);
  const ids = [...new Set(sourceIds)];
  const includedAfter = ids.filter((id) => selected.has(id) ? include : (byId.get(id)?.mutedUntil ?? 0) <= now).length;
  if (include && includedAfter > PRODUCT_LIMITS.sourceFeedMaxSources) throw new Error(`Today can include ${PRODUCT_LIMITS.sourceFeedMaxSources} sources. Move some to Library only first.`);
  return ids.filter((id) => selected.has(id) && (include ? (byId.get(id)?.mutedUntil ?? 0) > now : byId.get(id)?.mutedUntil !== LIBRARY_ONLY_UNTIL)).map((id) => ({
    ...(byId.get(id) ?? defaultTodaySourceRule(profileId, id)), mutedUntil: include ? null : LIBRARY_ONLY_UNTIL, updatedAt: now,
  }));
}
