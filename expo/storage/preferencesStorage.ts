import { normalizeTodayVideoCount } from "@/domain/todayPreference";
import type { UserPreferences } from "@/types";
import { readProfileStorage, type KeyValueStorage } from "./profileStorage";

export const defaultPrefs: UserPreferences = {
  todayVideoCount: normalizeTodayVideoCount(undefined), theme: "warm", accent: "blue",
  hasCompletedOnboarding: false, googleEmail: null, googleConnectedAt: null,
};

/** Only an absent record is a new profile. Failed or corrupt reads must not become writable defaults. */
export async function loadProfilePreferences(storage: KeyValueStorage, profileId: string): Promise<UserPreferences> {
  const raw = await readProfileStorage(storage, "preferences", profileId);
  if (raw === null) return { ...defaultPrefs };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Saved preferences could not be read.");
  const parsed = value as Partial<UserPreferences>;
  return {
    todayVideoCount: normalizeTodayVideoCount(parsed.todayVideoCount),
    theme: parsed.theme === "ink" ? "ink" : "warm",
    accent: parsed.accent === "green" || parsed.accent === "rose" ? parsed.accent : "blue",
    hasCompletedOnboarding: parsed.hasCompletedOnboarding === true,
    googleEmail: typeof parsed.googleEmail === "string" ? parsed.googleEmail : null,
    googleConnectedAt: typeof parsed.googleConnectedAt === "number" && Number.isFinite(parsed.googleConnectedAt) ? parsed.googleConnectedAt : null,
  };
}
