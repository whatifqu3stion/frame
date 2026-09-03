import { describe, expect, test } from "bun:test";
import { ACTIVE_PROFILE_STORAGE_KEY, readActiveProfileId, writeActiveProfileId } from "./activeProfileStorage";
import type { KeyValueStorage } from "./profileStorage";

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async removeItem(key: string): Promise<void> { this.values.delete(key); }
}

describe("active profile persistence", () => {
  test("persists and restores the selected stable profile id", async () => {
    const storage = new MemoryStorage();
    expect(await readActiveProfileId(storage)).toBeNull();
    await writeActiveProfileId(storage, "profile-sam");
    expect(await readActiveProfileId(storage)).toBe("profile-sam");
    expect(storage.values.get(ACTIVE_PROFILE_STORAGE_KEY)).toBe("profile-sam");
  });
});
