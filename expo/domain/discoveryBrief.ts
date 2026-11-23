import { profileStorageKey } from "../storage/profileStorage";

export const DEFAULT_DISCOVERY_BRIEF = "Find creators who explain their thinking, show how things are made, or help me see something familiar in a new way.";
export const DISCOVERY_BRIEF_LIMIT = 500;

export function validDiscoveryBrief(text: string) {
  return text.trim().length > 0 && text.length <= DISCOVERY_BRIEF_LIMIT;
}

export async function readDiscoveryBrief(storage: { getItem(key: string): Promise<string | null> }, profileId: string) {
  const value = await storage.getItem(profileStorageKey("discoveryBrief", profileId));
  return value && validDiscoveryBrief(value) ? value.trim() : DEFAULT_DISCOVERY_BRIEF;
}
