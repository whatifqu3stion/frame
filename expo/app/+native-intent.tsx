const WATCH_PATH = /^\/watch\/[A-Za-z0-9_-]{11}(?:\?.*)?$/;

/** Keeps valid Frame watch links intact and safely sends unknown links home. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (WATCH_PATH.test(path)) return path;
  try {
    const parsed = new URL(path, "https://frame.local");
    const candidate = `${parsed.pathname}${parsed.search}`;
    return WATCH_PATH.test(candidate) ? candidate : "/";
  } catch {
    return "/";
  }
}
