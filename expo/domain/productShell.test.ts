import { describe, expect, test } from "bun:test";
import { DEFAULT_TAB_ROUTE, FRAME_PLAYBACK_ENTRY_PATHS, FRAME_PLAYBACK_ROUTE, LEGACY_COMPATIBILITY_ROUTES, ONBOARDING_STEPS, PLAYER_AND_RECOVERY_ROUTES, PRIMARY_TABS } from "../constants/navigation";
import { DEFAULT_OWNER_PROFILE_ID } from "../models/profile";
import { toggleInterestId } from "./interests";
import { resolveTodayShellState, shellProfileQueryKeys } from "./productShell";
import { discoveryService } from "../services/discovery";

const originalFetch = globalThis.fetch;

describe("Round 1C product shell", () => {
  test("exposes exactly four tabs with Today as the default", () => {
    expect(PRIMARY_TABS.map((tab) => tab.title)).toEqual(["Today", "Sources", "Saved", "Settings"]);
    expect(PRIMARY_TABS.map((tab) => tab.route)).toEqual(["index", "sources", "saved", "settings"]);
    expect(DEFAULT_TAB_ROUTE).toBe("index");
  });

  test("keeps player and legacy recovery routes reachable", () => {
    expect(PLAYER_AND_RECOVERY_ROUTES).toEqual(expect.arrayContaining(["/watch/[id]", "/session", "/session/[id]", "/add-to-queue"]));
    expect(LEGACY_COMPATIBILITY_ROUTES).toEqual({ explore: "/(tabs)/sources", library: "/(tabs)/saved" });
  });

  test("routes every playback origin through the centralized watch allowance boundary", () => {
    expect(FRAME_PLAYBACK_ROUTE).toBe("/watch/[id]");
    expect(FRAME_PLAYBACK_ENTRY_PATHS).toEqual(["pastedLink", "sources", "saved", "continueWatching", "today", "session", "deepLink", "resumedPlayback"]);
    expect(PLAYER_AND_RECOVERY_ROUTES[0]).toBe(FRAME_PLAYBACK_ROUTE);
  });

  test("uses the active profile for Saved, Continue Watching, and interests", () => {
    const keys = shellProfileQueryKeys(DEFAULT_OWNER_PROFILE_ID);
    expect(keys.saved).toContain(DEFAULT_OWNER_PROFILE_ID);
    expect(keys.continueWatching).toContain(DEFAULT_OWNER_PROFILE_ID);
    expect(keys.interests).toContain(DEFAULT_OWNER_PROFILE_ID);
  });

  test("supports each truthful finite Today state", () => {
    expect(resolveTodayShellState({ followedSourceCount: 0, isLoading: false, isError: false, itemCount: 0 })).toBe("no_sources");
    expect(resolveTodayShellState({ followedSourceCount: 0, isLoading: true, isError: false, itemCount: 0 })).toBe("loading");
    expect(resolveTodayShellState({ followedSourceCount: 0, isLoading: false, isError: true, itemCount: 0 })).toBe("service_error");
    expect(resolveTodayShellState({ followedSourceCount: 1, isLoading: true, isError: false, itemCount: 0 })).toBe("loading");
    expect(resolveTodayShellState({ followedSourceCount: 1, isLoading: false, isError: false, status: "network_error", itemCount: 0 })).toBe("offline");
    expect(resolveTodayShellState({ followedSourceCount: 1, isLoading: false, isError: true, itemCount: 0 })).toBe("service_error");
    expect(resolveTodayShellState({ followedSourceCount: 1, isLoading: false, isError: false, status: "backend_allowance_unavailable", itemCount: 0 })).toBe("no_qualifying_videos");
    expect(resolveTodayShellState({ followedSourceCount: 1, isLoading: false, isError: false, status: "success", itemCount: 0 })).toBe("caught_up");
  });

  test("onboarding, Today, Discover, and interest selection do not initiate search", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => { fetchCount += 1; throw new Error("unexpected fetch"); }) as typeof fetch;
    try {
      expect(ONBOARDING_STEPS).toEqual(["keys", "welcome", "source", "your-frame"]);
      expect(toggleInterestId([], "science", new Set(["science"]))).toEqual(["science"]);
      await discoveryService.getTodayFeed(DEFAULT_OWNER_PROFILE_ID);
      await discoveryService.getWeeklyPicks(DEFAULT_OWNER_PROFILE_ID, ["science"]);
      expect(fetchCount).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
