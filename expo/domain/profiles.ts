import { DEFAULT_OWNER_PROFILE_ID, type Profile } from "@/models/profile";

export const PROFILE_NAME_MAX_LENGTH = 32;

export type ProfileNameValidation = { ok: true; name: string } | { ok: false; message: string };

/** Normalizes and validates a local profile name against the household list. */
export function validateProfileName(
  input: string,
  profiles: readonly Profile[],
  excludedProfileId?: string,
): ProfileNameValidation {
  const name = input.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, message: "Enter a profile name." };
  if (name.length > PROFILE_NAME_MAX_LENGTH) {
    return { ok: false, message: `Keep the name to ${PROFILE_NAME_MAX_LENGTH} characters or fewer.` };
  }
  const normalized = name.toLocaleLowerCase();
  const hasDuplicate = profiles.some(
    (profile) => profile.id !== excludedProfileId && profile.name.trim().toLocaleLowerCase() === normalized,
  );
  if (hasDuplicate) return { ok: false, message: "Each profile needs a different name." };
  return { ok: true, name };
}

/** Resolves a saved selection only after it has been checked against existing profiles. */
export function resolveActiveProfileId(savedProfileId: string | null, profiles: readonly Profile[]): string {
  if (savedProfileId && profiles.some((profile) => profile.id === savedProfileId)) return savedProfileId;
  const owner = profiles.find((profile) => profile.role === "owner");
  return owner?.id ?? DEFAULT_OWNER_PROFILE_ID;
}
