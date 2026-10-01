export type OnboardingDraft = { step: number; savedIds: string[] };
export const emptyOnboardingDraft: OnboardingDraft = { step: 0, savedIds: [] };
export function parseOnboardingDraft(raw: string | null): OnboardingDraft {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return emptyOnboardingDraft;
    const draft = value as Partial<OnboardingDraft>;
    if (!Number.isInteger(draft.step) || draft.step! < 0 || draft.step! > 3 || !Array.isArray(draft.savedIds) || !draft.savedIds.every((id) => typeof id === "string")) return emptyOnboardingDraft;
    return { step: draft.step!, savedIds: [...new Set(draft.savedIds)] };
  } catch { return emptyOnboardingDraft; }
}
