import type { KeyValueStorage } from "@/storage/profileStorage";

export const ACTIVE_PROFILE_STORAGE_KEY = "frame.activeProfile.v1";

/** Reads the last locally selected profile identity. */
export async function readActiveProfileId(storage: KeyValueStorage): Promise<string | null> {
  return storage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
}

/** Persists the selected profile only after it has been validated. */
export async function writeActiveProfileId(storage: KeyValueStorage, profileId: string): Promise<void> {
  await storage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
}
