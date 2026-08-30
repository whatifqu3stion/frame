import { DEFAULT_OWNER_PROFILE_ID } from "../models/profile";

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type ProfileStorageNamespace = "preferences" | "interests" | "recentSearches";

export const LEGACY_PROFILE_STORAGE_KEYS: Record<ProfileStorageNamespace, string> = {
  preferences: "frame.preferences.v1",
  interests: "frame.interests.v1",
  recentSearches: "frame.recentSearches.v1",
};

/** Creates a stable profile-specific key for local preferences. */
export function profileStorageKey(namespace: ProfileStorageNamespace, profileId: string): string {
  return `frame.profile.${profileId}.${namespace}.v1`;
}

export function profileStorageMigrationKey(namespace: ProfileStorageNamespace, profileId: string): string {
  return `frame.profile.${profileId}.${namespace}.legacy-migrated.v1`;
}

/**
 * Reads profile-local state. Legacy unscoped state is copied only to the default Owner
 * and is deliberately retained until a later explicit cleanup migration.
 */
export async function readProfileStorage(
  storage: KeyValueStorage,
  namespace: ProfileStorageNamespace,
  profileId: string,
): Promise<string | null> {
  const scopedKey = profileStorageKey(namespace, profileId);
  const scoped = await storage.getItem(scopedKey);
  if (scoped !== null || profileId !== DEFAULT_OWNER_PROFILE_ID) return scoped;

  const migrationKey = profileStorageMigrationKey(namespace, profileId);
  if (await storage.getItem(migrationKey)) return null;

  const legacy = await storage.getItem(LEGACY_PROFILE_STORAGE_KEYS[namespace]);
  if (legacy !== null) await storage.setItem(scopedKey, legacy);
  await storage.setItem(migrationKey, "1");
  return legacy;
}

export async function writeProfileStorage(
  storage: KeyValueStorage,
  namespace: ProfileStorageNamespace,
  profileId: string,
  value: string,
): Promise<void> {
  await storage.setItem(profileStorageKey(namespace, profileId), value);
}

export async function clearProfileStorage(
  storage: KeyValueStorage,
  profileId: string,
): Promise<void> {
  await Promise.all((Object.keys(LEGACY_PROFILE_STORAGE_KEYS) as ProfileStorageNamespace[]).map(
    (namespace) => storage.removeItem(profileStorageKey(namespace, profileId)),
  ));
}
