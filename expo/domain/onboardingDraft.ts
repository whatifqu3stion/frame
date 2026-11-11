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

export type OnboardingDraft = { version: 5; step: number; savedIds: string[]; path?: "creator"; youtubeGuide?: "credentials"; sourceLink?: string; returnTo?: "source" | "your-frame" };
export const emptyOnboardingDraft: OnboardingDraft = { version: 5, step: 0, savedIds: [] };
export function parseOnboardingDraft(raw: string | null): OnboardingDraft {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return emptyOnboardingDraft;
    const draft = value as { version?: number; step?: number; savedIds?: unknown; path?: unknown; youtubeGuide?: unknown; sourceLink?: unknown; returnTo?: unknown };
    const positions = draft.version === 5 ? [0, 1, 2, 3] : draft.version === 4 ? [1, 2, 3] : draft.version === 2 ? [2, 2, 3] : draft.version === undefined || draft.version === 3 ? [1, 2, 2, 3] : [];
    if (!Number.isInteger(draft.step) || positions[draft.step!] === undefined || !Array.isArray(draft.savedIds) || !draft.savedIds.every((id) => typeof id === "string")) return emptyOnboardingDraft;
    const creator = draft.version === 4 || draft.version === 5 ? draft.path === "creator" : draft.version === 2 ? draft.step! > 0 : draft.step! > 1;
    const sourceLink = draft.version === 5 && creator && typeof draft.sourceLink === "string" ? onboardingSourceLink(draft.sourceLink) : undefined;
    return { version: 5, step: positions[draft.step!], savedIds: [...new Set(draft.savedIds)], ...(creator ? { path: "creator" as const } : {}),
      ...(draft.version === 5 && draft.youtubeGuide === "credentials" ? { youtubeGuide: "credentials" as const } : {}),
      ...(draft.version === 5 && draft.step === 1 && (draft.returnTo === "source" || draft.returnTo === "your-frame") ? { returnTo: draft.returnTo } : {}),
      ...(sourceLink ? { sourceLink } : {}) };
  } catch { return emptyOnboardingDraft; }
}
