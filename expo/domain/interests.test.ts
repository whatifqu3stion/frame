import { describe, expect, test } from "bun:test";
import { INTEREST_LIBRARY } from "../constants/interests";
import { ONBOARDING_INTEREST_MAX, WEEKLY_DISCOVERY_DISPLAY_MAX } from "../constants/productConfig";
import {
  LEGACY_INTEREST_REPLACEMENTS,
  createCustomInterest, interestTopics, interestTopicFromId, weeklyInterestFocus, DISCOVERY_INTERESTS_PER_WEEK,
  canContinueInterestOnboarding,
  canonicalizeInterestIds,
  isInterestOptionDisabled,
  toggleInterestId,
} from "./interests";
import { shouldRequestWeeklyPicks } from "../services/discovery";

const canonicalIds = INTEREST_LIBRARY.map((interest) => interest.id);
const validIds = new Set(canonicalIds);

describe("Round 2B interest compatibility", () => {
  test("defines the exact canonical display order", () => {
    expect(canonicalIds).toEqual([
      "tech", "science", "history", "learning", "business", "health", "design",
      "film", "music", "cooking", "travel", "making", "gaming", "sports", "life",
    ]);
  });

  test("maps every replaced legacy interest", () => {
    expect(LEGACY_INTEREST_REPLACEMENTS).toEqual({
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
    });
  });

  test("canonicalizes legacy storage, removes unknowns, deduplicates, and sorts", () => {
    expect(canonicalizeInterestIds([
      "craft", "unknown", "tech", "photography", "design", "essays", "science", "nature",
    ])).toEqual(["tech", "science", "learning", "design", "making"]);
  });

  test("accepts zero interests and unlimited selections while keeping selected items removable", () => {
    expect(canContinueInterestOnboarding([])).toBe(true);
    const five = canonicalIds.slice(0, 5);
    expect(toggleInterestId(five, "health", validIds, ONBOARDING_INTEREST_MAX)).toEqual([...five, "health"]);
    expect(isInterestOptionDisabled(five, "health", ONBOARDING_INTEREST_MAX)).toBe(false);
    expect(toggleInterestId(five, "tech", validIds)).toEqual(five.slice(1));
    let selected: string[] = [];
    for (const id of canonicalIds) selected = toggleInterestId(selected, id, validIds);
    expect(selected).toEqual(canonicalIds);
  });

  test("eight custom additions leave library topics available and legacy topics removable", () => {
    const ids = Array.from({ length: 9 }, (_, i) => createCustomInterest(`Topic ${i}`).id);
    const valid = new Set([...ids, "history"]);
    const eight = ids.slice(0, 8);
    expect(toggleInterestId(eight.slice(0, 7), ids[7], valid)).toEqual(eight);
    expect(toggleInterestId(eight, ids[8], valid)).toEqual(eight);
    expect(toggleInterestId(eight, "history", valid)).toEqual([...eight, "history"]);
    expect(toggleInterestId(ids, ids[8], valid)).toEqual(eight);
  });

  test("custom topics round-trip through profile IDs with no count cap and retain specific Unicode labels", () => {
    const precise = createCustomInterest("  日本の木工   joinery  ");
    expect(interestTopicFromId(precise.id)?.name).toBe("日本の木工 joinery");
    const many = Array.from({ length: 200 }, (_, index) => createCustomInterest(`Specific topic ${index}`));
    expect(interestTopics(JSON.parse(JSON.stringify(many.map((topic) => topic.id))))).toEqual(many);
    expect(interestTopics([precise, createCustomInterest("日本の木工 JOINERY"), "tech", "nature", "unknown"])).toHaveLength(3);
    expect(createCustomInterest("technology").id).toBe("tech");
    for (const value of ["", "   ", "x".repeat(121), "topic\u0000", "topic\u202e", "\ud800"]) expect(() => createCustomInterest(value)).toThrow();
    expect(interestTopicFromId("custom:%invalid")).toBeNull();
    expect(interestTopicFromId("custom:" + "x".repeat(2000))).toBeNull();
  });

  test("large selections rotate through a bounded weekly focus without losing interests or growing output", () => {
    const ids = Array.from({ length: 50 }, (_, index) => createCustomInterest(`Topic ${index}`).id);
    const seen = new Set<string>();
    const first = weeklyInterestFocus(ids, "2026-10-19");
    expect(first).toHaveLength(DISCOVERY_INTERESTS_PER_WEEK);
    expect(weeklyInterestFocus([...ids].reverse(), "2026-10-19")).toEqual(first);
    for (let index = 0; index < 5; index++) {
      const period = new Date(Date.parse("2026-10-19T00:00:00Z") + index * 7 * 86_400_000).toISOString().slice(0, 10);
      weeklyInterestFocus(ids, period).forEach((topic) => seen.add(topic.id));
    }
    expect(seen.size).toBe(50);
    expect(weeklyInterestFocus(["science", "making"], "2026-10-19")).toHaveLength(2);
  });

  test("does no Weekly Picks work for zero interests and caps weekly display at three total", () => {
    expect(shouldRequestWeeklyPicks([])).toBe(false);
    expect(shouldRequestWeeklyPicks(["science"])).toBe(true);
    expect(shouldRequestWeeklyPicks(["science"], true)).toBe(true);
    expect(shouldRequestWeeklyPicks([], true)).toBe(false);
    expect(WEEKLY_DISCOVERY_DISPLAY_MAX).toBe(3);
  });
});

test("up to three selected priorities stay in the twelve-topic focus while others rotate", () => {
  const ids = INTEREST_LIBRARY.slice(0, 20).map((topic) => topic.id);
  const priorities = ids.slice(-3);
  const first = weeklyInterestFocus(ids, "2026-10-19", [...priorities, "not-selected"]);
  const next = weeklyInterestFocus(ids, "2026-10-26", priorities);
  expect(first).toHaveLength(12);
  expect(first.slice(0, 3).map((topic) => topic.id)).toEqual(priorities);
  expect(next.slice(0, 3).map((topic) => topic.id)).toEqual(priorities);
  expect(next.map((topic) => topic.id)).not.toEqual(first.map((topic) => topic.id));
  expect(new Set(first.map((topic) => topic.id)).size).toBe(12);
});
