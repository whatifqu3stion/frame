import { describe, expect, test } from "bun:test";
import { createDiscoveryService, mapWeeklyPicksClientResult } from "./discovery";
import {
  createWeeklyPicksClient,
  type WeeklyPicksClient,
  type WeeklyPicksResponse,
} from "./weeklyPicksClient";

const maintenanceResponse: WeeklyPicksResponse = {
  state: "maintenance",
  interests: [],
  message: "Weekly Picks are temporarily paused.",
};

function publishedResponse(state: "fresh" | "cached" = "fresh", pickCount: number = 1): WeeklyPicksResponse {
  return {
    state,
    interests: [{
      interestId: "tech",
      publicationPeriod: { start: "2026-08-24", end: "2026-08-30" },
      picks: Array.from({ length: pickCount }, (_, index) => ({
        order: index + 1,
        reason: "A clear public reason",
        source: {
          provider: "youtube",
          providerSourceId: `channel-${index + 1}`,
          handle: index === 0 ? "@frame" : null,
          displayName: `Source ${index + 1}`,
          description: "A public source description",
          thumbnailUrl: "https://example.com/source.jpg",
        },
        featuredMedia: {
          provider: "youtube",
          providerMediaId: `video-${index + 1}`,
          title: "A public video",
          description: "A public preview",
          thumbnailUrl: "https://example.com/video.jpg",
          publishedAt: "2026-08-29T12:00:00.000Z",
          durationSeconds: 240,
          isLivestream: false,
          isUpcomingPremiere: false,
        },
      })),
    }],
  };
}

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clientReturning(response: WeeklyPicksResponse): WeeklyPicksClient {
  return {
    async getWeeklyPicks() {
      return { status: "success", response } as const;
    },
  };
}

describe("Round 2C Weekly Picks client", () => {
  test("missing configuration makes no request", async () => {
    let fetchCount = 0;
    const client = createWeeklyPicksClient({
      fetchImpl: (async () => {
        fetchCount += 1;
        return jsonResponse(maintenanceResponse);
      }) as typeof fetch,
    });

    expect(await client.getWeeklyPicks(["tech"])).toEqual({ status: "missing_configuration" });
    expect(fetchCount).toBe(0);
  });

  test("zero interests make no request at the discovery-service boundary", async () => {
    let requestCount = 0;
    const service = createDiscoveryService({
      async getWeeklyPicks() {
        requestCount += 1;
        return { status: "success", response: maintenanceResponse };
      },
    });

    const result = await service.getWeeklyPicks("private-profile-id", []);
    expect(result).toMatchObject({ status: "success", reason: "no_interests", items: [] });
    expect(requestCount).toBe(0);
  });

  test("constructs the normalized endpoint and sends only the apikey and canonical interests", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const client = createWeeklyPicksClient({
      supabaseUrl: "https://gzzazhqlphomzjndzrfm.supabase.co///",
      publishableKey: "sb_publishable_test",
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedInit = init;
        return jsonResponse(maintenanceResponse);
      }) as typeof fetch,
    });

    expect(await client.getWeeklyPicks(["tech", "science", "tech"])).toMatchObject({ status: "success" });
    expect(capturedUrl).toBe("https://gzzazhqlphomzjndzrfm.supabase.co/functions/v1/weekly-picks");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toEqual({ "Content-Type": "application/json", apikey: "sb_publishable_test" });
    expect(JSON.parse(String(capturedInit?.body))).toEqual({ interestIds: ["tech", "science"] });
    expect(Object.keys(JSON.parse(String(capturedInit?.body)))).toEqual(["interestIds"]);
    expect(String(capturedInit?.body)).not.toContain("profile");
    expect(String(capturedInit?.body)).not.toContain("history");
    expect(String(capturedInit?.body)).not.toContain("saved");
  });

  test("rejects noncanonical interests before the network boundary", async () => {
    let fetchCount = 0;
    const client = createWeeklyPicksClient({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      fetchImpl: (async () => {
        fetchCount += 1;
        return jsonResponse(maintenanceResponse);
      }) as typeof fetch,
    });

    expect(await client.getWeeklyPicks(["photography"])).toEqual({ status: "invalid_request" });
    expect(fetchCount).toBe(0);
  });

  test("maps connectivity and timeout failures to network_error", async () => {
    const offlineClient = createWeeklyPicksClient({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      fetchImpl: (async () => { throw new Error("offline"); }) as typeof fetch,
    });
    const timeoutClient = createWeeklyPicksClient({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      timeoutMs: 5,
      fetchImpl: ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch,
    });

    expect((await createDiscoveryService(offlineClient).getWeeklyPicks("profile-a", ["tech"])).status).toBe("network_error");
    expect((await createDiscoveryService(timeoutClient).getWeeklyPicks("profile-b", ["tech"])).status).toBe("network_error");
  });

  test("maps fresh, cached, empty, maintenance, and unavailable states truthfully", async () => {
    expect((await createDiscoveryService(clientReturning(publishedResponse("fresh"))).getWeeklyPicks("p", ["tech"])).status).toBe("success");
    expect((await createDiscoveryService(clientReturning(publishedResponse("cached"))).getWeeklyPicks("p", ["tech"])).status).toBe("cached_success");
    expect(await createDiscoveryService(clientReturning({ state: "empty", interests: [], message: "Nothing current." })).getWeeklyPicks("p", ["tech"])).toMatchObject({ status: "success", reason: "empty", message: "Nothing current." });
    expect(await createDiscoveryService(clientReturning(maintenanceResponse)).getWeeklyPicks("p", ["tech"])).toMatchObject({ status: "temporarily_unavailable", reason: "maintenance" });
    expect(await createDiscoveryService(clientReturning({ state: "unavailable", interests: [] })).getWeeklyPicks("p", ["tech"])).toMatchObject({ status: "temporarily_unavailable", reason: "backend" });
  });

  test("maps authorization, request, server, and invalid-response failures calmly", () => {
    expect(mapWeeklyPicksClientResult({ status: "unauthorized" })).toMatchObject({ status: "backend_allowance_unavailable", reason: "configuration" });
    expect(mapWeeklyPicksClientResult({ status: "invalid_request" })).toMatchObject({ status: "temporarily_unavailable", reason: "backend" });
    expect(mapWeeklyPicksClientResult({ status: "http_unavailable" })).toMatchObject({ status: "temporarily_unavailable", reason: "backend" });
    expect(mapWeeklyPicksClientResult({ status: "invalid_response" })).toMatchObject({ status: "temporarily_unavailable", reason: "backend" });
  });

  test("rejects invalid JSON, malformed schema, and unexpected internal fields", async () => {
    const responses = [
      new Response("not-json", { status: 200 }),
      jsonResponse({ state: "fresh", interests: "wrong" }),
      jsonResponse({ ...publishedResponse(), internalDatabaseId: "private" }),
      jsonResponse({
        ...publishedResponse(),
        interests: [{ ...publishedResponse().interests[0], publicationPeriod: { start: "not-a-date", end: "2026-08-30" } }],
      }),
    ];

    for (const response of responses) {
      const client = createWeeklyPicksClient({
        supabaseUrl: "https://example.supabase.co",
        publishableKey: "sb_publishable_test",
        fetchImpl: (async () => response) as typeof fetch,
      });
      expect(await client.getWeeklyPicks(["tech"])).toEqual({ status: "invalid_response" });
    }
  });

  test("rejects more than three candidates for one interest", async () => {
    const client = createWeeklyPicksClient({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      fetchImpl: (async () => jsonResponse(publishedResponse("fresh", 4))) as typeof fetch,
    });
    expect(await client.getWeeklyPicks(["tech"])).toEqual({ status: "invalid_response" });
  });

  test("source-suggestion mapping exposes only the approved public fields", async () => {
    const result = await createDiscoveryService(clientReturning(publishedResponse())).getWeeklyPicks("never-transmitted-profile", ["tech"]);
    expect(result.items).toHaveLength(1);
    expect(Object.keys(result.items[0]).sort()).toEqual([
      "description",
      "displayName",
      "featuredMedia",
      "handle",
      "interestId",
      "provider",
      "providerSourceId",
      "publicationPeriod",
      "recommendationReason",
      "thumbnailUrl",
    ].sort());
    expect(result.items[0]).not.toHaveProperty("order");
    expect(result.items[0]).not.toHaveProperty("id");
    expect(JSON.stringify(result.items[0])).not.toContain("never-transmitted-profile");
  });
});
