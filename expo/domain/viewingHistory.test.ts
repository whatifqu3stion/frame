import { expect, test } from "bun:test";
import { ViewingHistoryStore, viewingWeek, formatViewingTime } from "./viewingHistory";
import { ViewingAllowanceService } from "./ViewingAllowanceService";
import { clearProfileStorage, profileStorageKey } from "../storage/profileStorage";
import type { Profile } from "../models/profile";

const noon = new Date(2026, 9, 20, 12).getTime();
function setup() {
  const data = new Map<string, string>();
  const storage = { async getItem(key: string) { return data.get(key) ?? null; }, async setItem(key: string, value: string) { data.set(key, value); }, async removeItem(key: string) { data.delete(key); } };
  return { data, storage, store: new ViewingHistoryStore(storage) };
}
test("distinguishes unrecorded days, zero playback, and fractional minutes", async () => {
  const { store } = setup();
  expect(viewingWeek(await store.read("a", noon), noon).map((day) => day.milliseconds)).toEqual([null, null, null, null, null, null, 0]);
  await store.record("a", noon, noon + 350);
  await store.record("a", noon + 350, noon + 1_250);
  expect(viewingWeek(await store.read("a", noon), noon)[6].milliseconds).toBe(1250);
  expect(formatViewingTime(1250)).toBe("<1 min");
  expect(formatViewingTime(0)).toBe("0 min");
  expect(formatViewingTime(90 * 60_000)).toBe("1h 30m");
});
test("splits playback at local midnight and serializes overlapping writes", async () => {
  const { store } = setup();
  const midnight = new Date(2026, 9, 21).getTime();
  await Promise.all([store.record("a", midnight - 2_500, midnight + 1_500), store.record("a", midnight + 1_500, midnight + 3_000)]);
  const days = viewingWeek(await store.read("a", midnight + 3_000), midnight + 3_000);
  expect(days[5].milliseconds).toBe(2500);
  expect(days[6].milliseconds).toBe(3000);
});
test("separates profiles, limits retention, and clears with profile data", async () => {
  const { store, storage } = setup();
  for (let day = 0; day < 10; day++) { const at = new Date(2026, 9, 10 + day, 12).getTime(); await store.record("a", at, at + 60_000); }
  const history = await store.read("a", noon);
  expect(Object.keys(history.days).length).toBe(6);
  expect(Object.keys((await store.read("b", noon)).days)).toHaveLength(0);
  await clearProfileStorage(storage, "a");
  expect(await storage.getItem(profileStorageKey("viewingHistory", "a"))).toBeNull();
});
test("corrupt history stays an error instead of becoming a false zero", async () => {
  const { store, data } = setup();
  data.set(profileStorageKey("viewingHistory", "a"), '{"version":1,"startedAt":0,"days":{"2026-10-20":-1}}');
  await expect(store.read("a", noon)).rejects.toThrow("Viewing history is unavailable");
});
test("unlimited playback records only playing intervals and stops idempotently", async () => {
  const { store } = setup();
  const profile: Profile = { id: "a", name: "A", role: "standard", sortOrder: 0, createdAt: noon, updatedAt: noon };
  const service = new ViewingAllowanceService({ readLimit: async () => null, writeLimit: async () => {}, readUsage: async () => null, writeUsage: async () => {} }, (id, from, to) => store.record(id, from, to));
  await service.beginPlaying(profile, noon);
  await service.checkpoint(noon + 1500);
  await service.stopPlaying(noon + 2250);
  await service.stopPlaying(noon + 10_000);
  await service.beginPlaying({ ...profile, id: "b" }, noon + 20_000);
  await service.stopPlaying(noon + 23_000);
  expect(viewingWeek(await store.read("a", noon), noon)[6].milliseconds).toBe(2250);
  expect(viewingWeek(await store.read("b", noon), noon)[6].milliseconds).toBe(3000);
});
test("an awareness storage failure never alters playback authorization", async () => {
  const service = new ViewingAllowanceService({ readLimit: async () => null, writeLimit: async () => {}, readUsage: async () => null, writeUsage: async () => {} }, async () => { throw new Error("storage unavailable"); });
  await service.beginPlaying({ id: "a", name: "A", role: "standard", sortOrder: 0, createdAt: noon, updatedAt: noon }, noon);
  expect((await service.checkpoint(noon + 1000)).canPlay).toBeTrue();
  await service.stopPlaying(noon + 2000);
});
