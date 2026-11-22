import { PRODUCT_LIMITS, WEEKLY_DISCOVERY_DISPLAY_MAX } from "../constants/productConfig";
import { mapWeeklyPicksClientResult, selectWeeklyPickSuggestions, weeklyDiscoveryPeriodKey } from "./discovery";
import { readProfileStorage, writeProfileStorage, type KeyValueStorage } from "../storage/profileStorage";
import type { DiscoveryResult, InterestId, WeeklyPickSourceSuggestion } from "../types";
import type { WeeklyPicksClient } from "./weeklyPicksClient";

type IssuedEdition = {
  collecting?: boolean;
  policyVersion?: string;
  periodKey: string;
  interestIds: InterestId[];
  poolIds: string[];
  issuedIds: string[];
  dismissedIds: string[];
  pageIndex?: number;
  pages?: string[][];
};

export type WeeklyEditionResult = DiscoveryResult & {
  pool: WeeklyPickSourceSuggestion[];
  canShowMore: boolean;
  canShowPrevious?: boolean;
  nextRefreshDate: string;
};

export type WeeklyEditionService = {
  preview(interestIds: readonly InterestId[], profileId?: string): Promise<DiscoveryResult>;
  get(profileId: string, interestIds: readonly InterestId[], followedIds: readonly string[], now?: number): Promise<WeeklyEditionResult>;
  dismiss(profileId: string, sourceId: string, result: WeeklyEditionResult, followedIds: readonly string[]): Promise<WeeklyEditionResult>;
  showPrevious(profileId: string, result: WeeklyEditionResult, followedIds: readonly string[]): Promise<WeeklyEditionResult>;
  showMore(profileId: string, result: WeeklyEditionResult, followedIds: readonly string[]): Promise<WeeklyEditionResult>;
};

function validEdition(value: unknown): value is IssuedEdition {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<IssuedEdition>;
  return typeof record.periodKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.periodKey)
    && (record.collecting === undefined || typeof record.collecting === "boolean")
    && Array.isArray(record.interestIds) && record.interestIds.every((id) => typeof id === "string")
    && Array.isArray(record.poolIds) && record.poolIds.every((id) => typeof id === "string")
    && Array.isArray(record.issuedIds) && record.issuedIds.every((id) => typeof id === "string")
    && (record.pages === undefined || (Array.isArray(record.pages) && record.pages.every((page) => Array.isArray(page) && page.length <= WEEKLY_DISCOVERY_DISPLAY_MAX && page.every((id) => typeof id === "string"))))
    && (record.pageIndex === undefined || (Number.isInteger(record.pageIndex) && record.pageIndex >= 0))
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

function editionPages(edition: IssuedEdition): string[][] {
  return edition.pages ?? Array.from({ length: Math.max(1, Math.ceil(edition.issuedIds.length / WEEKLY_DISCOVERY_DISPLAY_MAX)) }, (_, index) => edition.issuedIds.slice(index * WEEKLY_DISCOVERY_DISPLAY_MAX, (index + 1) * WEEKLY_DISCOVERY_DISPLAY_MAX));
}

function display(edition: IssuedEdition, pool: WeeklyPickSourceSuggestion[], followedIds: readonly string[]): WeeklyEditionResult {
  const followed = new Set(followedIds);
  const dismissed = new Set(edition.dismissedIds);
  const issued = new Set(edition.issuedIds);
  const fixedPool = new Set(edition.poolIds);
  const byId = new Map(pool.map((item) => [item.providerSourceId, item]));
  const pages = editionPages(edition);
  const pageIndex = Math.max(0, Math.min(edition.pageIndex ?? 0, pages.length - 1));
  const items = (pages[pageIndex] ?? []).flatMap((id) => {
    const item = byId.get(id);
    return item && !followed.has(id) && !dismissed.has(id) ? [item] : [];
  }).slice(0, WEEKLY_DISCOVERY_DISPLAY_MAX);
  return {
    status: "success",
    items,
    pool,
    canShowPrevious: pageIndex > 0,
    canShowMore: pageIndex + 1 < pages.length || pool.some((item) => fixedPool.has(item.providerSourceId) && !issued.has(item.providerSourceId) && !dismissed.has(item.providerSourceId) && !followed.has(item.providerSourceId)),
    nextRefreshDate: new Date(Date.parse(`${edition.periodKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10),
  };
}

/** Keeps the public weekly pool shared while issuing and dismissing picks per profile locally. */
export function createWeeklyEditionService(client: WeeklyPicksClient, storage: KeyValueStorage): WeeklyEditionService {
  return {
    // Setup is provisional: changing interests must not issue or replace a weekly edition.
    async preview(interestIds, profileId) {
      if (!interestIds.length) return { status: "success", reason: "no_interests", items: [] };
      const fetched = await client.getWeeklyPicks([...new Set(interestIds)], profileId);
      const mapped = mapWeeklyPicksClientResult(fetched);
      if (fetched.status !== "success" || !["fresh", "cached"].includes(fetched.response.state)) return mapped;
      return { ...mapped, items: selectWeeklyPickSuggestions({ ...fetched.response, interests: fetched.response.interests.filter((group) => interestIds.includes(group.interestId)) }, PRODUCT_LIMITS.weeklyDiscoveryEditionMax) };
    },
    async get(profileId, interestIds, followedIds, now = Date.now()) {
      const periodKey = weeklyDiscoveryPeriodKey(now);
      const stored = await readEdition(storage, profileId);
      const edition = stored?.periodKey === periodKey && (stored.policyVersion === client.policyVersion || (stored.policyVersion !== undefined && client.compatiblePolicyVersions?.includes(stored.policyVersion))) ? stored : null;
      const selectedInterests = edition?.interestIds ?? [...new Set(interestIds)];
      const nextRefreshDate = new Date(Date.parse(`${periodKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
      if (selectedInterests.length === 0) return { status: "success", reason: "no_interests", items: [], pool: [], canShowMore: false, nextRefreshDate };
      const fetched = await client.getWeeklyPicks(selectedInterests, profileId);
      const mapped = mapWeeklyPicksClientResult(fetched);
      if (fetched.status !== "success" || (fetched.response.state !== "fresh" && fetched.response.state !== "cached")) {
        return { ...mapped, pool: [], canShowMore: false, nextRefreshDate };
      }
      const pool = selectWeeklyPickSuggestions(fetched.response, PRODUCT_LIMITS.weeklyDiscoveryEditionMax);
      let current = edition ?? {
        periodKey,
        collecting: client.isPreparing?.(profileId) ?? false,
        ...(client.policyVersion ? { policyVersion: client.policyVersion } : {}),
        interestIds: selectedInterests,
        poolIds: pool.map((item) => item.providerSourceId),
        issuedIds: pool.filter((item) => !followedIds.includes(item.providerSourceId)).slice(0, WEEKLY_DISCOVERY_DISPLAY_MAX).map((item) => item.providerSourceId),
        dismissedIds: [],
      };
      // A first page issued during preparation retains its order. Only its
      // unshown pool can grow until the original search settles.
      if (edition?.collecting) current = { ...edition, poolIds: [...new Set([...edition.poolIds, ...pool.map(item => item.providerSourceId)])], collecting: client.isPreparing?.(profileId) ?? false };
      if (!edition || edition.collecting) await writeEdition(storage, profileId, current);
      return { ...display(current, pool, followedIds), status: mapped.status, ...(mapped.message ? { message: mapped.message } : {}), nextRefreshDate };
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
      const pages = editionPages(edition);
      const pageIndex = Math.min(edition.pageIndex ?? 0, pages.length - 1) + 1;
      const next = result.pool.filter((item) => fixedPool.has(item.providerSourceId) && !issued.has(item.providerSourceId) && !excluded.has(item.providerSourceId)).slice(0, WEEKLY_DISCOVERY_DISPLAY_MAX);
      const needMore = pageIndex >= pages.length;
      const updated = { ...edition, pageIndex, pages: needMore ? [...pages, next.map((item) => item.providerSourceId)] : pages, issuedIds: needMore ? [...edition.issuedIds, ...next.map((item) => item.providerSourceId)] : edition.issuedIds };
      await writeEdition(storage, profileId, updated);
      return display(updated, result.pool, followedIds);
    },
    async showPrevious(profileId, result, followedIds) {
      const edition = await readEdition(storage, profileId);
      if (!edition || result.nextRefreshDate !== display(edition, result.pool, followedIds).nextRefreshDate) throw new Error("Weekly edition changed.");
      const updated = { ...edition, pageIndex: Math.max(0, (edition.pageIndex ?? 0) - 1) };
      await writeEdition(storage, profileId, updated);
      return display(updated, result.pool, followedIds);
    },
  };
}
