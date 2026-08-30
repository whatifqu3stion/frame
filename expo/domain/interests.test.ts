import { describe, expect, test } from "bun:test";
import { INTEREST_LIBRARY } from "../constants/interests";
import { ONBOARDING_INTEREST_MAX, WEEKLY_DISCOVERY_DISPLAY_MAX } from "../constants/productConfig";
import {
  LEGACY_INTEREST_REPLACEMENTS,
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

  test("accepts zero interests and enforces five while keeping selected items removable", () => {
    expect(canContinueInterestOnboarding([])).toBe(true);
    const five = canonicalIds.slice(0, ONBOARDING_INTEREST_MAX);
    expect(toggleInterestId(five, "health", validIds, ONBOARDING_INTEREST_MAX)).toEqual(five);
    expect(isInterestOptionDisabled(five, "health", ONBOARDING_INTEREST_MAX)).toBe(true);
    expect(isInterestOptionDisabled(five, "tech", ONBOARDING_INTEREST_MAX)).toBe(false);
    expect(toggleInterestId(five, "tech", validIds, ONBOARDING_INTEREST_MAX)).toEqual(five.slice(1));
  });

  test("does no Weekly Picks work for zero interests and caps weekly display at three total", () => {
    expect(shouldRequestWeeklyPicks([])).toBe(false);
    expect(shouldRequestWeeklyPicks(["science"])).toBe(true);
    expect(WEEKLY_DISCOVERY_DISPLAY_MAX).toBe(3);
  });
});
