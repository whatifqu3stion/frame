import { getLocalDay } from "./viewingAllowance";
import { profileStorageKey, type KeyValueStorage } from "../storage/profileStorage";

export type ViewingHistory = { version: 1; startedAt: number; days: Record<string, number> };
export type ViewingDay = { key: string; date: Date; milliseconds: number | null };

export function viewingWeek(history: ViewingHistory, now: number): ViewingDay[] {
  const today = new Date(now);
  const first = getLocalDay(history.startedAt).key;
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    const key = getLocalDay(date.getTime()).key;
    return { key, date, milliseconds: key < first ? null : history.days[key] ?? 0 };
  });
}

export function formatViewingTime(milliseconds: number): string {
  if (milliseconds > 0 && milliseconds < 60_000) return "<1 min";
  const minutes = Math.floor(milliseconds / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}

function parseHistory(raw: string | null, now: number): ViewingHistory {
  if (raw === null) return { version: 1, startedAt: now, days: {} };
  const value = JSON.parse(raw) as ViewingHistory;
  if (value?.version !== 1 || !Number.isFinite(value.startedAt) || !value.days || typeof value.days !== "object" || Array.isArray(value.days)
    || Object.entries(value.days).some(([key, amount]) => !/^\d{4}-\d{2}-\d{2}$/.test(key) || getLocalDay(new Date(`${key}T12:00:00`).getTime()).key !== key || !Number.isFinite(amount) || amount < 0)) throw new Error("Viewing history is unavailable.");
  return value;
}

function prune(history: ViewingHistory, now: number): void {
  const latest = Math.max(now, ...Object.keys(history.days).map((day) => new Date(`${day}T12:00:00`).getTime()));
  const cutoff = viewingWeek(history, latest)[0].key;
  history.days = Object.fromEntries(Object.entries(history.days).filter(([day]) => day >= cutoff));
}

/** Serialized local totals, separate from playback authorization and allowance enforcement. */
export class ViewingHistoryStore {
  private operation: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: KeyValueStorage) {}
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.operation.then(work, work);
    this.operation = result.catch(() => undefined);
    return result;
  }
  read(profileId: string, now = Date.now()): Promise<ViewingHistory> {
    return this.enqueue(async () => {
      const key = profileStorageKey("viewingHistory", profileId);
      const raw = await this.storage.getItem(key);
      const history = parseHistory(raw, now);
      prune(history, now);
      if (raw !== JSON.stringify(history)) await this.storage.setItem(key, JSON.stringify(history));
      return history;
    });
  }
  record(profileId: string, from: number, to: number): Promise<void> {
    return this.enqueue(async () => {
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
      const key = profileStorageKey("viewingHistory", profileId);
      const history = parseHistory(await this.storage.getItem(key), from);
      // Split at local midnight, including 23/25-hour daylight-saving days.
      let cursor = from;
      while (cursor < to) {
        const date = new Date(cursor);
        const end = Math.min(to, new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime());
        const day = getLocalDay(cursor).key;
        history.days[day] = (history.days[day] ?? 0) + end - cursor;
        cursor = end;
      }
      // Only the recent seven calendar days are displayed or retained.
      prune(history, to);
      await this.storage.setItem(key, JSON.stringify(history));
    });
  }
}
