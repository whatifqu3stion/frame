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
    expect(first.canShowMore).toBe(false);

    const dismissed = await service.dismiss("owner", "science-1", first, []);
    expect(dismissed.items.map((item) => item.providerSourceId)).toEqual(["tech-1", "tech-2"]);
    expect(dismissed.canShowMore).toBe(true);
    const more = await service.showMore("owner", dismissed, []);
    expect(more.items.map((item) => item.providerSourceId)).toEqual(["tech-1", "tech-2", "science-2"]);
    expect(requests).toHaveLength(1);

    const reopened = await createWeeklyEditionService(client, storage).get("owner", ["science"], [], monday + 86_400_000);
    expect(reopened.items.map((item) => item.providerSourceId)).toEqual(more.items.map((item) => item.providerSourceId));
    expect(requests[1]).toEqual(["tech", "science"]);
    const followed = await service.get("owner", ["science"], ["tech-1"], monday + 86_400_000);
    expect(followed.items.map((item) => item.providerSourceId)).toEqual(["tech-2", "science-2"]);
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
