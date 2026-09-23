import { describe, expect, test } from "bun:test";
import type { FollowedChannel } from "../types";
import { isAutomaticGoogleFollowingEnabled, planSelectiveGoogleImport } from "./googleImportPolicy";

function channel(id: string): FollowedChannel {
  return { id, title: id, description: "", thumbnailUrl: "", followedAt: 1, source: "google", fetchedAt: 1 };
}

describe("selective Google import planning", () => {
  test("deduplicates explicit choices and excludes sources already followed", () => {
    const result = planSelectiveGoogleImport([channel("a"), channel("a"), channel("b")], new Set(["b"]), 10);
    expect(result.channels.map((item) => item.id)).toEqual(["a"]);
    expect(result.duplicateCount).toBe(1);
    expect(result.alreadyFollowedCount).toBe(1);
    expect(result.overflowCount).toBe(0);
    expect(isAutomaticGoogleFollowingEnabled()).toBeFalse();
  });

  test("reports overflow instead of silently exceeding the profile source cap", () => {
    const result = planSelectiveGoogleImport([channel("a"), channel("b")], new Set(["existing"]), 2);
    expect(result.channels.map((item) => item.id)).toEqual(["a"]);
    expect(result.overflowCount).toBe(1);
  });
});
