import { INTEREST_LIBRARY } from "../constants/interests";
import type { InterestId } from "../types";

export const LEGACY_INTEREST_REPLACEMENTS: Readonly<Record<string, InterestId>> = {
  photography: "design",
  architecture: "design",
  art: "design",
  nature: "science",
  philosophy: "learning",
  literature: "learning",
  writing: "learning",
  essays: "learning",
  interviews: "learning",
  craft: "making",
};

const canonicalIds = INTEREST_LIBRARY.map((interest) => interest.id);
const canonicalIdSet = new Set<InterestId>(canonicalIds);

/** Converts locally stored canonical or legacy IDs into unique canonical display order. */
export function canonicalizeInterestIds(values: readonly unknown[]): InterestId[] {
  const selected = new Set<InterestId>();
  for (const value of values) {
    const storedId = typeof value === "string"
      ? value
      : typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string"
        ? (value as { id: string }).id
        : null;
    if (!storedId) continue;
    const canonicalId = LEGACY_INTEREST_REPLACEMENTS[storedId] ?? storedId;
    if (canonicalIdSet.has(canonicalId)) selected.add(canonicalId);
  }
  return canonicalIds.filter((id) => selected.has(id));
}

/** Toggles one stable interest without allowing additions beyond the supplied limit. */
export function toggleInterestId(
  selected: readonly InterestId[],
  interestId: InterestId,
  validIds: ReadonlySet<InterestId>,
  maxSelections: number = Number.POSITIVE_INFINITY,
): InterestId[] {
  if (!validIds.has(interestId)) return [...selected];
  if (selected.includes(interestId)) return selected.filter((id) => id !== interestId);
  if (selected.length >= maxSelections) return [...selected];
  return [...selected, interestId];
}

/** Zero interests is a valid onboarding choice. */
export function canContinueInterestOnboarding(_selected: readonly InterestId[]): boolean {
  return true;
}

export function isInterestOptionDisabled(
  selected: readonly InterestId[],
  interestId: InterestId,
  maxSelections: number,
): boolean {
  return selected.length >= maxSelections && !selected.includes(interestId);
}
