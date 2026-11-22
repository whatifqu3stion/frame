/** Keeps the latest failed checkpoint retryable without breaking subsequent writes. */
export function createProgressWriter() {
  let tail = Promise.resolve();
  let failed: (() => Promise<void>) | null = null;
  let snapshot = { error: false, retrying: false };
  const listeners = new Set<() => void>();
  const publish = (error: boolean, retrying: boolean) => {
    if (snapshot.error === error && snapshot.retrying === retrying) return;
    snapshot = { error, retrying }; listeners.forEach(listener => listener());
  };
  const execute = async (operation: () => Promise<void>) => {
    try { await operation(); failed = null; publish(false, false); }
    catch { failed = operation; publish(true, false); }
  };
  const write = (operation: () => Promise<void>) => {
    tail = tail.then(() => execute(operation));
    return tail;
  };
  return {
    write,
    retry() {
      if (!failed || snapshot.retrying) return tail;
      publish(true, true);
      tail = tail.then(async () => {
        if (failed) await execute(failed);
        else publish(false, false);
      });
      return tail;
    },
    async flush() { await tail; if (failed) throw new Error("Progress could not be saved"); },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
