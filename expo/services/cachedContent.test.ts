import { describe, expect, test } from "bun:test";
import { createCachedContentService } from "./cachedContent";
import type { SourceFeedClientResult } from "./sourceFeedClient";

const channelId = "UCabcdefghijklmnopqrstuv";
const response: SourceFeedClientResult = {
  status: "success",
  response: { state: "stale", feeds: [{ source: { provider: "youtube", providerSourceId: channelId, displayName: "A trusted source", handle: null, thumbnailUrl: null }, freshness: "stale", items: [] }], unavailableSourceIds: [], fetchedAt: null },
  candidates: [],
};

describe("cache-only source shelves", () => {
  test("uses one bounded shared read and preserves truthful stale/empty state", async () => {
    const captured: string[][] = [];
    const service = createCachedContentService({ async getCachedFeeds(ids) { captured.push([...ids]); return response; } });
    const shelf = await service.getChannelShelf(channelId);
    expect(captured).toEqual([[channelId]]);
    expect(shelf.channel.title).toBe("A trusted source");
    expect(shelf.videos).toEqual([]);
    expect(shelf.message).toContain("cached");
  });

  test("rejects invalid IDs before any network work", async () => {
    let calls = 0;
    const service = createCachedContentService({ async getCachedFeeds() { calls++; return response; } });
    await expect(service.getChannelShelf("not-a-source")).rejects.toThrow("verified source");
    expect(calls).toBe(0);
  });

  test("throws recoverable errors rather than replacing cached query data with an empty success", async () => {
    for (const status of ["network_error", "http_unavailable", "missing_configuration", "invalid_response"] as const) {
      const service = createCachedContentService({ async getCachedFeeds() { return { status }; } });
      await expect(service.getChannelShelf(channelId)).rejects.toThrow();
    }
  });

  test("a missing source never falls back to a provider lookup", async () => {
    let calls = 0;
    const service = createCachedContentService({ async getCachedFeeds() { calls++; return { ...response, response: { state: "unavailable", feeds: [], unavailableSourceIds: [channelId], fetchedAt: null } }; } });
    await expect(service.getChannelShelf(channelId)).rejects.toThrow("No live lookup");
    expect(calls).toBe(1);
  });
});
