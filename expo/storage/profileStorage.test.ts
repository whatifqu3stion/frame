import { describe, expect, test } from "bun:test";
import { DEFAULT_OWNER_PROFILE_ID } from "../models/profile";
import {
  LEGACY_PROFILE_STORAGE_KEYS,
  clearProfileStorage,
  profileStorageKey,
  readProfileStorage,
  writeProfileStorage,
  type KeyValueStorage,
} from "./profileStorage";

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async removeItem(key: string): Promise<void> { this.values.delete(key); }
}

describe("profile-scoped preferences", () => {
  test("copies legacy preferences to the Owner without deleting the legacy value", async () => {
    const storage = new MemoryStorage();
    const legacy = JSON.stringify({ theme: "ink" });
    storage.values.set(LEGACY_PROFILE_STORAGE_KEYS.preferences, legacy);
    expect(await readProfileStorage(storage, "preferences", DEFAULT_OWNER_PROFILE_ID)).toBe(legacy);
    expect(storage.values.get(profileStorageKey("preferences", DEFAULT_OWNER_PROFILE_ID))).toBe(legacy);
    expect(storage.values.get(LEGACY_PROFILE_STORAGE_KEYS.preferences)).toBe(legacy);
  });

  test("keeps appearance and preferences independent between profiles", async () => {
    const storage = new MemoryStorage();
    await writeProfileStorage(storage, "preferences", "owner", JSON.stringify({ theme: "warm" }));
    await writeProfileStorage(storage, "preferences", "standard", JSON.stringify({ theme: "ink" }));
    expect(await readProfileStorage(storage, "preferences", "owner")).toContain("warm");
    expect(await readProfileStorage(storage, "preferences", "standard")).toContain("ink");
  });

  test("stores stable interest ids independently per profile and survives reload", async () => {
    const storage = new MemoryStorage();
    await writeProfileStorage(storage, "interests", "owner", JSON.stringify(["science", "design"]));
    await writeProfileStorage(storage, "interests", "managed", JSON.stringify(["music"]));
    expect(JSON.parse((await readProfileStorage(storage, "interests", "owner")) ?? "[]")).toEqual(["science", "design"]);
    expect(JSON.parse((await readProfileStorage(storage, "interests", "managed")) ?? "[]")).toEqual(["music"]);
  });

  test("clearing one profile leaves another profile intact", async () => {
    const storage = new MemoryStorage();
    await writeProfileStorage(storage, "preferences", "owner", "owner-value");
    await writeProfileStorage(storage, "preferences", "standard", "standard-value");
    await clearProfileStorage(storage, "owner");
    expect(await readProfileStorage(storage, "preferences", "owner")).toBeNull();
    expect(await readProfileStorage(storage, "preferences", "standard")).toBe("standard-value");
  });

  test("does not restore stale legacy data after the Owner explicitly clears data", async () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_PROFILE_STORAGE_KEYS.preferences, "legacy-value");
    expect(await readProfileStorage(storage, "preferences", DEFAULT_OWNER_PROFILE_ID)).toBe("legacy-value");
    await clearProfileStorage(storage, DEFAULT_OWNER_PROFILE_ID);
    expect(await readProfileStorage(storage, "preferences", DEFAULT_OWNER_PROFILE_ID)).toBeNull();
    expect(storage.values.get(LEGACY_PROFILE_STORAGE_KEYS.preferences)).toBe("legacy-value");
  });
});

test("clearing a profile removes its first-run watch intent and keeps other profiles isolated", async () => {
  const storage = new MemoryStorage();
  await writeProfileStorage(storage, "pendingWatch", "owner", "video000001");
  await writeProfileStorage(storage, "pendingWatch", "managed", "video000002");
  await clearProfileStorage(storage, "owner");
  expect(await readProfileStorage(storage, "pendingWatch", "owner")).toBeNull();
  expect(await readProfileStorage(storage, "pendingWatch", "managed")).toBe("video000002");
});


test("custom interest selections and generated editions are isolated and cleared with their profile", async () => {
  const storage = new MemoryStorage();
  const topic = "custom:Japanese%20joinery";
  await writeProfileStorage(storage, "interests", "owner", JSON.stringify([topic]));
  await writeProfileStorage(storage, "discoveryBrief", "owner", "Process over gear");
  await writeProfileStorage(storage, "generatedPicks", "owner", "owner-edition");
  await writeProfileStorage(storage, "generatedPicks", "other", "other-edition");
  expect(await readProfileStorage(storage, "interests", "other")).toBeNull();
  expect(await readProfileStorage(storage, "interests", "owner")).toContain(topic);
  await clearProfileStorage(storage, "owner");
  expect(await readProfileStorage(storage, "discoveryBrief", "owner")).toBeNull();
  expect(await readProfileStorage(storage, "generatedPicks", "owner")).toBeNull();
  expect(await readProfileStorage(storage, "generatedPicks", "other")).toBe("other-edition");
});
