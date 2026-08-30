import { DEFAULT_OWNER_PROFILE_ID } from "../models/profile";

export type SecureCredentialStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export const LEGACY_GOOGLE_TOKEN_KEY = "frame.google.token.v1";

export function googleCredentialKey(profileId: string): string {
  return `frame.profile.${profileId}.google.token.v1`;
}

/** Moves the legacy Owner credential to profile-scoped secure storage after a successful copy. */
export async function readProfileGoogleCredential(
  storage: SecureCredentialStorage,
  profileId: string,
): Promise<string | null> {
  const scopedKey = googleCredentialKey(profileId);
  const scopedCredential = await storage.getItemAsync(scopedKey);
  if (scopedCredential || profileId !== DEFAULT_OWNER_PROFILE_ID) return scopedCredential;

  const legacyCredential = await storage.getItemAsync(LEGACY_GOOGLE_TOKEN_KEY);
  if (!legacyCredential) return null;
  await storage.setItemAsync(scopedKey, legacyCredential);
  await storage.deleteItemAsync(LEGACY_GOOGLE_TOKEN_KEY);
  return legacyCredential;
}

export async function writeProfileGoogleCredential(
  storage: SecureCredentialStorage,
  profileId: string,
  credential: string,
): Promise<void> {
  await storage.setItemAsync(googleCredentialKey(profileId), credential);
}

export async function clearProfileGoogleCredential(
  storage: SecureCredentialStorage,
  profileId: string,
): Promise<void> {
  await storage.deleteItemAsync(googleCredentialKey(profileId));
}
