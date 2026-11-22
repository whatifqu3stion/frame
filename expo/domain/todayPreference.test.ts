import { expect, test } from "bun:test";
import { normalizeTodayVideoCount } from "./todayPreference";

test("Today size defaults safely for existing profiles and clamps corrupt preferences", () => {
  for (const value of [undefined, null, "3", NaN, Infinity, {}, -Infinity]) expect(normalizeTodayVideoCount(value)).toBe(12);
  expect(normalizeTodayVideoCount(0)).toBe(1);
  expect(normalizeTodayVideoCount(-10)).toBe(1);
  expect(normalizeTodayVideoCount(100)).toBe(12);
  for (let count = 1; count <= 12; count++) expect(normalizeTodayVideoCount(count)).toBe(count);
});
