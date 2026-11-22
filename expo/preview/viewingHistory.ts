import { getLocalDay } from "../domain/viewingAllowance";
import type { ViewingHistory } from "../domain/viewingHistory";

/** Illustrative totals for the explicitly enabled development sample library only. */
export function previewViewingHistory(now: number): ViewingHistory {
  const date = new Date(now);
  const first = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 6);
  return { version: 1, startedAt: first.getTime(), days: Object.fromEntries([24, 42, 18, 0, 55, 31, 16].map((minutes, index) => [getLocalDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 6 + index).getTime()).key, minutes * 60_000])) };
}
