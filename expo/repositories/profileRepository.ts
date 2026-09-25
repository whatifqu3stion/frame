import * as Crypto from "expo-crypto";
import {
  deleteLocalProfileRecords,
  insertLocalProfile,
  listProfiles,
  updateLocalProfileName,
  updateProfileOrder,
} from "@/db/database";
import { createManagedAllowanceRecord } from "@/domain/dailyAllowance";
import { reorderLocalProfiles, validateProfileName } from "@/domain/profiles";
import type { ManagedAllowance } from "@/models/dailyAllowance";
import type { Profile, ProfileRole } from "@/models/profile";
import { PRODUCT_LIMITS } from "@/constants/productConfig";

export type ProfileRepository = {
  list(): Promise<Profile[]>;
  createStandard(name: string): Promise<Profile>;
  createManaged(name: string, allowance: ManagedAllowance): Promise<Profile>;
  renameLocal(profileId: string, name: string): Promise<Profile>;
  reorderLocal(profileId: string, direction: "up" | "down"): Promise<Profile[]>;
  deleteLocal(profileId: string): Promise<void>;
};

async function createProfile(name: string, role: Exclude<ProfileRole, "owner">, allowance?: ManagedAllowance): Promise<Profile> {
  const profiles = await listProfiles();
  if (profiles.length >= PRODUCT_LIMITS.premiumProfilesPerHousehold) {
    throw new Error(`Frame supports up to ${PRODUCT_LIMITS.premiumProfilesPerHousehold} local profiles.`);
  }
  const validation = validateProfileName(name, profiles);
  if (!validation.ok) throw new Error(validation.message);
  const now = Date.now();
  const profile: Profile = {
    id: `profile-${Crypto.randomUUID()}`,
    name: validation.name,
    role,
    sortOrder: Math.max(0, ...profiles.map((candidate) => candidate.sortOrder)) + 1,
    createdAt: now,
    updatedAt: now,
  };
  const allowanceRecord = role === "managed"
    ? createManagedAllowanceRecord(profile.id, allowance ?? { mode: "dailyLimit", minutes: 30 }, now)
    : undefined;
  await insertLocalProfile(profile, allowanceRecord);
  return profile;
}

/** Owns local profile invariants while delegating atomic storage to SQLite. */
export const profileRepository: ProfileRepository = {
  list: listProfiles,
  createStandard: (name: string) => createProfile(name, "standard"),
  createManaged: (name: string, allowance: ManagedAllowance) => createProfile(name, "managed", allowance),

  async renameLocal(profileId: string, input: string): Promise<Profile> {
    const profiles = await listProfiles();
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role === "owner") throw new Error("Only Standard or Managed profiles can be renamed.");
    const validation = validateProfileName(input, profiles, profileId);
    if (!validation.ok) throw new Error(validation.message);
    const updatedAt = Date.now();
    await updateLocalProfileName(profileId, validation.name, updatedAt);
    return { ...profile, name: validation.name, updatedAt };
  },

  async reorderLocal(profileId: string, direction: "up" | "down"): Promise<Profile[]> {
    const profiles = await listProfiles();
    if (!profiles.some((profile) => profile.id === profileId && profile.role !== "owner")) throw new Error("That profile is no longer available.");
    const reordered = reorderLocalProfiles(profiles, profileId, direction).filter((profile) => profile.role !== "owner");
    await updateProfileOrder(reordered.map((profile) => profile.id));
    return listProfiles();
  },

  deleteLocal: deleteLocalProfileRecords,
};
