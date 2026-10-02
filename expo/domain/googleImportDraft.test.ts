import { expect, test } from "bun:test";
import { currentImportDraft, pendingImportIds, IMPORT_DRAFT_MAX_AGE, type GoogleImportDraft } from "./googleImportDraft";

const draft: GoogleImportDraft = { query: "science", subscriptions: [], selectedIds: ["a", "b"], nextPageToken: "next-page", totalResults: 120, updatedAt: 1000 };
test("recent navigation restores query, selected IDs and pagination together", () => {
  expect(currentImportDraft(draft, 2000)).toEqual(draft);
});
test("old and future import pages are not reused", () => {
  expect(currentImportDraft(draft, 1000 + IMPORT_DRAFT_MAX_AGE)).toBeNull();
  expect(currentImportDraft(draft, 999)).toBeNull();
  expect(currentImportDraft({ ...draft, updatedAt: NaN }, 2000)).toBeNull();
});
test("partial imports and changed capacity preserve only still-actionable selections", () => {
  expect([...pendingImportIds(["a", "b", "b", "c", "d"], new Set(["a"]), 2)]).toEqual(["b", "c"]);
  expect([...pendingImportIds(["a"], new Set(), 0)]).toEqual([]);
});
