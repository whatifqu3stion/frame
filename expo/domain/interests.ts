import { INTEREST_LIBRARY } from "../constants/interests";
import type { InterestId, InterestTopic } from "../types";

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

export const CUSTOM_INTEREST_LIMIT = 8;
export const isCustomInterest = (id: string) => id.startsWith("custom:");
export const CUSTOM_INTEREST_MAX_LENGTH = 120;
export const DISCOVERY_INTERESTS_PER_WEEK = 12;
const customPrefix = "custom:";

export function normalizeInterestName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** Labels are embedded in local IDs, so no remote registry or personal-profile lookup is needed. */
export function createCustomInterest(value: string): InterestTopic {
  const name = normalizeInterestName(value);
  if (!name || name.length > CUSTOM_INTEREST_MAX_LENGTH || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name)) throw new Error("Use a topic between 1 and 120 characters.");
  const existing = INTEREST_LIBRARY.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  try { return { id: `${customPrefix}${encodeURIComponent(name)}`, name, emoji: "◇" }; }
  catch { throw new Error("Use a topic with valid text."); }
}

export function interestTopicFromId(id: string): InterestTopic | null {
  const standard = INTEREST_LIBRARY.find((item) => item.id === id);
  if (standard) return standard;
  if (!id.startsWith(customPrefix) || id.length > customPrefix.length + CUSTOM_INTEREST_MAX_LENGTH * 9) return null;
  try {
    const topic = createCustomInterest(decodeURIComponent(id.slice(customPrefix.length)));
    return topic.id === id ? topic : null;
  } catch { return null; }
}

/** Preserves legacy migration and custom labels without imposing a selection count limit. */
export function canonicalizeInterestIds(values: readonly unknown[]): InterestId[] {
  const selected = new Map<string, InterestTopic>();
  for (const value of values) {
    const storedId = typeof value === "string" ? value : typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : null;
    if (!storedId) continue;
    const topic = interestTopicFromId(LEGACY_INTEREST_REPLACEMENTS[storedId] ?? storedId);
    if (topic && !selected.has(topic.name.toLowerCase())) selected.set(topic.name.toLowerCase(), topic);
  }
  const topics = [...selected.values()];
  return [...canonicalIds.filter((id) => topics.some((topic) => topic.id === id)), ...topics.filter((topic) => !canonicalIdSet.has(topic.id)).map((topic) => topic.id)];
}

export function interestTopics(values: readonly unknown[]): InterestTopic[] {
  return canonicalizeInterestIds(values).map((id) => interestTopicFromId(id)!);
}

/** Unlimited saved interests; a bounded, deterministic rotating focus keeps weekly work finite. */
export function weeklyInterestFocus(ids: readonly string[], periodStart: string, priorityIds: readonly string[] = []): InterestTopic[] {
  const topics = interestTopics(ids).sort((a, b) => a.id.localeCompare(b.id));
  const priority = [...new Set(priorityIds)].flatMap((id) => topics.find((topic) => topic.id === id) ?? []).slice(0, 3);
  const remaining = topics.filter((topic) => !priority.some((item) => item.id === topic.id));
  if (topics.length <= DISCOVERY_INTERESTS_PER_WEEK) return [...priority, ...remaining];
  const weekIndex = Math.floor(Date.parse(`${periodStart}T00:00:00Z`) / (7 * 86_400_000));
  const count = DISCOVERY_INTERESTS_PER_WEEK - priority.length;
  const offset = ((weekIndex * count) % remaining.length + remaining.length) % remaining.length;
  return [...priority, ...Array.from({ length: count }, (_, index) => remaining[(offset + index) % remaining.length])];
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
  if (isCustomInterest(interestId) && selected.filter(isCustomInterest).length >= CUSTOM_INTEREST_LIMIT) return [...selected];
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
