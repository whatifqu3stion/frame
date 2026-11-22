export const COLLECTION_PAGE_SIZE = 20;

/** Bound rendered rows without limiting or discarding the underlying collection. */
export function collectionPage<T>(items: readonly T[], query: string, requestedPage: number, text: (item: T) => string) {
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle ? items.filter((item) => text(item).toLocaleLowerCase().includes(needle)) : items;
  const pages = Math.max(1, Math.ceil(matches.length / COLLECTION_PAGE_SIZE));
  const page = Math.min(pages - 1, Math.max(0, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0));
  return { items: matches.slice(page * COLLECTION_PAGE_SIZE, (page + 1) * COLLECTION_PAGE_SIZE), page, pages, total: matches.length };
}
