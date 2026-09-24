import { WEEKLY_DISCOVERY_DISPLAY_MAX } from "../constants/productConfig";
import { mapWeeklyPicksClientResult, selectWeeklyPickSuggestions, weeklyDiscoveryPeriodKey } from "./discovery";
import { readProfileStorage, writeProfileStorage, type KeyValueStorage } from "../storage/profileStorage";
import type { DiscoveryResult, InterestId, WeeklyPickSourceSuggestion } from "../types";
import type { WeeklyPicksClient } from "./weeklyPicksClient";

type IssuedEdition = {
  periodKey: string;
  interestIds: InterestId[];
  poolIds: string[];
  issuedIds: string[];
  dismissedIds: string[];
};

export type WeeklyEditionResult = DiscoveryResult & {
  pool: WeeklyPickSourceSuggestion[];
  canShowMore: boolean;
  nextRefreshDate: string;
};

export type WeeklyEditionService = {
  get(profileId: string, interestIds: readonly InterestId[], followedIds: readonly string[], now?: number): Promise<WeeklyEditionResult>;
  dismiss(profileId: string, sourceId: string, result: WeeklyEditionResult, followedIds: readonly string[]): Promise<WeeklyEditionResult>;
  showMore(profileId: string, result: WeeklyEditionResult, followedIds: readonly string[]): Promise<WeeklyEditionResult>;
};

function validEdition(value: unknown): value is IssuedEdition {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<IssuedEdition>;
  return typeof record.periodKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.periodKey)
    && Array.isArray(record.interestIds) && record.interestIds.every((id) => typeof id === "string")
    && Array.isArray(record.poolIds) && record.poolIds.every((id) => typeof id === "string")
    && Array.isArray(record.issuedIds) && record.issuedIds.every((id) => typeof id === "string")
    && Array.isArray(record.dismissedIds) && record.dismissedIds.every((id) => typeof id === "string");
}

async function readEdition(storage: KeyValueStorage, profileId: string): Promise<IssuedEdition | null> {
  const raw = await readProfileStorage(storage, "weeklyPicks", profileId);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validEdition(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeEdition(storage: KeyValueStorage, profileId: string, edition: IssuedEdition): Promise<void> {
  await writeProfileStorage(storage, "weeklyPicks", profileId, JSON.stringify(edition));
}

function display(edition: IssuedEdition, pool: WeeklyPickSourceSuggestion[], followedIds: readonly string[]): WeeklyEditionResult {
  const followed = new Set(followedIds);
  const dismissed = new Set(edition.dismissedIds);
  const issued = new Set(edition.issuedIds);
  const fixedPool = new Set(edition.poolIds);
  const byId = new Map(pool.map((item) => [item.providerSourceId, item]));
  const items = edition.issuedIds.flatMap((id) => {
    const item = byId.get(id);
    return item && !followed.has(id) && !dismissed.has(id) ? [item] : [];
  }).slice(0, WEEKLY_DISCOVERY_DISPLAY_MAX);
  return {
    status: "success",
    items,
    pool,
    canShowMore: items.length < WEEKLY_DISCOVERY_DISPLAY_MAX && pool.some((item) => fixedPool.has(item.providerSourceId) && !issued.has(item.providerSourceId) && !dismissed.has(item.providerSourceId) && !followed.has(item.providerSourceId)),
    nextRefreshDate: new Date(Date.parse(`${edition.periodKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10),
  };
}

/** Keeps the public weekly pool shared while issuing and dismissing picks per profile locally. */
export function createWeeklyEditionService(client: WeeklyPicksClient, storage: KeyValueStorage): WeeklyEditionService {
  return {
    async get(profileId, interestIds, followedIds, now = Date.now()) {
      const periodKey = weeklyDiscoveryPeriodKey(now);
      const stored = await readEdition(storage, profileId);
      const edition = stored?.periodKey === periodKey ? stored : null;
      const selectedInterests = edition?.interestIds ?? [...new Set(interestIds)];
      const nextRefreshDate = new Date(Date.parse(`${periodKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
      if (selectedInterests.length === 0) return { status: "success", reason: "no_interests", items: [], pool: [], canShowMore: false, nextRefreshDate };
      const fetched = await client.getWeeklyPicks(selectedInterests);
      const mapped = mapWeeklyPicksClientResult(fetched);
      if (fetched.status !== "success" || (fetched.response.state !== "fresh" && fetched.response.state !== "cached")) {
        return { ...mapped, pool: [], canShowMore: false, nextRefreshDate };
      }
      const pool = selectWeeklyPickSuggestions(fetched.response, 45);
      const current = edition ?? {
        periodKey,
        interestIds: selectedInterests,
        poolIds: pool.map((item) => item.providerSourceId),
        issuedIds: pool.filter((item) => !followedIds.includes(item.providerSourceId)).slice(0, WEEKLY_DISCOVERY_DISPLAY_MAX).map((item) => item.providerSourceId),
        dismissedIds: [],
      };
      if (!edition) await writeEdition(storage, profileId, current);
      return { ...display(current, pool, followedIds), status: mapped.status, nextRefreshDate };
    },
    async dismiss(profileId, sourceId, result, followedIds) {
      const edition = await readEdition(storage, profileId);
      if (!edition || !edition.issuedIds.includes(sourceId)) throw new Error("Pick is not in this profile's edition.");
      if (result.nextRefreshDate !== display(edition, result.pool, followedIds).nextRefreshDate) throw new Error("Weekly edition changed.");
      if (edition.dismissedIds.includes(sourceId)) return display(edition, result.pool, followedIds);
      const updated = { ...edition, dismissedIds: [...edition.dismissedIds, sourceId] };
      await writeEdition(storage, profileId, updated);
      return display(updated, result.pool, followedIds);
    },
    async showMore(profileId, result, followedIds) {
      const edition = await readEdition(storage, profileId);
      if (!edition || result.nextRefreshDate !== display(edition, result.pool, followedIds).nextRefreshDate) throw new Error("Weekly edition changed.");
      const shown = display(edition, result.pool, followedIds);
      if (!shown.canShowMore) return shown;
      const issued = new Set(edition.issuedIds);
      const fixedPool = new Set(edition.poolIds);
      const excluded = new Set([...edition.dismissedIds, ...followedIds]);
      const next = result.pool.find((item) => fixedPool.has(item.providerSourceId) && !issued.has(item.providerSourceId) && !excluded.has(item.providerSourceId));
      if (!next) return shown;
      const updated = { ...edition, issuedIds: [...edition.issuedIds, next.providerSourceId] };
      await writeEdition(storage, profileId, updated);
      return display(updated, result.pool, followedIds);
    },
  };
}
