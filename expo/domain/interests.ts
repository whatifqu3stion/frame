import type { InterestId } from "../types";

/** Toggles one stable interest id without performing network work. */
export function toggleInterestId(
  selected: readonly InterestId[],
  interestId: InterestId,
  validIds: ReadonlySet<InterestId>,
): InterestId[] {
  if (!validIds.has(interestId)) return [...selected];
  return selected.includes(interestId)
    ? selected.filter((id) => id !== interestId)
    : [...selected, interestId];
}
