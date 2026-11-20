import { createProgressWriter } from "./progressWriter";

/** App-lifetime recovery. Failed writes survive route departure, never a data reset. */
export function createProgressRecovery() {
  type Writer = ReturnType<typeof createProgressWriter>;
  type Entry = { profileId: string; kind: "video" | "session"; writer: Writer; handle: Writer & { retain(): () => void }; users: number; pending: number; retired: boolean };
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let version = 0;
  const publish = () => { version += 1; listeners.forEach(listener => listener()); };
  const prune = (key: string, entry: Entry) => {
    if (!entry.users && !entry.pending && !entry.writer.getSnapshot().error && entries.get(key) === entry) {
      entry.retired = true;
      entries.delete(key);
    }
  };
  return {
    getWriter(profileId: string, entityId: string, kind: "video" | "session" = "video") {
      const key = JSON.stringify([profileId, kind, entityId]);
      const existing = entries.get(key);
      if (existing) return existing.handle;
      const writer = createProgressWriter();
      const track = (operation: () => Promise<void>) => {
        if (entry.retired) return Promise.resolve();
        entry.pending += 1;
        return operation().finally(() => { entry.pending -= 1; prune(key, entry); });
      };
      const entry: Entry = {
        profileId, kind, writer, users: 0, pending: 0, retired: false,
        handle: {
          ...writer,
          write: operation => track(() => writer.write(async () => { if (!entry.retired) await operation(); })),
          retry: () => track(() => writer.retry()),
          retain() {
            entry.users += 1;
            let released = false;
            return () => {
              if (released) return;
              released = true;
              entry.users -= 1;
              // Let route cleanup enqueue its final checkpoint; tolerate Strict Mode effect replay.
              setTimeout(() => prune(key, entry), 0);
            };
          },
        },
      };
      writer.subscribe(publish);
      entries.set(key, entry);
      return entry.handle;
    },
    failures(profileId: string) {
      return [...entries.values()].filter(entry => !entry.retired && entry.profileId === profileId && entry.writer.getSnapshot().error);
    },
    async retry(profileId: string) {
      await Promise.all([...entries.values()].filter(entry => entry.profileId === profileId).map(entry => entry.handle.retry()));
    },
    async discard(profileId?: string) {
      const removed = [...entries.entries()].filter(([, entry]) => profileId === undefined || entry.profileId === profileId);
      removed.forEach(([, entry]) => { entry.retired = true; });
      publish();
      // Drain writes already in storage before the caller deletes data. Retired handles cannot resurrect it.
      await Promise.all(removed.map(([, entry]) => entry.writer.flush().catch(() => {})));
      removed.forEach(([key, entry]) => { if (entries.get(key) === entry) entries.delete(key); });
      publish();
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => version,
  };
}
