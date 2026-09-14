/** Session-local evidence only; never includes image URLs or profile data. */
export interface ThumbnailCleanupStatus {
  state: "not-run" | "running" | "succeeded" | "pending" | "web-unmanaged";
  attemptedAt: number | null;
  completedAt: number | null;
  diskCleared: boolean | null;
  memoryCleared: boolean | null;
}

interface CleanupDependencies {
  isWeb: boolean;
  clearDisk: () => Promise<boolean>;
  clearMemory: () => Promise<boolean>;
  now: () => number;
}

/** Coalesces lifecycle calls and attempts both caches even if either native API throws. */
export function createThumbnailCleanup(dependencies: CleanupDependencies) {
  let inFlight: Promise<void> | null = null;
  let status: ThumbnailCleanupStatus = {
    state: dependencies.isWeb ? "web-unmanaged" : "not-run",
    attemptedAt: null, completedAt: null, diskCleared: null, memoryCleared: null,
  };

  const run = (): Promise<void> => {
    if (dependencies.isWeb) return Promise.resolve();
    if (inFlight) return inFlight;
    status = { state: "running", attemptedAt: dependencies.now(), completedAt: null, diskCleared: null, memoryCleared: null };
    // Defer each invocation so synchronous native bridge errors are isolated too.
    inFlight = Promise.allSettled([
      Promise.resolve().then(dependencies.clearDisk),
      Promise.resolve().then(dependencies.clearMemory),
    ]).then(([disk, memory]) => {
      const diskCleared = disk.status === "fulfilled" && disk.value === true;
      const memoryCleared = memory.status === "fulfilled" && memory.value === true;
      const succeeded = diskCleared && memoryCleared;
      status = { ...status, state: succeeded ? "succeeded" : "pending", completedAt: dependencies.now(), diskCleared, memoryCleared };
      if (!succeeded) throw new Error("Thumbnail cleanup is pending; retry while Frame is active.");
    }).finally(() => { inFlight = null; });
    return inFlight;
  };

  return { run, getStatus: (): ThumbnailCleanupStatus => ({ ...status }) };
}
