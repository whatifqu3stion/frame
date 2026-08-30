import { describe, expect, test } from "bun:test";
import { DEFAULT_OWNER_PROFILE_ID } from "../models/profile";
import {
  LEGACY_GOOGLE_TOKEN_KEY,
  clearProfileGoogleCredential,
  googleCredentialKey,
  readProfileGoogleCredential,
  writeProfileGoogleCredential,
  type SecureCredentialStorage,
} from "./googleCredentialStorage";

class MemorySecureStorage implements SecureCredentialStorage {
  readonly values = new Map<string, string>();
  async getItemAsync(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItemAsync(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async deleteItemAsync(key: string): Promise<void> { this.values.delete(key); }
}

describe("profile-scoped Google credentials", () => {
  test("moves the legacy credential to the stable Owner only", async () => {
    const storage = new MemorySecureStorage();
    storage.values.set(LEGACY_GOOGLE_TOKEN_KEY, "legacy-secret");
    expect(await readProfileGoogleCredential(storage, DEFAULT_OWNER_PROFILE_ID)).toBe("legacy-secret");
    expect(storage.values.get(googleCredentialKey(DEFAULT_OWNER_PROFILE_ID))).toBe("legacy-secret");
    expect(storage.values.has(LEGACY_GOOGLE_TOKEN_KEY)).toBeFalse();
    expect(await readProfileGoogleCredential(storage, "standard")).toBeNull();
  });

  test("keeps credentials isolated and clears only one profile", async () => {
    const storage = new MemorySecureStorage();
    await writeProfileGoogleCredential(storage, "owner", "owner-secret");
    await writeProfileGoogleCredential(storage, "standard", "standard-secret");
    await clearProfileGoogleCredential(storage, "owner");
    expect(await readProfileGoogleCredential(storage, "owner")).toBeNull();
    expect(await readProfileGoogleCredential(storage, "standard")).toBe("standard-secret");
  });
});
