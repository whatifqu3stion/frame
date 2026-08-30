import { afterEach, describe, expect, test } from "bun:test";
import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";
import { toggleInterestId } from "../domain/interests";
import { discoveryService } from "./discovery";
import { fetchSubscriptions } from "./googleAuth";
import { getGoogleImportAvailability, isAutomaticGoogleFollowingEnabled } from "./googleImportPolicy";
import { isLiveYouTubeSearchEnabled, unavailableSearchResult } from "./searchPolicy";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Round 1 network safety", () => {
  test("interest selection never invokes search", () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => { fetchCount += 1; throw new Error("unexpected fetch"); }) as typeof fetch;
    expect(toggleInterestId([], "science", new Set(["science"]))).toEqual(["science"]);
    expect(fetchCount).toBe(0);
  });

  test("opening Today returns truthful unavailability without network work", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => { fetchCount += 1; throw new Error("unexpected fetch"); }) as typeof fetch;
    const result = await discoveryService.getTodayFeed("owner-default");
    expect(result.status).toBe("backend_allowance_unavailable");
    expect(result.items).toEqual([]);
    expect(fetchCount).toBe(0);
  });

  test("opening Discover returns truthful unavailability without network work", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => { fetchCount += 1; throw new Error("unexpected fetch"); }) as typeof fetch;
    const result = await discoveryService.getWeeklyPicks("owner-default", ["science"]);
    expect(result.status).toBe("backend_allowance_unavailable");
    expect(unavailableSearchResult()).toMatchObject({ status: "unavailable" });
    expect(fetchCount).toBe(0);
  });

  test("legacy onboarding search boundary is disabled centrally", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => { fetchCount += 1; throw new Error("unexpected fetch"); }) as typeof fetch;
    expect(FOUNDATION_CAPABILITIES.youtubeSearch).toBeFalse();
    expect(isLiveYouTubeSearchEnabled()).toBeFalse();
    expect(unavailableSearchResult()).toMatchObject({ status: "unavailable" });
    expect(fetchCount).toBe(0);
  });

  test("automatic Google following and subscription reads are disabled", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => { fetchCount += 1; throw new Error("unexpected fetch"); }) as typeof fetch;
    expect(isAutomaticGoogleFollowingEnabled()).toBeFalse();
    expect(await getGoogleImportAvailability()).toMatchObject({ ok: false });
    expect(await fetchSubscriptions("not-a-real-token")).toMatchObject({ status: "unavailable" });
    expect(fetchCount).toBe(0);
  });
});
