export type OnboardingDraft = { version: 2; step: number; savedIds: string[] };
export const emptyOnboardingDraft: OnboardingDraft = { version: 2, step: 0, savedIds: [] };
export function parseOnboardingDraft(raw: string | null): OnboardingDraft {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return emptyOnboardingDraft;
    const draft = value as { version?: number; step?: number; savedIds?: unknown };
    const legacy = draft.version === undefined;
    if ((!legacy && draft.version !== 2) || !Number.isInteger(draft.step) || draft.step! < 0 || draft.step! > (legacy ? 3 : 2) || !Array.isArray(draft.savedIds) || !draft.savedIds.every((id) => typeof id === "string")) return emptyOnboardingDraft;
    // The introduction and interests now share the first screen. Preserve source/reveal progress.
    return { version: 2, step: legacy ? Math.max(0, draft.step! - 1) : draft.step!, savedIds: [...new Set(draft.savedIds)] };
  } catch { return emptyOnboardingDraft; }
}
