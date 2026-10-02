import type { ResumePosition, VideoQueue } from "../types";

/** Only the recorded origin may resume a session. Membership and cursor must still match. */
export function resumeSession(resume: ResumePosition, sessions: readonly VideoQueue[]): VideoQueue | undefined {
  return sessions.find((session) => session.id === resume.sessionId && session.orderedVideoIds[session.currentIndex] === resume.videoId);
}
