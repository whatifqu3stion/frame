const channelIdPattern = /^UC[A-Za-z0-9_-]{22}$/;
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export type ParsedSourceInput =
  | { kind: "channelId"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "video"; value: string }
  | { kind: "unknown"; value: string };

/** Strictly classifies only stable channel IDs, @handles, and individual YouTube video URLs. */
export function parseSourceInput(input: string): ParsedSourceInput {
  const text = input.trim();
  if (!text || text.length > 2048) return { kind: "unknown", value: text };
  if (channelIdPattern.test(text)) return { kind: "channelId", value: text };
  const directHandle = /^@([A-Za-z0-9_.-]{3,30})$/.exec(text);
  if (directHandle?.[1]) return { kind: "handle", value: directHandle[1].toLowerCase() };

  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtu.be") return { kind: "unknown", value: text };
    if (url.searchParams.has("list")) return { kind: "unknown", value: text };
    const segments = url.pathname.split("/").filter(Boolean);
    if (host === "youtu.be" && segments.length === 1 && videoIdPattern.test(segments[0] ?? "")) {
      return { kind: "video", value: segments[0] as string };
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (segments.length === 2 && segments[0] === "channel" && channelIdPattern.test(segments[1] ?? "")) {
        return { kind: "channelId", value: segments[1] as string };
      }
      if (segments.length === 1 && /^@[A-Za-z0-9_.-]{3,30}$/.test(segments[0] ?? "")) {
        return { kind: "handle", value: (segments[0] as string).slice(1).toLowerCase() };
      }
      if (segments.length === 1 && segments[0] === "watch") {
        const videoId = url.searchParams.get("v") ?? "";
        if (videoIdPattern.test(videoId)) return { kind: "video", value: videoId };
      }
      if (segments.length === 2 && (segments[0] === "shorts" || segments[0] === "embed") && videoIdPattern.test(segments[1] ?? "")) {
        return { kind: "video", value: segments[1] as string };
      }
    }
  } catch {
    return { kind: "unknown", value: text };
  }
  return { kind: "unknown", value: text };
}
