import { describe, expect, test } from "bun:test";
import { DEFAULT_OWNER_PROFILE_ID, type Profile } from "../models/profile";
import { reorderLocalProfiles, resolveActiveProfileId, validateProfileName } from "./profiles";

const profiles: Profile[] = [
  { id: DEFAULT_OWNER_PROFILE_ID, name: "Owner", role: "owner", sortOrder: 0, createdAt: 0, updatedAt: 0 },
  { id: "profile-riley", name: "Riley", role: "standard", sortOrder: 1, createdAt: 1, updatedAt: 1 },
  { id: "profile-kid", name: "Kid", role: "managed", sortOrder: 2, createdAt: 2, updatedAt: 2 },
];

describe("local profile rules", () => {
  test("normalizes a valid unique name", () => {
    expect(validateProfileName("  Sam   Lee  ", profiles)).toEqual({ ok: true, name: "Sam Lee" });
  });

  test("rejects empty, long, and case-insensitively duplicate names", () => {
    expect(validateProfileName("  ", profiles).ok).toBeFalse();
    expect(validateProfileName("x".repeat(33), profiles).ok).toBeFalse();
    expect(validateProfileName(" rIlEy ", profiles)).toEqual({ ok: false, message: "Each profile needs a different name." });
  });

  test("permits a Standard profile to keep its current normalized name", () => {
    expect(validateProfileName(" Riley ", profiles, "profile-riley")).toEqual({ ok: true, name: "Riley" });
  });

  test("reorders Managed profiles without changing identities or moving the Owner", () => {
    const reordered = reorderLocalProfiles(profiles, "profile-kid", "up");
    expect(reordered.map((profile) => profile.id)).toEqual([DEFAULT_OWNER_PROFILE_ID, "profile-kid", "profile-riley"]);
    expect(reordered.map((profile) => profile.sortOrder)).toEqual([0, 1, 2]);
  });

  test("restores a valid Standard or Managed profile and falls back to the Owner otherwise", () => {
    expect(resolveActiveProfileId("profile-riley", profiles)).toBe("profile-riley");
    expect(resolveActiveProfileId("profile-kid", profiles)).toBe("profile-kid");
    expect(resolveActiveProfileId("deleted-profile", profiles)).toBe(DEFAULT_OWNER_PROFILE_ID);
    expect(resolveActiveProfileId(null, profiles)).toBe(DEFAULT_OWNER_PROFILE_ID);
  });
});
