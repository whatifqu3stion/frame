import { GOOGLE_NATIVE_CALLBACK } from "../constants/googleCallback";

const WATCH_PATH = /^\/watch\/[A-Za-z0-9_-]{11}(?:\?.*)?$/;

/** Keeps valid Frame watch links intact and explains unsupported links without opening them. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (!path || path === "/") return "/";
  if (WATCH_PATH.test(path)) return path;
  try {
    const parsed = new URL(path, "https://frame.local");
    // AuthSession consumes the full callback. Keep the code and state out of navigation.
    if (parsed.href.split(/[?#]/, 1)[0] === GOOGLE_NATIVE_CALLBACK) return "/";
    if (parsed.pathname === "/" || parsed.pathname === "") return "/";
    const candidate = `${parsed.pathname}${parsed.search}`;
    return WATCH_PATH.test(candidate) ? candidate : "/link-unavailable";
  } catch {
    return "/link-unavailable";
  }
}

