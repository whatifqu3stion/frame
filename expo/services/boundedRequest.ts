/** Bounds the complete request, including a stalled response body, and supports explicit cancellation. */
export async function boundedRequest<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs = 12_000, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        rejectAbort = () => reject(new Error("Request cancelled"));
        controller.signal.addEventListener("abort", rejectAbort, { once: true });
        if (controller.signal.aborted) rejectAbort();
        timer = setTimeout(() => { reject(new Error("Request timed out")); controller.abort(); }, timeoutMs);
      }),
      Promise.resolve().then(() => { if (controller.signal.aborted) throw new Error("Request cancelled"); return work(controller.signal); }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
  }
}
