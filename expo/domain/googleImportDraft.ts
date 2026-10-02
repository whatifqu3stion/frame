import type { FollowedChannel } from "../types";

export type GoogleImportDraft = { query: string; subscriptions: FollowedChannel[]; selectedIds: string[]; nextPageToken: string | null; totalResults: number | null; updatedAt: number };
export const IMPORT_DRAFT_MAX_AGE = 30 * 60_000;

/** Memory-only draft: never restores an old account, an expired page, or future timestamp. */
export function currentImportDraft(draft: GoogleImportDraft | undefined, now = Date.now()): GoogleImportDraft | null {
  return draft && Number.isFinite(draft.updatedAt) && draft.updatedAt <= now && now - draft.updatedAt < IMPORT_DRAFT_MAX_AGE ? draft : null;
}

export function pendingImportIds(ids: readonly string[], followedIds: ReadonlySet<string>, slots: number): Set<string> {
  return new Set([...new Set(ids)].filter((id) => !followedIds.has(id)).slice(0, Math.max(0, slots)));
}
