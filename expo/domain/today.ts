import { isMetadataCurrent } from "./metadataRetention";
import { isLongFormDuration } from "./videoLength";
import { MAX_ITEMS_PER_SOURCE, SHORT_FORM_MAX_SECONDS, TODAY_MAX_ITEMS, TODAY_RESET_HOUR } from "@/constants/productConfig";
import type { CachedTodayCandidate, TodayPeriod, TodaySnapshotItem, TodaySourceRule } from "@/models/today";

function pad(value: number): string { return String(value).padStart(2, "0"); }

/** Returns the stable local Today period using Frame's 4 a.m. reset boundary. */
export function getTodayPeriod(now: number): TodayPeriod {
  const current = new Date(now);
  const shifted = new Date(current.getFullYear(), current.getMonth(), current.getDate(), current.getHours() < TODAY_RESET_HOUR ? -1 : 0);
  const startsAt = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate(), TODAY_RESET_HOUR).getTime();
  const endsAt = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate() + 1, TODAY_RESET_HOUR).getTime();
  return { key: `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`, startsAt, endsAt };
}

export function defaultTodaySourceRule(profileId: string, sourceId: string): TodaySourceRule {
  return {
    profileId,
    sourceId,
    minimumDurationSeconds: SHORT_FORM_MAX_SECONDS + 1,
    hideLivestreams: true,
    hideUpcomingPremieres: true,
    todayContributionLimit: MAX_ITEMS_PER_SOURCE,
    mutedUntil: null,
    updatedAt: 0,
  };
}

export type TodaySelectionInput = {
  profileId: string;
  period: TodayPeriod;
  now: number;
  candidates: readonly CachedTodayCandidate[];
  followedSourceIds: ReadonlySet<string>;
  rules: ReadonlyMap<string, TodaySourceRule>;
  savedMediaIds: ReadonlySet<string>;
  sessionMediaIds: ReadonlySet<string>;
  resumeMediaIds: ReadonlySet<string>;
  history: readonly TodaySnapshotItem[];
};

/** Builds one deterministic finite membership; overdue snoozes reserve space before new media. */
export function selectTodayItems(input: TodaySelectionInput): TodaySnapshotItem[] {
  const latestHistory = latestHistoryByMedia(input.history);
  const sourceCounts = new Map<string, number>();
  const selected: TodaySnapshotItem[] = [];
  const dueSnoozes = [...latestHistory.values()]
    .filter((item) => item.disposition === "snoozed" && item.snoozedUntil !== null && item.snoozedUntil < input.period.endsAt)
    .filter((item) => isSourceEligible(item, input))
    .sort((left, right) => (left.snoozedUntil ?? 0) - (right.snoozedUntil ?? 0) || left.id.localeCompare(right.id));
  const snoozeReservation = Math.min(TODAY_MAX_ITEMS, dueSnoozes.length);

  for (const item of dueSnoozes) {
    if (selected.length >= TODAY_MAX_ITEMS) break;
    if (!canSourceContribute(item.sourceId, input, sourceCounts)) continue;
    addSelected(selected, sourceCounts, {
      ...item,
      profileId: input.profileId,
      periodKey: input.period.key,
      position: selected.length,
      disposition: "snoozed",
      dispositionAt: item.dispositionAt,
    });
  }

  const blockedIds = new Set<string>();
  for (const item of latestHistory.values()) {
    if (["saved", "session", "watched", "dismissed", "unavailable", "snoozed"].includes(item.disposition)) blockedIds.add(item.id);
  }
  for (const id of input.savedMediaIds) blockedIds.add(id);
  for (const id of input.sessionMediaIds) blockedIds.add(id);
  for (const id of input.resumeMediaIds) blockedIds.add(id);
  for (const item of selected) blockedIds.add(item.id);

  const normalLimit = Math.max(0, TODAY_MAX_ITEMS - snoozeReservation);
  const normalSelected: CachedTodayCandidate[] = [];
  const seen = new Set<string>();
  const sortedCandidates = [...input.candidates].sort((left, right) => {
    const published = Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
    return (Number.isFinite(published) && published !== 0) ? published : left.id.localeCompare(right.id);
  });
  for (const candidate of sortedCandidates) {
    if (normalSelected.length >= normalLimit || selected.length + normalSelected.length >= TODAY_MAX_ITEMS) break;
    if (seen.has(candidate.id) || blockedIds.has(candidate.id) || !isSourceEligible(candidate, input)) continue;
    seen.add(candidate.id);
    if (!canSourceContribute(candidate.sourceId, input, sourceCounts)) continue;
    sourceCounts.set(candidate.sourceId, (sourceCounts.get(candidate.sourceId) ?? 0) + 1);
    normalSelected.push(candidate);
  }

  for (const candidate of normalSelected) {
    selected.push({
      ...candidate,
      profileId: input.profileId,
      periodKey: input.period.key,
      position: selected.length,
      disposition: "pending",
      dispositionAt: null,
      snoozedUntil: null,
    });
  }
  return selected;
}

export function visibleTodayItems(items: readonly TodaySnapshotItem[], followedSourceIds: ReadonlySet<string>, rules: ReadonlyMap<string, TodaySourceRule>, now: number): TodaySnapshotItem[] {
  return items.filter((item) => {
    if (!isLongFormDuration(item.durationSeconds) || !isMetadataCurrent(item.fetchedAt, now) || !followedSourceIds.has(item.sourceId) || item.disposition === "unavailable") return false;
    const rule = rules.get(item.sourceId) ?? defaultTodaySourceRule(item.profileId, item.sourceId);
    if (rule.mutedUntil !== null && rule.mutedUntil > now) return false;
    if (item.disposition === "pending") return true;
    return item.disposition === "snoozed" && item.snoozedUntil !== null && item.snoozedUntil <= now;
  });
}

export function nextSnoozedReturn(items: readonly TodaySnapshotItem[], now: number): number | null {
  const future = items.flatMap((item) => isLongFormDuration(item.durationSeconds) && isMetadataCurrent(item.fetchedAt, now) && item.disposition === "snoozed" && item.snoozedUntil !== null && item.snoozedUntil > now ? [item.snoozedUntil] : []);
  return future.length > 0 ? Math.min(...future) : null;
}

export function tomorrowSnoozeTime(now: number): number {
  return getTodayPeriod(now).endsAt + 5 * 60 * 60 * 1_000;
}

/** Marks an item handled only after its authoritative feature action succeeds. */
export async function performTodayAction(action: () => Promise<boolean>, markHandled: () => Promise<boolean>): Promise<boolean> {
  if (!await action()) return false;
  return markHandled();
}

function latestHistoryByMedia(history: readonly TodaySnapshotItem[]): Map<string, TodaySnapshotItem> {
  const latest = new Map<string, TodaySnapshotItem>();
  for (const item of history) {
    const existing = latest.get(item.id);
    const itemTime = item.dispositionAt ?? 0;
    const existingTime = existing?.dispositionAt ?? 0;
    if (!existing || itemTime > existingTime || (itemTime === existingTime && item.periodKey > existing.periodKey)) latest.set(item.id, item);
  }
  return latest;
}

function isSourceEligible(item: CachedTodayCandidate, input: TodaySelectionInput): boolean {
  if (!isLongFormDuration(item.durationSeconds)) return false;
  if (!isMetadataCurrent(item.fetchedAt, input.now) || !input.followedSourceIds.has(item.sourceId)) return false;
  const rule = input.rules.get(item.sourceId) ?? defaultTodaySourceRule(input.profileId, item.sourceId);
  if (rule.mutedUntil !== null && rule.mutedUntil > input.now) return false;
  if (item.durationSeconds < rule.minimumDurationSeconds) return false;
  if (rule.hideLivestreams && item.isLivestream) return false;
  if (rule.hideUpcomingPremieres && item.isUpcomingPremiere) return false;
  return Boolean(item.title.trim() && item.thumbnailUrl && item.publishedAt && item.durationSeconds >= 0);
}

function canSourceContribute(sourceId: string, input: TodaySelectionInput, counts: ReadonlyMap<string, number>): boolean {
  const rule = input.rules.get(sourceId) ?? defaultTodaySourceRule(input.profileId, sourceId);
  return (counts.get(sourceId) ?? 0) < Math.min(MAX_ITEMS_PER_SOURCE, rule.todayContributionLimit);
}

function addSelected(selected: TodaySnapshotItem[], counts: Map<string, number>, item: TodaySnapshotItem): void {
  selected.push(item);
  counts.set(item.sourceId, (counts.get(item.sourceId) ?? 0) + 1);
}
