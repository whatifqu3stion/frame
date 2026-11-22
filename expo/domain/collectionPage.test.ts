import { expect, test } from "bun:test";
import { collectionPage } from "./collectionPage";

test("every approval remains reachable in bounded pages of a large library", () => {
  const entries = Array.from({ length: 1003 }, (_, id) => ({ id, title: `Video ${id}` }));
  const seen = new Set<number>();
  for (let page = 0; page < 51; page++) {
    const result = collectionPage(entries, "", page, (item) => item.title);
    expect(result.items.length).toBeLessThanOrEqual(20);
    for (const item of result.items) seen.add(item.id);
  }
  expect(seen.size).toBe(entries.length);
  expect(entries.length).toBe(1003);
});

test("search, empty results and removal from the final page keep a reachable page", () => {
  const entries = Array.from({ length: 21 }, (_, id) => ({ id, title: id === 20 ? "日本の木工 🪵" : `Creator ${id}` }));
  expect(collectionPage(entries, " 日本 ", 5, (item) => item.title).items[0].id).toBe(20);
  expect(collectionPage(entries, "CREATOR", 0, (item) => item.title).total).toBe(20);
  expect(collectionPage(entries, "absent", 5, (item) => item.title)).toMatchObject({ items: [], page: 0, pages: 1 });
  expect(collectionPage(entries.slice(0, 20), "", 1, (item) => item.title)).toMatchObject({ page: 0, pages: 1, total: 20 });
});
