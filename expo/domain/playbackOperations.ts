/** Serialize the two playback ledgers together. Stop invalidates starts immediately,
 * including a start already awaiting storage, before its queued cleanup runs. */
export function createPlaybackOperations<T>(stopLedgers: (stoppedAt: number) => Promise<T>, now: () => number = Date.now) {
  let generation = 0;
  let invalidate = () => {};
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <R,>(work: () => Promise<R>): Promise<R> => {
    const result = tail.catch(() => {}).then(work);
    tail = result.catch(() => {});
    return result;
  };
  return {
    start<R>(work: (current: () => boolean) => Promise<R>, valid: () => boolean): Promise<R | null> {
      invalidate();
      let invalidatedAt: number | undefined;
      invalidate = () => { invalidatedAt ??= now(); };
      const version = ++generation;
      const current = () => version === generation && valid();
      return enqueue(async () => {
        if (!current()) return null;
        try {
          const result = await work(current);
          if (current()) return result;
          await stopLedgers(invalidatedAt ?? now());
          return null;
        } catch (error) {
          await stopLedgers(invalidatedAt ?? now());
          throw error;
        }
      });
    },
    stop() {
      const stoppedAt = now();
      invalidate();
      generation++;
      return enqueue(() => stopLedgers(stoppedAt));
    },
    checkpoint<R>(work: () => Promise<R>) { return enqueue(work); },
  };
}
