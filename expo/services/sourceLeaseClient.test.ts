import { describe, expect, test } from "bun:test";
import { createSourceLeaseClient, SOURCE_LEASE_REQUEST_LIMIT } from "./sourceLeaseClient";

const item = { provider: "youtube" as const, providerSourceId: "UC-known", leaseToken: "a".repeat(64) };

function response(body: unknown, status: number = 200): Response {
  return Response.json(body, { status });
}

describe("Round 3B source lease client", () => {
  test("sends only action and bounded anonymous source fields", async () => {
    let capturedBody = "";
    let capturedHeaders: HeadersInit | undefined;
    const client = createSourceLeaseClient({
      supabaseUrl: "https://gzzazhqlphomzjndzrfm.supabase.co///",
      publishableKey: "sb_publishable_test",
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedBody = String(init?.body);
        capturedHeaders = init?.headers;
        return response({ results: [{ provider: "youtube", providerSourceId: "UC-known", status: "synced" }] });
      }) as typeof fetch,
    });

    expect(await client.reconcile("sync", [item])).toMatchObject({ status: "success" });
    expect(JSON.parse(capturedBody)).toEqual({ action: "sync", sources: [item] });
    expect(capturedHeaders).toEqual({ "Content-Type": "application/json", apikey: "sb_publishable_test" });
    for (const forbidden of ["profile", "installation", "interest", "history", "save", "progress", "analytics"]) {
      expect(capturedBody.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("rejects oversized requests before network access", async () => {
    let requests = 0;
    const client = createSourceLeaseClient({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "key",
      fetchImpl: (async () => { requests += 1; return response({}); }) as typeof fetch,
    });
    const items = Array.from({ length: SOURCE_LEASE_REQUEST_LIMIT + 1 }, (_, index) => ({
      ...item,
      providerSourceId: `UC-${index}`,
    }));
    expect(await client.reconcile("sync", items)).toEqual({ status: "invalid_request" });
    expect(requests).toBe(0);
  });

  test("maps disabled, unavailable, and offline outcomes without throwing", async () => {
    const disabledClient = createSourceLeaseClient({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "key",
      fetchImpl: (async () => response({ results: [{ provider: "youtube", providerSourceId: "UC-known", status: "disabled" }] })) as typeof fetch,
    });
    expect(await disabledClient.reconcile("sync", [item])).toEqual({
      status: "success",
      results: [{ provider: "youtube", providerSourceId: "UC-known", status: "disabled" }],
    });

    const unavailableClient = createSourceLeaseClient({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "key",
      fetchImpl: (async () => response({}, 503)) as typeof fetch,
    });
    expect(await unavailableClient.reconcile("sync", [item])).toEqual({ status: "unavailable" });

    const offlineClient = createSourceLeaseClient({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "key",
      fetchImpl: (async () => { throw new Error("offline"); }) as typeof fetch,
    });
    expect(await offlineClient.reconcile("sync", [item])).toEqual({ status: "network_error" });
  });

  test("rejects responses that leak tokens or alter source identity", async () => {
    for (const body of [
      { results: [{ provider: "youtube", providerSourceId: "UC-known", status: "synced", leaseToken: item.leaseToken }] },
      { results: [{ provider: "youtube", providerSourceId: "UC-other", status: "synced" }] },
      { results: [{ provider: "youtube", providerSourceId: "UC-known", status: "unexpected" }] },
    ]) {
      const client = createSourceLeaseClient({
        supabaseUrl: "https://example.supabase.co",
        publishableKey: "key",
        fetchImpl: (async () => response(body)) as typeof fetch,
      });
      expect(await client.reconcile("sync", [item])).toEqual({ status: "invalid_response" });
    }
  });
});
