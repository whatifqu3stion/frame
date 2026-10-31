import { describe, expect, test } from "bun:test";
import { createWeeklyEditionService } from "./weeklyEdition";
import { clearProfileStorage, type KeyValueStorage } from "../storage/profileStorage";
import type { WeeklyPicksClient, WeeklyPicksResponse } from "./weeklyPicksClient";

const monday = Date.parse("2026-09-28T10:00:00.000Z");
class MemoryStorage implements KeyValueStorage {
  values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
}

function response(): WeeklyPicksResponse {
  return {
    state: "fresh",
    interests: ["tech", "science"].map((interestId) => ({
      interestId: interestId as "tech" | "science",
      publicationPeriod: { start: "2026-09-28", end: "2026-10-04" },
      picks: [1, 2, 3].map((order) => ({
        order,
        reason: null,
        source: { provider: "youtube", providerSourceId: `${interestId}-${order}`, handle: null, displayName: `${interestId} ${order}`, description: "", thumbnailUrl: null },
      })),
    })),
  };
}

describe("profile-local Weekly Picks edition", () => {
  test("issues a stable finite edition, dismisses without backfill, and reveals only the fixed pool", async () => {
    const storage = new MemoryStorage();
    const requests: string[][] = [];
    const client: WeeklyPicksClient = { async getWeeklyPicks(ids) { requests.push([...ids]); return { status: "success", response: response() }; } };
    const service = createWeeklyEditionService(client, storage);
    const first = await service.get("owner", ["tech", "science"], [], monday);
    expect(first.items.map((item) => item.providerSourceId)).toEqual(["tech-1", "science-1", "tech-2"]);
    expect(first.nextRefreshDate).toBe("2026-10-05");
    expect(first.canShowMore).toBe(true);

    const dismissed = await service.dismiss("owner", "science-1", first, []);
    expect(dismissed.items.map((item) => item.providerSourceId)).toEqual(["tech-1", "tech-2"]);
    expect(dismissed.canShowMore).toBe(true);
    const more = await service.showMore("owner", dismissed, []);
    expect(more.items.map((item) => item.providerSourceId)).toEqual(["science-2", "tech-3", "science-3"]);
    expect(requests).toHaveLength(1);

    const reopened = await createWeeklyEditionService(client, storage).get("owner", ["science"], [], monday + 86_400_000);
    expect(reopened.items.map((item) => item.providerSourceId)).toEqual(more.items.map((item) => item.providerSourceId));
    expect(requests[1]).toEqual(["tech", "science"]);
    const followed = await service.get("owner", ["science"], ["tech-1"], monday + 86_400_000);
    expect(followed.items.map((item) => item.providerSourceId)).toEqual(["science-2", "tech-3", "science-3"]);
    const previous = await service.showPrevious("owner", followed, ["tech-1"]);
    expect(previous.items.map((item) => item.providerSourceId)).toEqual(["tech-2"]);
    await service.showMore("owner", previous, []);
    const clearedInterests = await service.get("owner", [], [], monday + 86_400_000);
    expect(clearedInterests.items.map((item) => item.providerSourceId)).toEqual(more.items.map((item) => item.providerSourceId));
    expect(requests.at(-1)).toEqual(["tech", "science"]);
    const nextWeek = await service.get("owner", ["science"], [], monday + 7 * 86_400_000);
    expect(nextWeek.items[0].providerSourceId).toBe("tech-1");
    expect(requests.at(-1)).toEqual(["science"]);
  });

  test("isolates profiles and erases the edition with profile reset", async () => {
    const storage = new MemoryStorage();
    const service = createWeeklyEditionService({ async getWeeklyPicks() { return { status: "success", response: response() }; } }, storage);
    const owner = await service.get("owner", ["tech"], [], monday);
    await service.dismiss("owner", owner.items[0].providerSourceId, owner, []);
    const standard = await service.get("standard", ["science"], [], monday);
    expect(standard.items[0].providerSourceId).toBe("tech-1");
    await clearProfileStorage(storage, "owner");
    const resetOwner = await service.get("owner", ["science"], [], monday);
    expect(resetOwner.items[0].providerSourceId).toBe("tech-1");
  });

  test("never substitutes new candidates when a published source disappears", async () => {
    const storage = new MemoryStorage();
    let published = response();
    const service = createWeeklyEditionService({ async getWeeklyPicks() { return { status: "success", response: published }; } }, storage);
    const first = await service.get("owner", ["tech"], [], monday);
    published = { ...published, interests: published.interests.map((interest) => ({ ...interest, picks: interest.picks.filter((pick) => pick.source.providerSourceId !== first.items[0].providerSourceId) })) };
    const refreshed = await service.get("owner", ["tech"], [], monday);
    expect(refreshed.items.some((item) => item.providerSourceId === first.items[0].providerSourceId)).toBe(false);
    expect(refreshed.items).toHaveLength(2);
  });

  test("More like this cannot draw a new source from a midweek replacement pool", async () => {
    const storage = new MemoryStorage();
    let published = response();
    const service = createWeeklyEditionService({ async getWeeklyPicks() { return { status: "success", response: published }; } }, storage);
    const first = await service.get("owner", ["tech", "science"], [], monday);
    published = { ...published, interests: published.interests.map((interest) => ({
      ...interest,
      picks: interest.picks.map((pick) => pick.source.providerSourceId === "science-2"
        ? { ...pick, source: { ...pick.source, providerSourceId: "replacement" } }
        : pick),
    })) };
    const updated = await service.get("owner", ["tech", "science"], [], monday);
    const dismissed = await service.dismiss("owner", first.items[0].providerSourceId, updated, []);
    const more = await service.showMore("owner", dismissed, []);
    expect(more.items.map((item) => item.providerSourceId)).not.toContain("replacement");
  });
});


describe("provisional onboarding preview", () => {
  test("uses current interests without issuing or replacing the profile’s weekly edition", async () => {
    const storage = new MemoryStorage();
    const requested: string[][] = [];
    const service = createWeeklyEditionService({ async getWeeklyPicks(ids) { requested.push([...ids]); return { status: "success", response: response() }; } }, storage);
    const tech = await service.preview(["tech"]);
    expect(tech.items.every((pick) => pick.interestId === "tech")).toBe(true);
    expect(tech.items).toHaveLength(3);
    expect(storage.values.size).toBe(0);
    await service.get("owner", ["tech"], [], monday);
    const original = [...storage.values.entries()];
    const science = await service.preview(["science"]);
    expect(requested.at(-1)).toEqual(["science"]);
    expect(science.items.every((pick) => pick.interestId === "science")).toBe(true);
    expect([...storage.values.entries()]).toEqual(original);
    await service.get("owner", ["science"], [], monday);
    expect(requested.at(-1)).toEqual(["tech"]);
  });
  test("separates an empty publication from offline and paused service states", async () => {
    const storage = new MemoryStorage();
    const offline = createWeeklyEditionService({ async getWeeklyPicks() { return { status: "network_error" }; } }, storage);
    expect((await offline.preview(["tech"])).reason).toBe("offline");
    expect((await offline.preview([])).reason).toBe("no_interests");
    for (const state of ["empty", "maintenance"] as const) {
      const service = createWeeklyEditionService({ async getWeeklyPicks() { return { status: "success", response: { state, interests: [] } }; } }, storage);
      const preview = await service.preview(["tech"]);
      expect(preview.items).toEqual([]);
      expect(preview.reason).toBe(state);
    }
    expect(storage.values.size).toBe(0);
  });
});

test("a new discovery policy replaces a legacy pool without carrying unreviewed source IDs forward", async () => {
  const storage = new MemoryStorage();
  const oldClient: WeeklyPicksClient = { async getWeeklyPicks() { return { status: "success", response: response() }; } };
  await createWeeklyEditionService(oldClient, storage).get("owner", ["tech"], [], monday);
  const upgraded: WeeklyPicksClient = { policyVersion: "nourishing-v1", async getWeeklyPicks() { const reviewed = response(); reviewed.interests = reviewed.interests.map((group) => ({ ...group, picks: group.picks.map((pick) => ({ ...pick, source: { ...pick.source, providerSourceId: `${pick.source.providerSourceId}-reviewed` } })) })); return { status: "success", response: reviewed }; } };
  const result = await createWeeklyEditionService(upgraded, storage).get("owner", ["science"], [], monday);
  expect(result.items.length).toBeGreaterThan(0);
  expect(result.items.every((item) => item.providerSourceId.endsWith("-reviewed"))).toBeTrue();
});

test("twelve weekly picks are paged in threes, persist position, and retain dismissals across a compatible upgrade", async () => {
  const storage = new MemoryStorage();
  const expanded = response();
  expanded.interests[0].picks = Array.from({ length: 12 }, (_, index) => ({ ...expanded.interests[0].picks[0], order: index + 1, source: { ...expanded.interests[0].picks[0].source, providerSourceId: `source-${index}` } }));
  expanded.interests = [expanded.interests[0]];
  const client: WeeklyPicksClient = { policyVersion: "v1", async getWeeklyPicks() { return { status: "success", response: expanded }; } };
  let service = createWeeklyEditionService(client, storage);
  let page = await service.get("owner", ["tech"], [], monday);
  const all = page.items.map((item) => item.providerSourceId);
  for (let index = 1; index < 4; index++) {
    page = await service.showMore("owner", page, []);
    expect(page.items).toHaveLength(3);
    all.push(...page.items.map((item) => item.providerSourceId));
  }
  expect(new Set(all).size).toBe(12);
  expect(page.canShowMore).toBeFalse();
  page = await service.dismiss("owner", page.items[0].providerSourceId, page, []);
  service = createWeeklyEditionService({ ...client, policyVersion: "v2", compatiblePolicyVersions: ["v1"] }, storage);
  const reopened = await service.get("owner", ["science"], [], monday);
  expect(reopened.items.map((item) => item.providerSourceId)).toEqual(page.items.map((item) => item.providerSourceId));
  expect((await service.showPrevious("owner", reopened, [])).items.map((item) => item.providerSourceId)).toEqual(all.slice(6, 9));
});

test("a short first page does not skip a source when another page becomes available", async () => {
  const storage = new MemoryStorage();
  const service = createWeeklyEditionService({ async getWeeklyPicks() { return { status: "success", response: response() }; } }, storage);
  const first = await service.get("owner", ["tech"], ["tech-2", "tech-3", "science-2", "science-3"], monday);
  expect(first.items).toHaveLength(2);
  const next = await service.showMore("owner", first, []);
  expect(next.items.map((item) => item.providerSourceId)).toEqual(["tech-2", "science-2", "tech-3"]);
  expect((await service.showPrevious("owner", next, [])).items.map((item) => item.providerSourceId)).toEqual(["tech-1", "science-1"]);
});
