export type OrientationOwner = "app" | "watch" | "fullscreen";

/** Fullscreen wins while present; leaving playback restores the browsing policy. */
export function resolveOrientationLock<T>(requests: ReadonlyMap<OrientationOwner, T>, fallback: T): T {
  for (const owner of ["fullscreen", "watch", "app"] as const) {
    if (requests.has(owner)) return requests.get(owner)!;
  }
  return fallback;
}
