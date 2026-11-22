import { afterEach, describe, expect, test } from "bun:test";
import { fetchGoogleEmail, fetchSubscriptions, revokeGoogleAccess } from "./googleAuth";

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


describe("Google credential transport", () => {
  test("rejects redirects and omits ambient cookies for every credential request", async () => {
    const options: RequestInit[] = [];
    globalThis.fetch = (async (_input, init) => {
      options.push(init ?? {});
      return Response.json({ email: "test@example.com", items: [] });
    }) as typeof fetch;
    await fetchGoogleEmail("sentinel-token");
    await fetchSubscriptions("sentinel-token");
    await revokeGoogleAccess("sentinel-token");
    expect(options).toHaveLength(3);
    for (const init of options) expect(init).toMatchObject({ redirect: "error", credentials: "omit", cache: "no-store" });
  });

  test("does not disclose transport exception text in diagnostics or results", async () => {
    const originalWarn = console.warn;
    const messages: unknown[][] = [];
    console.warn = (...args: unknown[]) => { messages.push(args); };
    globalThis.fetch = (async () => { throw new Error("sentinel-token"); }) as typeof fetch;
    try {
      const results = await Promise.all([
        fetchGoogleEmail("sentinel-token"), fetchSubscriptions("sentinel-token"), revokeGoogleAccess("sentinel-token"),
      ]);
      expect(results.every((result) => result.status === "offline")).toBe(true);
      expect(JSON.stringify({ messages, results }).includes("sentinel-token")).toBe(false);
    } finally { console.warn = originalWarn; }
  });
});
