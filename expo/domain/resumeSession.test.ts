import { expect, test } from "bun:test";
import { resumeSession } from "./resumeSession";
import type { ResumePosition, VideoQueue } from "../types";
const position: ResumePosition = { videoId: "video000001", sessionId: "evening", timestampSeconds: 30, updatedAt: 1 };
const session: VideoQueue = { id: "evening", name: "Evening", orderedVideoIds: [position.videoId, "video000002"], currentIndex: 0, updatedAt: 1 };
test("resume keeps only the recorded session when the same video appears elsewhere", () => {
  expect(resumeSession(position, [{ ...session, id: "other" }, session])).toBe(session);
});
test("a deleted session or changed cursor falls back to standalone playback", () => {
  expect(resumeSession(position, [])).toBeUndefined();
  expect(resumeSession(position, [{ ...session, currentIndex: 1 }])).toBeUndefined();
  expect(resumeSession(position, [{ ...session, orderedVideoIds: ["video000003"] }])).toBeUndefined();
});
test("legacy and standalone resumes never infer a session from matching media", () => {
  expect(resumeSession({ ...position, sessionId: null }, [session])).toBeUndefined();
});
