export type ProfileRole = "owner" | "standard" | "managed";

export type Profile = {
  id: string;
  name: string;
  role: ProfileRole;
  createdAt: number;
  updatedAt: number;
};

/** Stable profile that owns every record created before profile switching exists. */
export const DEFAULT_OWNER_PROFILE_ID = "owner-default";
export const DEFAULT_OWNER_PROFILE_NAME = "Owner";
