import * as Crypto from "expo-crypto";
import {
  deleteStandardProfile,
  insertStandardProfile,
  listProfiles,
  updateStandardProfileName,
} from "@/db/database";
import { validateProfileName } from "@/domain/profiles";
import type { Profile } from "@/models/profile";
import { PRODUCT_LIMITS } from "@/constants/productConfig";

export type ProfileRepository = {
  list(): Promise<Profile[]>;
  createStandard(name: string): Promise<Profile>;
  renameStandard(profileId: string, name: string): Promise<Profile>;
  deleteStandard(profileId: string): Promise<void>;
};

/** Owns local profile invariants while delegating atomic storage to SQLite. */
export const profileRepository: ProfileRepository = {
  list: listProfiles,

  async createStandard(input: string): Promise<Profile> {
    const profiles = await listProfiles();
    if (profiles.length >= PRODUCT_LIMITS.futureProfilesPerHousehold) {
      throw new Error(`Frame supports up to ${PRODUCT_LIMITS.futureProfilesPerHousehold} local profiles.`);
    }
    const validation = validateProfileName(input, profiles);
    if (!validation.ok) throw new Error(validation.message);
    const now = Date.now();
    const profile: Profile = {
      id: `profile-${Crypto.randomUUID()}`,
      name: validation.name,
      role: "standard",
      createdAt: now,
      updatedAt: now,
    };
    await insertStandardProfile(profile);
    return profile;
  },

  async renameStandard(profileId: string, input: string): Promise<Profile> {
    const profiles = await listProfiles();
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role !== "standard") throw new Error("Only Standard profiles can be renamed.");
    const validation = validateProfileName(input, profiles, profileId);
    if (!validation.ok) throw new Error(validation.message);
    const updatedAt = Date.now();
    await updateStandardProfileName(profileId, validation.name, updatedAt);
    return { ...profile, name: validation.name, updatedAt };
  },

  deleteStandard: deleteStandardProfile,
};
