import { ONBOARDING_STEPS } from "../constants/navigation";
import { parseSourceInput } from "./sourceInput";

// Save only the YouTube identity. A pasted URL can carry unrelated query data.
export function onboardingSourceLink(input: string): string | undefined {
  const source = parseSourceInput(input);
  switch (source.kind) {
    case "video": return `https://youtu.be/${source.value}`;
    case "handle": return `@${source.value}`;
    case "channelId": return source.value;
    default: return undefined;
  }
}

export type OnboardingDraft = { version: 8; step: number; savedIds: string[]; path?: "creator"; youtubeGuide?: "credentials"; sourceLink?: string; returnTo?: "source" | "your-frame" };
export const emptyOnboardingDraft: OnboardingDraft = { version: 8, step: 0, savedIds: [] };
const draftSteps: Record<number, readonly (typeof ONBOARDING_STEPS[number])[]> = {
  2: ["source", "source", "your-frame"],
  3: ["keys", "source", "source", "your-frame"],
  4: ["keys", "source", "your-frame"],
  5: ["welcome", "keys", "source", "your-frame"],
  6: ["keys", "welcome", "source", "your-frame"],
  7: ["keys", "study", "welcome", "contrast", "source", "bespoke", "your-frame"],
  8: ONBOARDING_STEPS,
};
export function parseOnboardingDraft(raw: string | null): OnboardingDraft {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return emptyOnboardingDraft;
    const draft = value as { version?: number; step?: number; savedIds?: unknown; path?: unknown; youtubeGuide?: unknown; sourceLink?: unknown; returnTo?: unknown };
    const version = draft.version === undefined ? 3 : draft.version;
    const modern = typeof version === "number" && version >= 5;
    const stage = typeof version === "number" && Number.isInteger(draft.step) ? draftSteps[version]?.[draft.step!] : undefined;
    if (!stage || !Array.isArray(draft.savedIds) || !draft.savedIds.every((id) => typeof id === "string")) return emptyOnboardingDraft;
    const creator = draft.version === 4 || modern ? draft.path === "creator" : draft.version === 2 ? draft.step! > 0 : draft.step! > 1;
    const sourceLink = modern && creator && typeof draft.sourceLink === "string" ? onboardingSourceLink(draft.sourceLink) : undefined;
    return { version: 8, step: ONBOARDING_STEPS.indexOf(stage), savedIds: [...new Set(draft.savedIds)], ...(creator ? { path: "creator" as const } : {}),
      ...(modern && draft.youtubeGuide === "credentials" ? { youtubeGuide: "credentials" as const } : {}),
      ...(modern && stage === "keys" && (draft.returnTo === "source" || draft.returnTo === "your-frame") ? { returnTo: draft.returnTo } : {}),
      ...(sourceLink ? { sourceLink } : {}) };
  } catch { return emptyOnboardingDraft; }
}
