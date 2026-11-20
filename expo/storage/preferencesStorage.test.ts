import { expect, test } from "bun:test";
import { defaultPrefs, loadProfilePreferences } from "./preferencesStorage";
import { profileStorageKey, type KeyValueStorage } from "./profileStorage";

test("only an absent preference record receives new-profile defaults", async () => {
  let raw: string | null = null;
  const writes: string[] = [];
  const storage: KeyValueStorage = { getItem: async () => raw, setItem: async (_key, value) => { writes.push(value); }, removeItem: async () => {} };
  expect(await loadProfilePreferences(storage, "managed-test")).toEqual(defaultPrefs);
  for (raw of ["", "{broken", "null", "[]", "false"]) {
    await expect(loadProfilePreferences(storage, "managed-test")).rejects.toThrow();
  }
  expect(writes).toEqual([]);
});

test("a failed read preserves saved preferences and a retry restores them", async () => {
  const profile = "managed-existing";
  const saved = { ...defaultPrefs, theme: "ink", accent: "rose", houseLights: false, hasCompletedOnboarding: true, todayVideoCount: 3 };
  const records = new Map([[profileStorageKey("preferences", profile), JSON.stringify(saved)]]);
  let fail = true;
  const storage: KeyValueStorage = {
    getItem: async (key) => { if (fail) throw new Error("storage locked"); return records.get(key) ?? null; },
    setItem: async (key, value) => { records.set(key, value); }, removeItem: async () => {},
  };
  await expect(loadProfilePreferences(storage, profile)).rejects.toThrow("storage locked");
  expect(records.get(profileStorageKey("preferences", profile))).toBe(JSON.stringify(saved));
  fail = false;
  expect(await loadProfilePreferences(storage, profile)).toEqual(saved);
});

test("profiles saved before house lights have the cue enabled", async () => {
  const storage: KeyValueStorage = { getItem: async () => '{"theme":"ink"}', setItem: async () => {}, removeItem: async () => {} };
  expect((await loadProfilePreferences(storage, "existing")).houseLights).toBe(true);
});
