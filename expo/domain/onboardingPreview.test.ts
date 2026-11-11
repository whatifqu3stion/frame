import { expect, test } from "bun:test";
import { featureFirstPick, onboardingPreviewPage, onboardingPreviewStatus } from "./onboardingPreview";
import type { DiscoveryResult, WeeklyPickSourceSuggestion } from "../types";

const pool: WeeklyPickSourceSuggestion[] = Array.from({ length: 7 }, (_, index) => ({
  provider: "youtube", providerSourceId: `source-${index}`, handle: null, displayName: `Source ${index}`, description: "", thumbnailUrl: null, recommendationReason: null, interestId: "science", publicationPeriod: { start: "2026-09-28", end: "2026-10-04" },
}));
const state = (result?: DiscoveryResult, extras = {}) => onboardingPreviewStatus({ enabled: true, loading: false, failed: false, result, ...extras });

test("featuring a reviewed video from a later batch preserves every other pick in publication order", () => {
  const pick: WeeklyPickSourceSuggestion = {
    ...pool[4], fetchedAt: 1, recommendationReason: "Explores the forest canopy.",
    featuredMedia: { provider: "youtube", providerMediaId: "forest", title: "Forest layers", description: "", thumbnailUrl: null, durationSeconds: 600, publishedAt: "2026-09-28", isLivestream: false, isUpcomingPremiere: false },
  };
  const ordered = featureFirstPick([...pool.slice(0, 4), pick, ...pool.slice(5)]);
  expect(ordered.map((item) => item.providerSourceId)).toEqual([4, 0, 1, 2, 3, 5, 6].map((i) => pool[i].providerSourceId));
  expect(featureFirstPick(pool)).toEqual(pool);
});

test("disabled, loading, failed, and unpublished previews stay distinct", () => {
  expect(state(undefined, { enabled: false, loading: true })).toMatchObject({ kind: "unavailable", retry: false });
  expect(state(undefined, { loading: true }).kind).toBe("loading");
  expect(state(undefined)).toMatchObject({ kind: "unavailable", retry: true });
  expect(state({ status: "success", items: [] })).toMatchObject({ kind: "empty", retry: false });
  expect(state({ status: "success", items: pool }, { failed: true }).kind).toBe("unavailable");
});

test("configuration, offline, and maintenance offer their actual recovery", () => {
  const configuration = state({ status: "backend_allowance_unavailable", items: [], reason: "configuration" });
  expect(configuration.retry).toBe(false);
  expect(configuration.message).toContain("Prepare");
  const offline = state({ status: "network_error", items: [], reason: "offline" });
  expect(offline.retry).toBe(true);
  expect(offline.message).toContain("connection");
  const maintenance = state({ status: "temporarily_unavailable", items: [], reason: "maintenance" });
  expect(maintenance.retry).toBe(true);
  expect(maintenance.message).toContain("paused");
  expect(state({ status: "cached_success", items: pool }).message).toContain("saved weekly edition");
  expect(state({ status: "success", items: pool }).message).toBe("");
});

test("following removes a pick without silently backfilling; next skips followed batches", () => {
  const followed = ["source-1", "source-3", "source-4", "source-5"];
  const first = onboardingPreviewPage(pool, followed, 0);
  expect(first.items.map((pick) => pick.providerSourceId)).toEqual(["source-0", "source-2"]);
  expect(first.nextPage).toBe(2);
  expect(first.previousPage).toBeNull();
  const last = onboardingPreviewPage(pool, followed, first.nextPage!);
  expect(last.items.map((pick) => pick.providerSourceId)).toEqual(["source-6"]);
  expect(last.nextPage).toBeNull();
  expect(last.previousPage).toBe(0);
  expect(last.exhausted).toBe(false);
});

test("an empty batch is distinct from an exhausted or unpublished pool", () => {
  const followed = pool.slice(0, 3).map((pick) => pick.providerSourceId);
  const batch = onboardingPreviewPage(pool, followed, 0);
  expect(batch.items).toEqual([]);
  expect(batch.nextPage).toBe(1);
  expect(batch.exhausted).toBe(false);
  expect(onboardingPreviewPage(pool, pool.map((pick) => pick.providerSourceId), 0).exhausted).toBe(true);
  expect(onboardingPreviewPage([], [], 0).exhausted).toBe(false);
});

test("a shorter retry response clamps old pagination and preserves real source data", () => {
  const result = onboardingPreviewPage(pool.slice(0, 2), [], 9);
  expect(result.page).toBe(0);
  expect(result.items).toEqual(pool.slice(0, 2));
  expect(result.items.every((pick) => !pick.featuredMedia)).toBe(true);
  expect(onboardingPreviewPage(pool, [], NaN).page).toBe(0);
});
