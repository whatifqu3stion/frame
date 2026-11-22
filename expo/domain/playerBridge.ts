export type PlayerBridgeMessage =
  | { type: "ready"; duration: number }
  | { type: "progress"; current: number; duration: number }
  | { type: "state"; state: number }
  | { type: "error"; code: number }
  | { type: "fullscreen"; isFullscreen: boolean }
  | { type: "connectivity"; isOnline: boolean }
  | { type: "shellError" };

function seconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Bridge data is untrusted: reject malformed values before they affect playback limits. */
export function parsePlayerBridgeMessage(raw: string): PlayerBridgeMessage | null {
  if (raw.length > 1_024) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const value = data as Record<string, unknown>;
    switch (value.type) {
      case "ready":
        return seconds(value.duration) ? { type: "ready", duration: value.duration } : null;
      case "progress":
        return seconds(value.current) && seconds(value.duration)
          ? { type: "progress", current: value.current, duration: value.duration } : null;
      case "state":
        return typeof value.state === "number" && [-1, 0, 1, 2, 3, 5].includes(value.state)
          ? { type: "state", state: value.state } : null;
      case "error":
        return typeof value.code === "number" && Number.isSafeInteger(value.code) && value.code >= 0
          ? { type: "error", code: value.code } : null;
      case "fullscreen":
        return typeof value.isFullscreen === "boolean" ? { type: "fullscreen", isFullscreen: value.isFullscreen } : null;
      case "connectivity":
        return typeof value.isOnline === "boolean" ? { type: "connectivity", isOnline: value.isOnline } : null;
      case "shellError": return { type: "shellError" };
      default: return null;
    }
  } catch { return null; }
}
