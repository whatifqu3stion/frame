import type { TodayDisposition, TodaySnapshotItem } from "../models/today";

type FeedbackBase = { profileId: string; message: string };
export type TodayFeedback = FeedbackBase & (
  | { action: "undoDismiss"; target: { item: TodaySnapshotItem; previous: TodayDisposition; snoozedUntil: number | null } }
  | { action: "viewSaved"; target: { videoId: string } }
  | { action: "openSession"; target: { sessionId: string } }
  | { action: null; target: { videoId: string } }
);

type TodayFeedbackEvent =
  | { type: "clear" }
  | { type: "dismissed"; item: TodaySnapshotItem }
  | { type: "saved"; profileId: string; videoId: string }
  | { type: "session"; profileId: string; sessionId: string }
  | { type: "snoozed"; profileId: string; videoId: string; until: number };

// A result always replaces the whole message and action together.
export function todayFeedbackReducer(_current: TodayFeedback | null, event: TodayFeedbackEvent): TodayFeedback | null {
  switch (event.type) {
    case "clear": return null;
    case "dismissed": return {
      profileId: event.item.profileId, message: "Dismissed from Today", action: "undoDismiss",
      target: { item: event.item, previous: event.item.disposition, snoozedUntil: event.item.snoozedUntil },
    };
    case "saved": return { profileId: event.profileId, message: "Video saved", action: "viewSaved", target: { videoId: event.videoId } };
    case "session": return { profileId: event.profileId, message: "Added to session", action: "openSession", target: { sessionId: event.sessionId } };
    case "snoozed": return {
      profileId: event.profileId,
      message: `Snoozed until ${new Date(event.until).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`,
      action: null, target: { videoId: event.videoId },
    };
  }
}

export function todayFeedbackRoute(feedback: TodayFeedback): "/(tabs)/saved" | { pathname: "/session/[id]"; params: { id: string } } | null {
  if (feedback.action === "viewSaved") return "/(tabs)/saved";
  if (feedback.action === "openSession") return { pathname: "/session/[id]", params: { id: feedback.target.sessionId } };
  return null;
}
