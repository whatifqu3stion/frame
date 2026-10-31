import { describe, expect, test } from "bun:test";
import { planSourceParticipation } from "./sourceParticipation";
import { defaultTodaySourceRule, LIBRARY_ONLY_UNTIL } from "./today";

describe("source participation planning", () => {
  test("rejects a bulk inclusion above the cap before making changes", () => {
    const ids = Array.from({ length: 101 }, (_, i) => String(i));
    const rules = [{ ...defaultTodaySourceRule("owner", "100"), mutedUntil: LIBRARY_ONLY_UNTIL }];
    expect(() => planSourceParticipation("owner", ids, rules, ["100"], true, 1000)).toThrow("100 sources");
    expect(planSourceParticipation("owner", ids, rules, ["0", "1"], false, 1000)).toHaveLength(2);
  });
  test("keeps favorites and other rules, skips unchanged and unknown sources", () => {
    const rule = { ...defaultTodaySourceRule("owner", "a"), favorite: true, todayContributionLimit: 1, mutedUntil: LIBRARY_ONLY_UNTIL };
    const changes = planSourceParticipation("owner", ["a", "b", "a"], [rule], ["a", "b", "missing"], true, 1000);
    expect(changes).toEqual([{ ...rule, mutedUntil: null, updatedAt: 1000 }]);
  });
  test("does not reuse another profile’s rules", () => {
    const other = { ...defaultTodaySourceRule("other", "a"), favorite: true };
    const [change] = planSourceParticipation("owner", ["a"], [other], ["a"], false, 1000);
    expect(change.profileId).toBe("owner");
    expect(change.favorite).not.toBe(true);
    expect(change.mutedUntil).toBe(LIBRARY_ONLY_UNTIL);
  });
  test("handles expired snoozes as included and turns temporary exclusions permanent", () => {
    const rules = [{ ...defaultTodaySourceRule("owner", "a"), mutedUntil: 999 }, { ...defaultTodaySourceRule("owner", "b"), mutedUntil: 2000 }];
    expect(planSourceParticipation("owner", ["a", "b"], rules, ["a"], true, 1000)).toEqual([]);
    expect(planSourceParticipation("owner", ["a", "b"], rules, ["b"], false, 1000)[0].mutedUntil).toBe(LIBRARY_ONLY_UNTIL);
  });
});
