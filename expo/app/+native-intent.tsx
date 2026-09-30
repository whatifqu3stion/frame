const WATCH_PATH = /^\/watch\/[A-Za-z0-9_-]{11}(?:\?.*)?$/;

/** Keeps valid Frame watch links intact and explains unsupported links without opening them. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (!path || path === "/") return "/";
  if (WATCH_PATH.test(path)) return path;
  try {
    const parsed = new URL(path, "https://frame.local");
    if (parsed.pathname === "/" || parsed.pathname === "") return "/";
    const candidate = `${parsed.pathname}${parsed.search}`;
    return WATCH_PATH.test(candidate) ? candidate : "/link-unavailable";
  } catch {
    return "/link-unavailable";
  }
}

