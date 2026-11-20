import type { Video } from "../types";

/** Bound concurrent SQLite reads for large plans; retain queue order and missing entries. */
export async function loadSessionMetadata(
  ids: readonly string[], read: (id: string) => Promise<Video | null>, signal?: AbortSignal,
): Promise<(Video | null)[]> {
  const results: (Video | null)[] = [];
  for (let offset = 0; offset < ids.length; offset += 20) {
    if (signal?.aborted) throw new Error("Session metadata read cancelled");
    const batch = await Promise.all(ids.slice(offset, offset + 20).map(read));
    if (signal?.aborted) throw new Error("Session metadata read cancelled");
    results.push(...batch);
  }
  return results;
}
