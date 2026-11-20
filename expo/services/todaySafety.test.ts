import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const todayScreenPath = new URL("../app/(tabs)/index.tsx", import.meta.url);
const watchScreenPath = new URL("../app/watch/[id].tsx", import.meta.url);
const sourceFeedClientPath = new URL("./sourceFeedClient.ts", import.meta.url);

describe("Today playback and network safety", () => {
  test("checks the existing daily allowance before opening playback", async () => {
    const source = await readFile(todayScreenPath.pathname, "utf8");
    expect(source).toContain("await getPlaybackAllowance(activeProfileId)");
    expect(source).toContain("if (!allowance.canPlay)");
    expect(source.indexOf("if (!allowance.canPlay)")).toBeLessThan(source.indexOf("router.push({ pathname: FRAME_PLAYBACK_ROUTE"));
    expect(source).toContain("You can still save videos, plan a session, or organize Today");
  });

  test("marks Today watched only after allowance-approved playback actually starts", async () => {
    const source = await readFile(watchScreenPath.pathname, "utf8");
    const beginIndex = source.indexOf("const status = await beginAllowancePlayback(current)");
    const approvedIndex = source.indexOf("if (!status.canPlay)", beginIndex);
    const dispositionIndex = source.indexOf('setDisposition(activeProfileId, todayPeriodKey, id, "watched"', approvedIndex);
    expect(beginIndex).toBeGreaterThan(-1);
    expect(approvedIndex).toBeGreaterThan(beginIndex);
    expect(dispositionIndex).toBeGreaterThan(approvedIndex);
    expect(source).toContain("&& !usesCachedMetadata");
  });

  test("the mobile cached-feed client has no provider, search, AI, or personal-data request path", async () => {
    const source = (await readFile(sourceFeedClientPath.pathname, "utf8")).toLowerCase();
    expect(source).toContain("/functions/v1/source-feed");
    expect(source).not.toContain("youtube.googleapis.com");
    expect(source).not.toContain("/youtube/search");
    expect(source).not.toContain("generativelanguage.googleapis.com");
    for (const privateField of ["profileid", "pin", "allowance", "viewinghistory"]) expect(source).not.toContain(privateField);
  });
});
