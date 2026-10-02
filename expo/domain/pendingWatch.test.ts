import { expect, test } from "bun:test";
import { pendingWatchId } from "./pendingWatch";
test("onboarding retains the video id without trusting query metadata or session context", () => {
  expect(pendingWatchId("/watch/video000001?title=Injected&savedSessionId=other")).toBe("video000001");
  for (const path of ["/settings", "/watch/short", "/watch/video000001/extra", "https://example.com/watch/video000001"]) expect(pendingWatchId(path)).toBeNull();
});
