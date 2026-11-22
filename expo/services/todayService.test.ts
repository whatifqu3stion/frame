import { describe, expect, test } from "bun:test";
import { getTodayPeriod } from "../domain/today";
import type { CachedTodayCandidate, TodayDisposition, TodaySnapshot, TodaySnapshotItem, TodaySourceRule } from "../models/today";
import type { TodayRepository } from "../repositories/todayRepository";
import type { Video } from "../types";
import { createTodayService, type TodayFeedReader } from "./todayService";

const now = new Date(2026, 8, 6, 12).getTime();
const sourceId = "UCabcdefghijklmnopqrstuv";
function candidate(id: string = "video000001"): CachedTodayCandidate { return { id, title: id, channelId: sourceId, channelTitle: "Source", sourceId, sourceTitle: "Source", thumbnailUrl: "https://example.com/thumb.jpg", publishedAt: new Date(now).toISOString(), durationSeconds: 600, description: "", madeForKids: false, isLivestream: false, isUpcomingPremiere: false, fetchedAt: now }; }
function successReader(items: CachedTodayCandidate[] = [candidate()]): TodayFeedReader {
  return { getCachedFeeds: async () => ({ status: "success", candidates: items, response: { state: items.length ? "fresh" : "empty", freshness: "fresh", feeds: [{ source: { provider: "youtube", providerSourceId: sourceId, handle: null, displayName: "Source", thumbnailUrl: null }, freshness: items.length ? "fresh" : "empty", items: items.map((item) => ({ provider: "youtube", providerMediaId: item.id, title: item.title, description: item.description ?? "", thumbnailUrl: item.thumbnailUrl, publishedAt: item.publishedAt, durationSeconds: item.durationSeconds, isLivestream: item.isLivestream, isUpcomingPremiere: item.isUpcomingPremiere, madeForKids: item.madeForKids ?? null, fetchedAt: new Date(item.fetchedAt).toISOString() })) }], unavailableSourceIds: [], fetchedAt: items.length ? new Date(now).toISOString() : null } }) };
}
class MemoryTodayRepository implements TodayRepository {
  snapshots = new Map<string, TodaySnapshot>();
  finalizations = 0;
  history: TodaySnapshotItem[] = [];
  readSnapshot(profileId: string, periodKey: string) { return Promise.resolve(this.snapshots.get(`${profileId}:${periodKey}`) ?? null); }
  finalizeSnapshot(snapshot: TodaySnapshot) { this.finalizations += 1; const key = `${snapshot.profileId}:${snapshot.periodKey}`; const saved = this.snapshots.get(key) ?? snapshot; this.snapshots.set(key, saved); return Promise.resolve(saved); }
  listHistory(profileId: string) { return Promise.resolve(this.history.filter((item) => item.profileId === profileId)); }
  listRules(_profileId: string): Promise<TodaySourceRule[]> { return Promise.resolve([]); }
  listHandledLibraryIds() { return Promise.resolve({ saved: new Set<string>(), sessions: new Set<string>(), resume: new Set<string>() }); }
  setDisposition(_profileId: string, _periodKey: string, _mediaId: string, _disposition: TodayDisposition, _dispositionAt: number) { return Promise.resolve(true); }
  refreshMetadata(profileId: string, periodKey: string, candidates: readonly CachedTodayCandidate[], _unavailable: ReadonlySet<string>, freshness: "fresh" | "stale", cacheFetchedAt: number | null) { const key = `${profileId}:${periodKey}`; const current = this.snapshots.get(key); if (current) this.snapshots.set(key, { ...current, freshness, cacheFetchedAt, items: current.items.map((item) => ({ ...item, ...(candidates.find((candidateItem) => candidateItem.id === item.id) ?? {}) })) }); return Promise.resolve(); }
  getVideo(_profileId: string, _mediaId: string): Promise<Video | null> { return Promise.resolve(null); }
}

describe("Today snapshot service", () => {
  test("failed requests never finalize an empty snapshot", async () => {
    const repository = new MemoryTodayRepository();
    const service = createTodayService(repository, { getCachedFeeds: async () => ({ status: "network_error" }) });
    const result = await service.load({ profileId: "owner", followedSourceIds: [sourceId], now });
    expect(result.state).toBe("network_error");
    expect(result.snapshot).toBeNull();
    expect(repository.finalizations).toBe(0);
  });

  test("preserves the provider failure when the first selection has no local snapshot", async () => {
    const message = "YouTube (HTTP 403): Your provider quota or rate limit was reached.";
    const service = createTodayService(new MemoryTodayRepository(), { getCachedFeeds: async () => ({ status: "http_unavailable", message }) });
    expect(await service.load({ profileId: "owner", followedSourceIds: [sourceId], now })).toMatchObject({ state: "unavailable", snapshot: null, message });
  });

  test("first live selection accepts videos fetched after loading started and excludes future timestamps", async () => {
    const arrivedAt = now + 700;
    let clock = now;
    const reader = successReader([{ ...candidate(), fetchedAt: arrivedAt }, { ...candidate("video000002"), fetchedAt: arrivedAt + 1000 }]);
    const service = createTodayService(new MemoryTodayRepository(), {
      async getCachedFeeds(ids) { clock = arrivedAt; return reader.getCachedFeeds(ids); },
    }, () => clock);
    const result = await service.load({ profileId: "owner", followedSourceIds: [sourceId] });
    expect(result.snapshot?.items.map((item) => item.id)).toEqual(["video000001"]);
  });

  test("no-source setup stays unfinalized and the first source generates immediately", async () => {
    const repository = new MemoryTodayRepository();
    const service = createTodayService(repository, successReader());
    expect((await service.load({ profileId: "owner", followedSourceIds: [], now })).state).toBe("no_sources");
    expect(repository.finalizations).toBe(0);
    const generated = await service.load({ profileId: "owner", followedSourceIds: [sourceId], now });
    expect(generated.snapshot?.items.map((item) => item.id)).toEqual(["video000001"]);
    expect(repository.finalizations).toBe(1);
  });

  test("a first empty read stays open until an imported source has a matching upload", async () => {
    const repository = new MemoryTodayRepository();
    const imported = "UCzyxwvutsrqponmlkjihgfe";
    const weekOld = { ...candidate(), sourceId: imported, channelId: imported, publishedAt: new Date(now - 7 * 86_400_000).toISOString() };
    const service = createTodayService(repository, successReader([weekOld]));
    const load = (sources: string[]) => service.load({ profileId: "owner", followedSourceIds: sources, now });
    expect(await load([sourceId])).toMatchObject({ state: "empty", snapshot: null });
    expect(repository.finalizations).toBe(0);
    expect((await load([sourceId, imported])).snapshot?.items.map((item) => item.id)).toEqual([weekOld.id]);
    expect(repository.finalizations).toBe(1);
  });

  test("checking again can populate the same sources after an empty cached feed", async () => {
    const repository = new MemoryTodayRepository();
    const service = createTodayService(repository, {
      getCachedFeeds: (ids, refresh) => successReader(refresh ? [candidate()] : []).getCachedFeeds(ids),
    });
    const options = { profileId: "owner", followedSourceIds: [sourceId], now };
    expect((await service.load(options)).snapshot).toBeNull();
    const retried = await service.load({ ...options, refreshExisting: true });
    expect(retried.snapshot?.items.map((item) => item.id)).toEqual(["video000001"]);
    expect((await service.load(options)).snapshot).toEqual(retried.snapshot);
    expect(repository.finalizations).toBe(1);
  });

  test("a profile with a previous selection can still finalize a quiet day", async () => {
    const repository = new MemoryTodayRepository();
    repository.history = [{ ...candidate(), profileId: "owner", periodKey: getTodayPeriod(now - 86_400_000).key, position: 0, disposition: "watched", dispositionAt: now - 86_400_000, snoozedUntil: null }];
    const result = await createTodayService(repository, successReader([])).load({ profileId: "owner", followedSourceIds: [sourceId], now });
    expect(result.state).toBe("empty");
    expect(result.snapshot?.items).toEqual([]);
    expect(repository.finalizations).toBe(1);
  });

  test("refresh preserves membership and order while updating existing metadata", async () => {
    const repository = new MemoryTodayRepository();
    const period = getTodayPeriod(now);
    const originalItems = [candidate("video000001"), candidate("video000002")].map((item, position) => ({ ...item, profileId: "owner", periodKey: period.key, position, disposition: "pending" as const, dispositionAt: null, snoozedUntil: null }));
    repository.snapshots.set(`owner:${period.key}`, { profileId: "owner", periodKey: period.key, createdAt: now, cacheFetchedAt: now, freshness: "fresh", items: originalItems });
    const changed = [{ ...candidate("video000002"), title: "Changed second" }, { ...candidate("video000001"), title: "Changed first" }, candidate("newone00001")];
    const result = await createTodayService(repository, successReader(changed)).load({ profileId: "owner", followedSourceIds: [sourceId], now, refreshExisting: true });
    expect(result.snapshot?.items.map((item) => item.id)).toEqual(["video000001", "video000002"]);
    expect(result.snapshot?.items.map((item) => item.position)).toEqual([0, 1]);
    expect(repository.finalizations).toBe(0);
  });

  test("offline refresh renders the persisted profile snapshot and keeps profiles isolated", async () => {
    const repository = new MemoryTodayRepository();
    const period = getTodayPeriod(now);
    const item = { ...candidate(), profileId: "owner", periodKey: period.key, position: 0, disposition: "pending" as const, dispositionAt: null, snoozedUntil: null };
    repository.snapshots.set(`owner:${period.key}`, { profileId: "owner", periodKey: period.key, createdAt: now, cacheFetchedAt: now, freshness: "fresh", items: [item] });
    const service = createTodayService(repository, { getCachedFeeds: async () => ({ status: "network_error" }) });
    const offline = await service.load({ profileId: "owner", followedSourceIds: [sourceId], now, refreshExisting: true });
    expect(offline.snapshot?.freshness).toBe("offline");
    expect((await service.load({ profileId: "other", followedSourceIds: [], now })).snapshot).toBeNull();
  });
});

 test("legacy profiles over 100 sources keep their snapshot and receive actionable recovery without a feed request", async () => {
  const repository = new MemoryTodayRepository();
  const period = getTodayPeriod(now);
  const snapshot: TodaySnapshot = { profileId: "owner", periodKey: period.key, createdAt: now, cacheFetchedAt: now, freshness: "fresh", items: [] };
  repository.snapshots.set(`owner:${period.key}`, snapshot);
  let calls = 0;
  const reader = successReader();
  const service = createTodayService(repository, { getCachedFeeds: async (...args) => { calls++; return reader.getCachedFeeds(...args); } });
  const ids = Array.from({ length: 101 }, (_, i) => `UC${String(i).padStart(22, "0")}`);
  const blocked = await service.load({ profileId: "owner", followedSourceIds: ids, now, refreshExisting: true });
  expect(blocked.state).toBe("source_limit"); expect(blocked.snapshot).toBe(snapshot); expect(calls).toBe(0);
  expect((await service.load({ profileId: "owner", followedSourceIds: ids.slice(0, 100), now, refreshExisting: true })).state).not.toBe("source_limit");
  expect(calls).toBe(1);
});

test("library-only sources are not fetched and toggling participation never refills an existing day", async () => {
  const repository = new MemoryTodayRepository();
  let muted = false;
  repository.listRules = async () => muted ? [{ profileId: "owner", sourceId, minimumDurationSeconds: 0, hideLivestreams: true, hideUpcomingPremieres: true, todayContributionLimit: 2, mutedUntil: Number.MAX_SAFE_INTEGER, updatedAt: now }] : [];
  let calls = 0;
  const reader = successReader();
  const service = createTodayService(repository, { async getCachedFeeds(ids) { calls++; return reader.getCachedFeeds(ids); } });
  muted = true;
  expect((await service.load({ profileId: "owner", followedSourceIds: [sourceId], now })).state).toBe("no_sources");
  expect(calls).toBe(0);
  muted = false;
  const first = await service.load({ profileId: "owner", followedSourceIds: [sourceId], now });
  muted = true;
  const disabled = await service.load({ profileId: "owner", followedSourceIds: [sourceId], now, refreshExisting: true });
  expect(disabled.snapshot).toEqual(first.snapshot);
  muted = false;
  const restored = await service.load({ profileId: "owner", followedSourceIds: [sourceId], now });
  expect(restored.snapshot).toEqual(first.snapshot);
  expect(calls).toBe(1);
});


test("favorite changes affect future selection only, including an explicit metadata refresh", async () => {
  const repository = new MemoryTodayRepository();
  const secondId = "UCzyxwvutsrqponmlkjihgfe";
  const videos = [candidate("video000001"), { ...candidate("video000002"), sourceId: secondId, channelId: secondId }];
  const service = createTodayService(repository, successReader(videos));
  const first = await service.load({ profileId: "owner", followedSourceIds: [sourceId, secondId], now });
  repository.listRules = async () => [{ profileId: "owner", sourceId: secondId, favorite: true, minimumDurationSeconds: 240, hideLivestreams: true, hideUpcomingPremieres: true, todayContributionLimit: 2, mutedUntil: null, updatedAt: now }];
  const refreshed = await service.load({ profileId: "owner", followedSourceIds: [sourceId, secondId], now, refreshExisting: true });
  expect(refreshed.snapshot?.items.map((item) => item.id)).toEqual(first.snapshot?.items.map((item) => item.id));
  expect(repository.finalizations).toBe(1);
});

test("selection size takes effect at the next daily boundary without refilling a handled day", async () => {
  const repository = new MemoryTodayRepository();
  const reader = successReader([candidate("video000001"), candidate("video000002")]);
  const service = createTodayService(repository, reader);
  const first = await service.load({ profileId: "owner", followedSourceIds: [sourceId], maxItems: 1, now });
  expect(first.snapshot?.items).toHaveLength(1);
  const key = `owner:${getTodayPeriod(now).key}`;
  repository.snapshots.set(key, { ...first.snapshot!, items: first.snapshot!.items.map((item) => ({ ...item, disposition: "dismissed" })) });
  const sameDay = await service.load({ profileId: "owner", followedSourceIds: [sourceId], maxItems: 12, now: now + 1000, refreshExisting: true });
  expect(sameDay.snapshot?.items).toHaveLength(1);
  expect(sameDay.snapshot?.items[0].disposition).toBe("dismissed");
  const tomorrow = await service.load({ profileId: "owner", followedSourceIds: [sourceId], maxItems: 2, now: getTodayPeriod(now).endsAt + 1000 });
  expect(tomorrow.snapshot?.items).toHaveLength(2);
  const other = await service.load({ profileId: "other", followedSourceIds: [sourceId], maxItems: 1, now });
  expect(other.snapshot?.items).toHaveLength(1);
});
