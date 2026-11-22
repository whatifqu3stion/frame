import { describe, expect, test } from "bun:test";
import { createSourceFeedClient } from "./sourceFeedClient";

const sourceA = "UCabcdefghijklmnopqrstuv";
const sourceB = "UCabcdefghijklmnopqrstu2";
const response = {
  state: "fresh",
  freshness: "fresh",
  feeds: [
    { source: { provider: "youtube", providerSourceId: sourceA, handle: null, displayName: "Alpha", thumbnailUrl: null }, freshness: "fresh", items: [{ provider: "youtube", providerMediaId: "video000001", title: "One", description: "", thumbnailUrl: "https://example.com/one.jpg", publishedAt: "2026-09-06T10:00:00.000Z", durationSeconds: 120, isLivestream: false, isUpcomingPremiere: false, madeForKids: null, fetchedAt: "2026-09-06T11:00:00.000Z" }] },
    { source: { provider: "youtube", providerSourceId: sourceB, handle: null, displayName: "Beta", thumbnailUrl: null }, freshness: "fresh", items: [] },
  ],
  unavailableSourceIds: [],
  fetchedAt: "2026-09-06T11:00:00.000Z",
};

describe("batched cached source feed client", () => {
  test("carries the older source/media fetch date and negotiates the new response shape", async () => {
    const timestamp = "2026-09-05T10:00:00.000Z";
    let header: string | null = null;
    const client = createSourceFeedClient({supabaseUrl:"https://example.supabase.co",publishableKey:"public",fetchImpl:async (_input, init) => {
      header = new Headers(init?.headers).get("x-frame-metadata");
      return Response.json({...response, feeds:response.feeds.map((feed) => ({...feed,source:{...feed.source,fetchedAt:timestamp}}))});
    }});
    const result = await client.getCachedFeeds([sourceA,sourceB]);
    expect(header).toBe("1");
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.candidates[0].fetchedAt).toBe(Date.parse(timestamp));
  });
  test("makes one bounded profile-agnostic cached read", async () => {
    let calls = 0;
    let requestBody = "";
    const client = createSourceFeedClient({ supabaseUrl: "https://example.supabase.co", publishableKey: "public", fetchImpl: async (_input, init) => { calls += 1; requestBody = String(init?.body); return Response.json(response); } });
    const result = await client.getCachedFeeds([sourceA, sourceB]);
    expect(calls).toBe(1);
    expect(JSON.parse(requestBody)).toEqual({ providerSourceIds: [sourceA, sourceB], limitPerSource: 50 });
    expect(requestBody).not.toContain("profile");
    expect(result.status).toBe("success");
    expect(result.status === "success" ? result.candidates.map((item) => item.id) : []).toEqual(["video000001"]);
  });

  test("retries a network failure once, but not HTTP failures", async () => {
    let calls = 0;
    const recovering = createSourceFeedClient({ supabaseUrl: "https://example.supabase.co", publishableKey: "public", timeoutMs: 2_000, fetchImpl: async () => { calls += 1; if (calls === 1) throw new Error("offline"); return Response.json(response); } });
    expect((await recovering.getCachedFeeds([sourceA, sourceB])).status).toBe("success");
    expect(calls).toBe(2);
    calls = 0;
    const unavailable = createSourceFeedClient({ supabaseUrl: "https://example.supabase.co", publishableKey: "public", fetchImpl: async () => { calls += 1; return new Response(null, { status: 503 }); } });
    expect((await unavailable.getCachedFeeds([sourceA])).status).toBe("http_unavailable");
    expect(calls).toBe(1);
  });

  test("rejects malformed requests and responses before persistence", async () => {
    const client = createSourceFeedClient({ supabaseUrl: "https://example.supabase.co", publishableKey: "public", fetchImpl: async () => Response.json({ ...response, feeds: [{ ...response.feeds[0], items: [{ secret: true }] }] }) });
    expect((await client.getCachedFeeds(["bad"])).status).toBe("invalid_request");
    expect((await client.getCachedFeeds([sourceA])).status).toBe("invalid_response");
  });
});
