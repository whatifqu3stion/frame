import { describe, expect, test } from "bun:test";
import { DEFAULT_OWNER_PROFILE_ID, type Profile } from "../models/profile";
import { resolveActiveProfileId, validateProfileName } from "./profiles";

const profiles: Profile[] = [
  { id: DEFAULT_OWNER_PROFILE_ID, name: "Owner", role: "owner", createdAt: 0, updatedAt: 0 },
  { id: "profile-riley", name: "Riley", role: "standard", createdAt: 1, updatedAt: 1 },
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

  test("restores a valid saved profile and falls back to the Owner otherwise", () => {
    expect(resolveActiveProfileId("profile-riley", profiles)).toBe("profile-riley");
    expect(resolveActiveProfileId("deleted-profile", profiles)).toBe(DEFAULT_OWNER_PROFILE_ID);
    expect(resolveActiveProfileId(null, profiles)).toBe(DEFAULT_OWNER_PROFILE_ID);
  });
});
