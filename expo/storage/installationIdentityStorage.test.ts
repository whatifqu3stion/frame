import { describe, expect, test } from "bun:test";
import { createInstallationIdentityStore, INSTALLATION_IDENTITY_KEY } from "../domain/installationIdentity";

class MemoryStorage {
  readonly values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async removeItem(key: string): Promise<void> { this.values.delete(key); }
}

describe("device-wide installation accounting identity", () => {
  test("generates exactly 32 random bytes as 64 lowercase hex and reuses it", async () => {
    const storage = new MemoryStorage();
    let generations = 0;
    const store = createInstallationIdentityStore({
      storage,
      randomBytes: async (length: number): Promise<Uint8Array> => {
        generations += 1;
        return Uint8Array.from({ length }, (_, index) => index);
      },
    });
    const first = await store.getOrCreate();
    const second = await store.getOrCreate();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
    expect(generations).toBe(1);
    expect(storage.values.get(INSTALLATION_IDENTITY_KEY)).toBe(first);
  });

  test("is installation-scoped rather than profile-scoped and can be reset", async () => {
    const storage = new MemoryStorage();
    const store = createInstallationIdentityStore({
      storage,
      randomBytes: async (): Promise<Uint8Array> => new Uint8Array(32).fill(7),
    });
    await store.getOrCreate();
    expect([...storage.values.keys()]).toEqual([INSTALLATION_IDENTITY_KEY]);
    expect(INSTALLATION_IDENTITY_KEY).not.toContain("profile");
    await store.remove();
    expect(storage.values.size).toBe(0);
  });
});
