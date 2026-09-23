import { afterEach, describe, expect, test } from "bun:test";
import { fetchSubscriptions } from "./googleAuth";

const originalFetch = globalThis.fetch;
const channelId = "UCabcdefghijklmnopqrstuv";

function subscription(id: string = channelId, title: string = "Calm Creator") {
  return {
    snippet: {
      title,
      description: "Thoughtful videos",
      resourceId: { kind: "youtube#channel", channelId: id },
      thumbnails: { high: { url: "https://example.com/avatar.jpg" } },
    },
  };
}

afterEach(() => { globalThis.fetch = originalFetch; });

describe("selective Google subscription reads", () => {
  test("requests one bounded authenticated page and maps safe source fields", async () => {
    let requestUrl = "";
    let authorization = "";
    globalThis.fetch = (async (input, init) => {
      requestUrl = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return Response.json({ nextPageToken: "NEXT_1", pageInfo: { totalResults: 75 }, items: [subscription()] });
    }) as typeof fetch;
    const result = await fetchSubscriptions("token", "PAGE_1");
    expect(result.status).toBe("success");
    expect(requestUrl).toContain("mine=true");
    expect(requestUrl).toContain("maxResults=50");
    expect(requestUrl).toContain("order=alphabetical");
    expect(requestUrl).toContain("pageToken=PAGE_1");
    expect(authorization).toBe("Bearer token");
    if (result.status === "success") {
      expect(result.data.nextPageToken).toBe("NEXT_1");
      expect(result.data.totalResults).toBe(75);
      expect(result.data.items[0]).toMatchObject({ id: channelId, title: "Calm Creator", source: "google" });
    }
  });

  test("returns partial data when malformed records are safely omitted", async () => {
    globalThis.fetch = (async () => Response.json({ items: [subscription(), { snippet: { title: "Missing ID" } }] })) as typeof fetch;
    const result = await fetchSubscriptions("token");
    expect(result.status).toBe("partial");
    if (result.status === "partial") expect(result.data.items).toHaveLength(1);
  });

  test("does not request with an invalid page token", async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; return Response.json({ items: [] }); }) as typeof fetch;
    expect((await fetchSubscriptions("token", "bad\ntoken"))).toMatchObject({ status: "invalid_request" });
    expect(calls).toBe(0);
  });

  test("distinguishes expired authorization and offline failures", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;
    expect((await fetchSubscriptions("token")).status).toBe("unauthorized");
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    expect((await fetchSubscriptions("token")).status).toBe("offline");
  });
});
