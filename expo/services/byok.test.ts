import { DEFAULT_DISCOVERY_BRIEF } from "../domain/discoveryBrief";
import { profileStorageKey } from "../storage/profileStorage";
import { createCustomInterest } from "../domain/interests";
import { describe, expect, test } from "bun:test";
import { createProviderKeyStore, providerKeyName } from "../storage/providerKeys";
import { createProviderTransport, ProviderError } from "./providerRequest";
import { createByokYouTube } from "./byokYouTube";
import { createByokWeeklyPicks, parseGeminiDraft } from "./byokWeeklyPicks";
import { pruneByokPicks } from "./byokRetention";
import { mapWeeklyPicksClientResult, weeklyPickToSourceResolution } from "./discovery";

const fakeKey = "test-only-credential-not-a-real-key";
const channelId = "UCabcdefghijklmnopqrstuv";
const videoId = "abcdefghijk";
const channelItem = { id: channelId, snippet: { title: "Science source", description: "Verified description", customUrl: "@science", thumbnails: { default: { url: "https://yt3.ggpht.com/test.jpg" } } }, contentDetails: { relatedPlaylists: { uploads: "UUabcdefghijklmnopqrstuv" } } };
const videoItem = { id: videoId, snippet: { title: "A video", channelId, publishedAt: "2026-10-19T12:00:00Z", liveBroadcastContent: "none" }, contentDetails: { duration: "PT10M15S" }, status: { madeForKids: false } };
const source = { provider: "youtube" as const, providerSourceId: channelId, displayName: "Science source", handle: "@science", description: "Verified description", thumbnailUrl: null };
function fixture(available = true) {
  const data = new Map<string, string>();
  const storage = { async getItemAsync(key: string) { return data.get(key) ?? null; }, async setItemAsync(key: string, value: string) { data.set(key, value); }, async deleteItemAsync(key: string) { data.delete(key); } };
  return { data, storage, keys: createProviderKeyStore(storage, async () => available) };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const draftResponse = (drafts: unknown) => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(drafts) }] } }] });
const sampleVideos = [0, 1, 2].map((index) => ({ provider: "youtube" as const, providerMediaId: `abcdefghij${index}`, title: `Explaining experiment ${index}`, description: "Methods and practical demonstrations", durationSeconds: 600, thumbnailUrl: null, publishedAt: "2026-10-19T12:00:00Z", isLivestream: false, isUpcomingPremiere: false, madeForKids: null }));
const inspect = async () => ({ sourceId: channelId, sampledCount: 3, videos: sampleVideos, fetchedAt: Date.now() });
const review = { decision: "recommend", confidence: "high", reason: "Learn experimental methods through worked demonstrations.", valuableVideoIds: sampleVideos.map((video) => video.providerMediaId), concerns: [] };
const drafts = [{ interestId: "science", handle: "@science", reason: "Science explainers" }];

describe("BYOK credential lifecycle", () => {
  test("stores providers separately and exposes only presence to UI", async () => {
    const { keys, data } = fixture();
    await keys.save("youtube", fakeKey);
    await keys.save("gemini", `${fakeKey}-gemini`);
    expect(data.get(providerKeyName("youtube"))).toBe(fakeKey);
    expect(await keys.status()).toEqual({ available: true, youtube: true, gemini: true });
    expect(JSON.stringify(await keys.status())).not.toContain(fakeKey);
    await keys.remove("youtube");
    expect(await keys.read("youtube")).toBeNull();
    expect(await keys.read("gemini")).toBe(`${fakeKey}-gemini`);
    await keys.clear();
    expect(data.size).toBe(0);
  });
  test("unavailable secure storage has no fallback", async () => {
    const { keys, data } = fixture(false);
    await expect(keys.save("youtube", fakeKey)).rejects.toThrow("native app");
    expect(data.size).toBe(0);
    expect(await keys.status()).toEqual({ available: false, youtube: false, gemini: false });
  });
  test("failed writes preserve the old key and reset fails on deletion failure", async () => {
    const { storage, data } = fixture();
    data.set(providerKeyName("youtube"), fakeKey);
    const keys = createProviderKeyStore({ ...storage, async setItemAsync() { throw new Error("locked"); }, async deleteItemAsync() { throw new Error("locked"); } }, async () => true);
    await expect(keys.save("youtube", `${fakeKey}-new`)).rejects.toThrow();
    expect(await keys.read("youtube")).toBe(fakeKey);
    await expect(keys.clear()).rejects.toThrow();
  });
  test("serializes save then erase so a late write cannot resurrect the credential", async () => {
    const { keys, data } = fixture();
    await Promise.all([keys.save("youtube", fakeKey), keys.clear()]);
    expect(data.size).toBe(0);
  });
  test("preserves a dotted AI Studio authorization key through secure storage", async () => {
    const { keys } = fixture();
    const authKey = "AQ." + "synthetic-test-data_".repeat(15);
    await keys.save("gemini", authKey);
    expect(await keys.read("gemini")).toBe(authKey);
    await expect(keys.save("youtube", authKey)).rejects.toThrow();
    await expect(keys.save("gemini", authKey + "\r\nheader")).rejects.toThrow();
  });
  test("rejects URLs, whitespace, and header injection before writing", async () => {
    const { keys, data } = fixture();
    for (const key of ["https://bad.example/key", "bad\r\nAuthorization: value", "too-short"]) await expect(keys.save("youtube", key)).rejects.toThrow();
    expect(data.size).toBe(0);
  });
});

describe("BYOK network boundary", () => {
  test("Gemini HTTP failures identify the status without exposing raw errors or retrying", async () => {
    for (const [status, kind] of [[400, "request"], [401, "access"], [402, "billing"], [403, "access"], [404, "unavailable"], [429, "quota"], [500, "unavailable"], [503, "unavailable"]] as const) {
      const { keys } = fixture(); await keys.save("gemini", fakeKey);
      let calls = 0;
      const transport = createProviderTransport(keys, async () => { calls++; return json({ error: { message: fakeKey, errors: "malformed" } }, status); });
      const error = await transport.gemini("gemini-3.5-flash-lite", {}).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ kind, provider: "gemini", httpStatus: status });
      expect(String(error)).toContain(`Gemini (HTTP ${status})`);
      expect(String(error)).not.toContain(fakeKey);
      expect(JSON.stringify(error)).not.toContain(fakeKey);
      expect(calls).toBe(1);
    }
  });
  test("recognizing a Gemini key does not imply generation access", async () => {
    const { keys } = fixture(); await keys.save("gemini", fakeKey);
    const requests: string[] = [];
    const transport = createProviderTransport(keys, async (url) => {
      requests.push(String(url));
      return String(url).includes(":generateContent") ? json({ error: { message: fakeKey } }, 403) : json({ name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] });
    });
    await transport.validateGemini(fakeKey);
    expect(requests[0]).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite");
    await expect(transport.gemini("gemini-3.5-flash-lite", {})).rejects.toMatchObject({ kind: "access", provider: "gemini", httpStatus: 403 });
    expect(requests).toHaveLength(2);
  });
  test("routes each key only to its provider and keeps credentials out of URLs/body", async () => {
    const { keys } = fixture();
    await keys.save("youtube", fakeKey); await keys.save("gemini", `${fakeKey}-gemini`);
    const requests: { url: string; init: RequestInit }[] = [];
    const transport = createProviderTransport(keys, (async (url, init) => { requests.push({ url: String(url), init: init! }); return json({ items: [] }); }) as typeof fetch);
    await transport.youtube("channels", { part: "snippet", id: channelId });
    await transport.gemini("gemini-3.5-flash-lite", { contents: [] });
    expect(requests.map((r) => new URL(r.url).hostname)).toEqual(["www.googleapis.com", "generativelanguage.googleapis.com"]);
    expect(new Headers(requests[0].init.headers).get("x-goog-api-key")).toBe(fakeKey);
    expect(new Headers(requests[1].init.headers).get("x-goog-api-key")).toBe(`${fakeKey}-gemini`);
    for (const request of requests) {
      expect(request.url).not.toContain(fakeKey); expect(request.init.body ?? "").not.toContain(fakeKey);
      expect(request.init.redirect).toBe("error"); expect(request.init.credentials).toBe("omit");
    }
    expect(() => transport.gemini("../../evil", {})).toThrow();
    expect(() => transport.youtube("channels", { key: fakeKey })).toThrow();
  });
  test("missing keys make zero requests; raw provider errors never escape; no retries", async () => {
    const { keys } = fixture(); let calls = 0;
    const transport = createProviderTransport(keys, (async () => { calls++; return json({ error: { message: fakeKey } }, 403); }) as typeof fetch);
    await expect(transport.youtube("channels", {})).rejects.toMatchObject({ kind: "missing_key" }); expect(calls).toBe(0);
    await keys.save("youtube", fakeKey);
    try { await transport.youtube("channels", {}); } catch (error) { expect(error).toBeInstanceOf(ProviderError); expect(String(error)).not.toContain(fakeKey); }
    expect(calls).toBe(1);
  });
  test("key removal aborts a stalled request and suppresses its late body", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    let signal: AbortSignal | undefined;
    const transport = createProviderTransport(keys, (async (_url, init) => { signal = init?.signal as AbortSignal; started(); return { ok: true, json: () => new Promise(() => {}) } as Response; }) as typeof fetch);
    const result = transport.youtube("channels", {}).catch((error: ProviderError) => error);
    await ready; await keys.remove("youtube");
    expect(signal?.aborted).toBeTrue(); expect(await result).toMatchObject({ kind: "cancelled" });
  });
  test("pre-cancellation and malicious model paths cannot send a key", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    let calls = 0;
    const transport = createProviderTransport(keys, (async () => { calls++; return json({}); }) as typeof fetch);
    const controller = new AbortController(); controller.abort();
    await expect(transport.youtube("channels", {}, controller.signal)).rejects.toMatchObject({ kind: "cancelled" }); expect(calls).toBe(0);
  });
});

describe("direct YouTube metadata", () => {
  test("resolves a video to a verified channel; rejects arbitrary URLs without requests", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); const paths: string[] = [];
    const transport = createProviderTransport(keys, (async (url) => { paths.push(new URL(String(url)).pathname); return json({ items: paths.at(-1)?.endsWith("videos") ? [videoItem] : [channelItem] }); }) as typeof fetch);
    const youtube = createByokYouTube(transport, keys);
    expect(await youtube.resolve("https://evil.example/?key=test")).toMatchObject({ status: "invalid_request" }); expect(paths.length).toBe(0);
    expect(await youtube.resolve(`https://youtu.be/${videoId}`)).toMatchObject({ status: "success", data: { source: { providerSourceId: channelId }, video: { durationSeconds: 615, madeForKids: false }, provenance: "provider" } });
    expect(paths).toEqual(["/youtube/v3/videos", "/youtube/v3/channels"]);
  });
  test("hydrates bounded feeds, deduplicates simultaneous reads, and clears cache on key removal", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); let calls = 0;
    const transport = createProviderTransport(keys, (async (url) => {
      calls++; const path = new URL(String(url)).pathname;
      return json({ items: path.endsWith("channels") ? [channelItem] : path.endsWith("playlistItems") ? [{ contentDetails: { videoId } }] : [videoItem] });
    }) as typeof fetch);
    const youtube = createByokYouTube(transport, keys);
    const [first, second] = await Promise.all([youtube.getCachedFeeds([channelId]), youtube.getCachedFeeds([channelId])]);
    expect(first).toMatchObject({ status: "success", candidates: [{ id: videoId, durationSeconds: 615, sourceId: channelId }] }); expect(second.status).toBe("success"); expect(calls).toBe(3);
    await youtube.getCachedFeeds([channelId]); expect(calls).toBe(3);
    await youtube.getCachedFeeds([channelId], true); expect(calls).toBe(6);
    await keys.remove("youtube"); expect(await youtube.getCachedFeeds([channelId])).toMatchObject({ status: "missing_configuration", message: new ProviderError("missing_key", "youtube").message }); expect(calls).toBe(6);
  });
  test("rejects wrong channel identity and unsafe thumbnail URLs", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    const transport = createProviderTransport(keys, (async () => json({ items: [{ ...channelItem, snippet: { ...channelItem.snippet, thumbnails: { default: { url: "https://evil.example/track" } } } }] })) as typeof fetch);
    const youtube = createByokYouTube(transport, keys);
    expect(await youtube.resolve("@science")).toMatchObject({ status: "success", data: { source: { thumbnailUrl: null } } });
    expect(await youtube.resolve("UC0000000000000000000000")).toMatchObject({ status: "temporarily_unavailable" });
  });
});

describe("explicit Gemini generation", () => {
  test("YouTube verification failures are not all mislabeled as rejected access", async () => {
    for (const [failure, kind] of [["quota", "quota"], ["network", "network"], ["access", "access"], ["invalid_response", "unavailable"]] as const) {
      const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
      let calls = 0; let writes = 0; let inspections = 0;
      const transport = createProviderTransport(keys, async (url) => {
        calls++;
        if (String(url).includes("generativelanguage.googleapis.com")) return json(draftResponse(drafts));
        if (failure === "network") throw new Error(fakeKey);
        if (failure === "invalid_response") return json({ items: null });
        return json({ error: { message: fakeKey, errors: [{ reason: failure === "quota" ? "quotaExceeded" : "forbidden" }] } }, 403);
      });
      const youtube = createByokYouTube(transport, keys);
      const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() { writes++; } }, youtube.resolve, async () => { inspections++; return inspect(); });
      const error = await client.generate(["science"]).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ kind, provider: "youtube" });
      expect(String(error)).toContain("YouTube:");
      expect(String(error)).not.toContain(fakeKey);
      expect(calls).toBe(2);
      expect(inspections).toBe(0);
      expect(writes).toBe(0);
    }
  });
  test("reads spend no quota; generation verifies sources and reuses the weekly result", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    const stored = new Map<string, string>(); let calls = 0; const resolved: string[] = []; let requestBody = "";
    const transport = createProviderTransport(keys, (async (_url, init) => { calls++; requestBody = String(init?.body); return json(draftResponse(calls === 1 ? drafts : review)); }) as typeof fetch);
    const client = createByokWeeklyPicks(transport, keys, { async getItem(key) { return stored.get(key) ?? null; }, async setItem(key, value) { stored.set(key, value); } }, async (handle) => { resolved.push(handle); return { status: "success", data: { source, provenance: "provider" } }; }, inspect);
    expect(await client.getWeeklyPicks(["science"])).toEqual({ status: "missing_configuration" }); expect(calls).toBe(0);
    const stages: string[] = [];
    await client.generate(["science"], undefined, undefined, (stage) => stages.push(stage));
    expect(stages).toEqual(["suggestions", "verification", "sample", "review", "save"]);
    expect(calls).toBe(2); expect(resolved).toEqual(["@science"]);
    const result = await client.getWeeklyPicks(["science"]);
    expect(result).toMatchObject({ status: "success", response: { state: "cached", interests: [{ picks: [{ source }] }] } });
    expect(weeklyPickToSourceResolution(mapWeeklyPicksClientResult(result).items[0]).fetchedAt).toBeGreaterThan(0);
    await client.generate(["science"]); expect(calls).toBe(2);
    expect(requestBody).not.toContain(fakeKey); expect(requestBody).not.toContain("profileId"); expect(JSON.stringify([...stored])).not.toContain(fakeKey);
  });
  test("unverified and malformed model output never becomes a source", () => {
    expect(() => parseGeminiDraft(draftResponse([{ ...drafts[0], handle: "https://evil.example" }]), ["science"])).toThrow();
    expect(() => parseGeminiDraft(draftResponse([{ ...drafts[0], interestId: "unknown" }]), ["science"])).toThrow();
    expect(parseGeminiDraft(draftResponse([null, { ...drafts[0], handle: "https://evil.example" }, ...drafts, ...drafts]), ["science"])).toEqual(drafts);
    expect(() => parseGeminiDraft({ candidates: [{ finishReason: "MAX_TOKENS" }] }, ["science"])).toThrow();
  });
  test("missing keys never generate and cancelled verification never persists", async () => {
    const { keys } = fixture(); let calls = 0; let writes = 0;
    const transport = createProviderTransport(keys, (async () => { calls++; return json(draftResponse(drafts)); }) as typeof fetch);
    const controller = new AbortController();
    const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() { writes++; } }, async () => { controller.abort(); return { status: "success", data: { source, provenance: "provider" } }; }, inspect);
    await expect(client.generate(["science"])).rejects.toMatchObject({ kind: "missing_key" }); expect(calls).toBe(0);
    await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    await expect(client.generate(["science"], controller.signal)).rejects.toMatchObject({ kind: "cancelled" }); expect(calls).toBe(1); expect(writes).toBe(0);
  });
  test("concurrent generation is rejected and failures are not retried automatically", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    let calls = 0;
    const transport = createProviderTransport(keys, (async () => { calls++; return json({}, 429); }) as typeof fetch);
    const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() {} }, async () => ({ status: "not_found", message: "Unavailable" }), inspect);
    const results = await Promise.allSettled([client.generate(["science"]), client.generate(["science"])]);
    expect(results.every((result) => result.status === "rejected")).toBeTrue(); expect(calls).toBe(1);
    await expect(client.generate(["science"])).rejects.toThrow("Wait a minute"); expect(calls).toBe(1);
  });
  test("unknown, uncertain, and fabricated-evidence candidates stay empty without automatic refill", async () => {
    for (const mode of ["unknown", "uncertain", "invented", "concern"]) {
      const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
      const stored = new Map<string, string>(); let calls = 0;
      const verdict = mode === "uncertain" ? { ...review, confidence: "medium" } : mode === "invented" ? { ...review, valuableVideoIds: ["invented000", ...review.valuableVideoIds] } : mode === "concern" ? { ...review, concerns: ["Sales funnel with unsupported claims"] } : review;
      const transport = createProviderTransport(keys, (async () => { calls++; return json(draftResponse(calls === 1 ? drafts : verdict)); }) as typeof fetch);
      const client = createByokWeeklyPicks(transport, keys, { async getItem(key) { return stored.get(key) ?? null; }, async setItem(key, value) { stored.set(key, value); } }, async () => ({ status: "success", data: { source, provenance: "provider" } }), async () => ({ ...await inspect(), ...(mode === "short-heavy" ? { sampledCount: 12 } : {}), ...(mode === "unknown" ? { videos: sampleVideos.map((video) => ({ ...video, durationSeconds: null })) } : {}) }));
      await client.generate(["science"]);
      expect(await client.getWeeklyPicks(["science"])).toMatchObject({ status: "success", response: { state: "empty", interests: [] } });
      expect(calls).toBe(["short-heavy", "unknown"].includes(mode) ? 1 : 2);
      expect(await client.canRetryEmpty()).toBeTrue();
      await expect(client.generate(["science"])).rejects.toThrow(); // Cooldown still applies to the explicit recovery.
      expect(calls).toBe(["short-heavy", "unknown"].includes(mode) ? 1 : 2);
    }
  });
  test("custom and unlimited interests stay profile-local and cannot refresh an issued week", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    let clock = Date.now(); let calls = 0; const requests: { contents: { parts: { text: string }[] }[] }[] = []; const stored = new Map<string, string>();
    const precise = createCustomInterest("Japanese timber framing");
    const transport = createProviderTransport(keys, (async (_url, init) => {
      calls++; const body = JSON.parse(String(init?.body)); requests.push(body);
      return json(draftResponse(calls % 2 === 1 ? [{ ...drafts[0], interestId: JSON.parse(body.contents[0].parts[0].text).interests[0].id }] : review));
    }) as typeof fetch);
    const client = createByokWeeklyPicks(transport, keys, { async getItem(key) { return stored.get(key) ?? null; }, async setItem(key, value) { stored.set(key, value); } }, async () => ({ status: "success", data: { source, provenance: "provider" } }), async () => ({ ...await inspect(), fetchedAt: clock }), () => clock);
    const briefKey = profileStorageKey("discoveryBrief", "profile-a");
    const brief = "Prefer demonstrations filmed in a working studio.";
    stored.set(briefKey, brief);
    await client.generate([precise.id], undefined, "profile-a");
    expect(JSON.parse(requests[0].contents[0].parts[0].text).discoveryBrief).toBe(brief);
    expect(JSON.stringify(requests[1])).not.toContain(brief);
    stored.delete(briefKey);
    expect(JSON.parse(requests[0].contents[0].parts[0].text).interests).toEqual([{ id: precise.id, name: precise.name }]);
    expect(await client.getWeeklyPicks([precise.id], "profile-a")).toMatchObject({ status: "success", response: { interests: [{ interestId: precise.id }] } });
    expect(await client.getWeeklyPicks([precise.id], "profile-b")).toEqual({ status: "missing_configuration" });
    const many = Array.from({ length: 100 }, (_, index) => createCustomInterest(`Specialist subject ${index}`).id);
    await client.generate(many, undefined, "profile-a");
    expect(calls).toBe(2);
    clock += 7 * 86_400_000;
    await client.generate(many, undefined, "profile-a");
    expect(calls).toBe(4);
    expect(JSON.parse(requests[2].contents[0].parts[0].text).discoveryBrief).toBe(DEFAULT_DISCOVERY_BRIEF);
    expect(JSON.parse(requests[2].contents[0].parts[0].text).interests).toHaveLength(12);
    expect(JSON.stringify(requests)).not.toContain("profile-a");
  });
  test("legacy or incomplete cached recommendations cannot bypass current quality admission", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    const stored = new Map<string, string>(); let calls = 0;
    const transport = createProviderTransport(keys, (async () => { calls++; return json(draftResponse(calls === 1 ? drafts : review)); }) as typeof fetch);
    const client = createByokWeeklyPicks(transport, keys, { async getItem(key) { return stored.get(key) ?? null; }, async setItem(key, value) { stored.set(key, value); } }, async () => ({ status: "success", data: { source, provenance: "provider" } }), inspect);
    await client.generate(["science"]);
    const [key, raw] = [...stored][0];
    for (const mode of ["legacy", "missing-example", "short-example"]) {
      const data = JSON.parse(raw);
      if (mode === "legacy") delete data.policyVersion;
      if (mode === "missing-example") delete data.response.interests[0].picks[0].featuredMedia;
      if (mode === "short-example") data.response.interests[0].picks[0].featuredMedia.durationSeconds = 60;
      stored.set(key, JSON.stringify(data));
      expect(await client.getWeeklyPicks(["science"])).toEqual({ status: "missing_configuration" });
    }
    expect(calls).toBe(2);
  });
  test("cancellation during quality review never publishes partial results", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    const controller = new AbortController(); let calls = 0; let writes = 0;
    const transport = createProviderTransport(keys, (async () => { calls++; if (calls === 2) controller.abort(); return json(draftResponse(calls === 1 ? drafts : review)); }) as typeof fetch);
    const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() { writes++; } }, async () => ({ status: "success", data: { source, provenance: "provider" } }), inspect);
    await expect(client.generate(["science"], controller.signal)).rejects.toMatchObject({ kind: "cancelled" });
    expect(writes).toBe(0);
  });
  test("discovery inspection keeps short and unknown evidence, excludes foreign IDs, and bounds repeated page tokens", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    const requests: URL[] = [];
    const transport = createProviderTransport(keys, (async (url) => {
      const request = new URL(String(url)); requests.push(request);
      if (request.pathname.endsWith("/channels")) return json({ items: [channelItem] });
      if (request.pathname.endsWith("/playlistItems")) return json({ items: sampleVideos.map((video) => ({ contentDetails: { videoId: video.providerMediaId } })), nextPageToken: "more" });
      return json({ items: sampleVideos.map((video, index) => ({ ...videoItem, id: video.providerMediaId, snippet: { ...videoItem.snippet, channelId: index === 2 ? "foreign" : channelId }, contentDetails: { duration: index === 0 ? "PT1M" : "bad" } })) });
    }) as typeof fetch);
    const sample = await createByokYouTube(transport, keys).inspectDiscoverySource(channelId);
    expect(sample.sampledCount).toBe(6);
    expect(sample.videos.map((video) => video.durationSeconds)).toEqual([60, null]);
    expect(requests).toHaveLength(5);
    expect(requests[1].searchParams.get("maxResults")).toBe("12");
    expect(requests[3].searchParams.get("pageToken")).toBe("more");
    expect(requests.every((request) => !request.pathname.endsWith("/search"))).toBeTrue();
  });
  test("expired AI metadata is removed without touching keys or library data", async () => {
    const data = new Map([
      ["frame.byok.weekly.old.v1", JSON.stringify({ period: "2026-10-12" })],
      ["frame.byok.weekly.current.v1", JSON.stringify({ period: "2026-10-19" })],
      ["frame.byok.weekly.broken.v1", "broken"],
      ["frame.profile.expired.generatedPicks.v1", JSON.stringify({ period: "2026-10-12" })],
      ["frame.library", "library"],
      [providerKeyName("youtube"), fakeKey],
    ]);
    await pruneByokPicks({ async getAllKeys() { return [...data.keys()]; }, async getItem(key) { return data.get(key) ?? null; }, async removeItem(key) { data.delete(key); } }, Date.parse("2026-10-20T12:00:00Z"));
    expect([...data.keys()]).toEqual(["frame.byok.weekly.current.v1", "frame.library", providerKeyName("youtube")]);
  });
});

describe("discovery resilience and safe diagnostics", () => {
  test("requests bounded structured output while keeping local quality checks", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    const bodies: { generationConfig: { responseMimeType: string; responseJsonSchema: Record<string, unknown> } }[] = [];
    const transport = createProviderTransport(keys, async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return json(draftResponse(bodies.length === 1 ? drafts : review)); });
    const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() {} }, async () => ({ status: "success", data: { source, provenance: "provider" } }), inspect);
    await client.generate(["science"]);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].generationConfig).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: { type: "array", maxItems: 24, items: { properties: { interestId: { enum: ["science"] } } } } });
    expect(bodies[1].generationConfig.responseJsonSchema).toMatchObject({ additionalProperties: false, required: ["decision", "confidence", "reason", "valuableVideoIds", "concerns"] });
  });
  test("late provider failures retain only reviewed picks without retries or refill", async () => {
    for (const failureStage of ["verification", "sample", "review", "malformed-review"] as const) {
      const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
      const stored = new Map<string, string>(); let calls = 0; let resolutions = 0; let inspections = 0;
      const transport = createProviderTransport(keys, async () => {
        calls++;
        if (calls === 3 && failureStage === "malformed-review") return json({ candidates: [{ finishReason: "STOP", content: { parts: [null] } }] });
        return calls === 3 ? json({ error: { message: fakeKey } }, 429) : json(draftResponse(calls === 1 ? [...drafts, { ...drafts[0], handle: "@second" }] : review));
      });
      const client = createByokWeeklyPicks(transport, keys, { async getItem(key) { return stored.get(key) ?? null; }, async setItem(key, value) { stored.set(key, value); } }, async () => {
        resolutions++;
        if (resolutions === 2 && failureStage === "verification") return { status: "unauthorized", message: fakeKey };
        return { status: "success", data: { source: { ...source, providerSourceId: resolutions === 1 ? channelId : "UCzyxwvutsrqponmlkjihgfed" }, provenance: "provider" } };
      }, async (sourceId) => {
        if (++inspections === 2 && failureStage === "sample") throw new ProviderError("network", "youtube");
        return { ...await inspect(), sourceId };
      });
      await client.generate(["science"], undefined, "profile-a");
      const result = await client.getWeeklyPicks(["science"], "profile-a");
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("Missing partial edition");
      expect(result.response.interests.flatMap((group) => group.picks)).toHaveLength(1);
      expect(result.response.message).toContain("Saved the fully reviewed picks");
      expect(result.response.message).toContain(failureStage === "malformed-review" ? "Gemini: The provider returned incomplete data" : failureStage === "review" ? "Gemini (HTTP 429)" : "YouTube:");
      expect(result.response.message).not.toContain(fakeKey);
      expect(await client.canRetryEmpty("profile-a")).toBeFalse();
      await client.generate(["science"], undefined, "profile-a");
      expect(calls).toBe(failureStage === "review" || failureStage === "malformed-review" ? 3 : 2);
      expect(await client.getWeeklyPicks(["science"], "profile-b")).toEqual({ status: "missing_configuration" });
    }
  });
  test("cancellation or key changes after an accepted pick never save partial work", async () => {
    for (const cancelBy of ["signal", "key"]) {
      const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
      const controller = new AbortController(); let calls = 0; let resolutions = 0; let writes = 0;
      const transport = createProviderTransport(keys, async () => json(draftResponse(++calls === 1 ? [...drafts, { ...drafts[0], handle: "@second" }] : review)));
      const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() { writes++; } }, async () => {
        if (++resolutions === 2) {
          if (cancelBy === "signal") controller.abort(); else await keys.remove("gemini");
          throw new ProviderError("network", "youtube");
        }
        return { status: "success", data: { source, provenance: "provider" } };
      }, inspect);
      await expect(client.generate(["science"], controller.signal)).rejects.toMatchObject({ kind: "cancelled" });
      expect(writes).toBe(0); expect(calls).toBe(2);
    }
  });
  test("first-request errors identify stage, model and HTTP status without caching an empty edition", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    let writes = 0;
    const transport = createProviderTransport(keys, async () => json({ error: { message: fakeKey } }, 400));
    const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() { writes++; } }, async () => ({ status: "not_found", message: "Unavailable" }), inspect);
    const error = await client.generate(["science"]).catch((error: unknown) => error);
    expect(error).toMatchObject({ kind: "request", provider: "gemini", httpStatus: 400, stage: "suggestions" });
    expect(String(error)).toContain("Suggesting sources"); expect(String(error)).toContain("gemini-3.5-flash-lite");
    expect(String(error)).not.toContain(fakeKey); expect(writes).toBe(0);
  });
  test("local save errors do not blame provider keys or leak raw exceptions", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    let calls = 0;
    const transport = createProviderTransport(keys, async () => json(draftResponse(++calls === 1 ? drafts : review)));
    const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() { throw new Error(fakeKey); } }, async () => ({ status: "success", data: { source, provenance: "provider" } }), inspect);
    const error = await client.generate(["science"]).catch((error: unknown) => error);
    expect(String(error)).toContain("read or save discovery"); expect(String(error)).not.toContain(fakeKey);
  });
  test("invalid JSON transport responses are data failures, not network or access failures", async () => {
    const { keys } = fixture(); await keys.save("gemini", fakeKey);
    const transport = createProviderTransport(keys, async () => new Response("not JSON", { status: 200 }));
    await expect(transport.gemini("gemini-3.5-flash-lite", {})).rejects.toMatchObject({ kind: "invalid_response", provider: "gemini", httpStatus: 200 });
  });
  test("thought text is not parsed as a recommendation", () => {
    const value = draftResponse(drafts);
    value.candidates[0].content.parts.unshift({ text: "private reasoning", thought: true } as { text: string });
    expect(parseGeminiDraft(value, ["science"])).toEqual(drafts);
  });
  test("malformed provider envelopes consistently produce typed data errors", () => {
    for (const parts of [null, {}, [null], ["text"], []]) {
      expect(() => parseGeminiDraft({ candidates: [{ finishReason: "STOP", content: { parts } }] }, ["science"])).toThrow(ProviderError);
    }
  });
  test("rejected reviews remain bounded to 25 Gemini requests per attempt", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    let calls = 0;
    const candidates = Array.from({ length: 24 }, (_, index) => ({ ...drafts[0], handle: `@creator${index}` }));
    const transport = createProviderTransport(keys, async () => json(draftResponse(++calls === 1 ? candidates : { ...review, decision: "reject" })));
    const client = createByokWeeklyPicks(transport, keys, { async getItem() { return null; }, async setItem() {} }, async (handle) => ({ status: "success", data: { source: { ...source, providerSourceId: `UC${handle.slice(1).padEnd(22, "a")}` }, provenance: "provider" } }), async (sourceId) => ({ ...await inspect(), sourceId }));
    await client.generate(["science"]);
    expect(calls).toBe(25);
  });
});

describe("personal channel search boundaries", () => {
  test("transport rejects global video search, mixed results, empty queries, and extra search controls before network", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    let calls = 0;
    const transport = createProviderTransport(keys, async () => { calls++; return json({ items: [] }); });
    const invalidRequests: Record<string, string>[] = [
      { part: "snippet", type: "video", q: "science", maxResults: "20" },
      { part: "snippet", type: "video,channel", q: "science", maxResults: "20" },
      { part: "snippet", type: "channel", q: " ", maxResults: "20" },
      { part: "snippet", type: "video", channelId: "not-a-channel", q: "science", maxResults: "20" },
      { part: "snippet", type: "channel", q: "science", maxResults: "50" },
      { part: "snippet", type: "channel", q: "science", maxResults: "20", relatedToVideoId: videoId },
    ];
    for (const params of invalidRequests) expect(() => transport.youtube("search", params)).toThrow();
    expect(calls).toBe(0);
  });
  test("channel discovery hydrates only returned channel IDs and never looks up videos", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    const urls: URL[] = [];
    const transport = createProviderTransport(keys, async (input) => {
      const url = new URL(String(input)); urls.push(url);
      return json({ items: url.pathname.endsWith("/search") ? [{ id: { channelId } }, { id: { videoId } }] : [channelItem, { ...channelItem, id: "UC0000000000000000000000" }] });
    });
    const results = await createByokYouTube(transport, keys).searchChannels("science");
    expect(results.map((item) => item.id)).toEqual([channelId]);
    expect(urls[0].searchParams.get("type")).toBe("channel");
    expect(urls.some((url) => url.pathname.endsWith("/videos"))).toBeFalse();
  });
  test("within-channel search fixes the scope and discards foreign-channel video hydration", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    const urls: URL[] = [];
    const otherVideo = "12345678901";
    const transport = createProviderTransport(keys, async (input) => {
      const url = new URL(String(input)); urls.push(url);
      if (url.pathname.endsWith("/channels")) return json({ items: [channelItem] });
      if (url.pathname.endsWith("/search")) return json({ nextPageToken: "NEXT", items: [videoId, otherVideo].map((id) => ({ id: { videoId: id }, snippet: { channelId } })) });
      return json({ items: [videoItem, { ...videoItem, id: otherVideo, snippet: { ...videoItem.snippet, channelId: "UC0000000000000000000000" } }] });
    });
    const result = await createByokYouTube(transport, keys).browseChannel(channelId, { query: "space", duration: "long", recent: true });
    expect(result.videos.map((item) => item.id)).toEqual([videoId]);
    expect(result.nextPageToken).toBe("NEXT");
    const search = urls.find((url) => url.pathname.endsWith("/search"))!;
    expect(search.searchParams.get("channelId")).toBe(channelId);
    expect(search.searchParams.get("type")).toBe("video");
    expect(search.searchParams.get("videoDuration")).toBe("long");
    expect(search.searchParams.has("publishedAfter")).toBeTrue();
  });
  test("older uploads use one explicit page, never recursively follow nextPageToken", async () => {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    const urls: URL[] = [];
    const transport = createProviderTransport(keys, async (input) => {
      const url = new URL(String(input)); urls.push(url);
      if (url.pathname.endsWith("/channels")) return json({ items: [channelItem] });
      if (url.pathname.endsWith("/playlistItems")) return json({ nextPageToken: "NEXT", items: [{ contentDetails: { videoId } }] });
      return json({ items: [videoItem] });
    });
    const client = createByokYouTube(transport, keys);
    const result = await client.browseChannel(channelId, { pageToken: "OLDER" });
    expect(result.videos).toHaveLength(1);
    expect(urls).toHaveLength(3);
    expect(urls[1].searchParams.get("pageToken")).toBe("OLDER");
    expect(urls[1].searchParams.get("maxResults")).toBe("50");
    expect(urls.some((url) => url.pathname.endsWith("/search"))).toBeFalse();
    await expect(client.browseChannel("invalid")).rejects.toThrow();
    await expect(client.browseChannel(channelId, { pageToken: "https://untrusted.test" })).rejects.toThrow();
    expect(urls).toHaveLength(3);
  });
});

test("unavailable key storage gives an honest native-app message without making a request", async () => {
  const { keys } = fixture(false);
  let calls = 0;
  const transport = createProviderTransport(keys, async () => { calls++; return json({ items: [] }); });
  await expect(transport.youtube("search", { type: "channel", part: "snippet", q: "science", maxResults: "20" })).rejects.toThrow("iPhone or Android app");
  expect(calls).toBe(0);
});

test("short and unknown videos never resolve, reach feeds, or appear in a channel page", async () => {
  for (const duration of ["PT1M", "PT3M", "PT3M59S", "PT0S", "invalid"]) {
    const { keys } = fixture(); await keys.save("youtube", fakeKey);
    const transport = createProviderTransport(keys, async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/channels")) return json({ items: [channelItem] });
      if (url.pathname.endsWith("/playlistItems")) return json({ nextPageToken: "NEXT", items: [{ contentDetails: { videoId } }] });
      if (url.pathname.endsWith("/search")) return json({ items: [{ id: { videoId }, snippet: { channelId } }] });
      return json({ items: [{ ...videoItem, contentDetails: { duration } }] });
    });
    const client = createByokYouTube(transport, keys);
    expect((await client.resolve(`https://youtu.be/${videoId}`)).status).toBe("invalid_request");
    const feed = await client.getCachedFeeds([channelId]);
    expect(feed.status).toBe("success");
    if (feed.status === "success") expect(feed.candidates).toEqual([]);
    expect((await client.browseChannel(channelId)).videos).toEqual([]);
    expect((await client.browseChannel(channelId)).nextPageToken).toBe("NEXT");
    expect((await client.browseChannel(channelId, { query: "topic" })).videos).toEqual([]);
  }
});

test("Shorts links are rejected before network even if the ID could be a longer video", async () => {
  const { keys } = fixture(); let calls = 0;
  const client = createByokYouTube(createProviderTransport(keys, async () => { calls++; return json({}); }), keys);
  expect(await client.resolve(`https://youtube.com/shorts/${videoId}`)).toMatchObject({ status: "invalid_request" });
  expect(calls).toBe(0);
});

test("a larger research pool keeps twelve reviewed long-form sources, including mixed-format creators", async () => {
  const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
  const stored = new Map<string, string>(); let calls = 0; let inspections = 0;
  const candidates = Array.from({ length: 24 }, (_, i) => ({ ...drafts[0], handle: `@creator${i}` }));
  const transport = createProviderTransport(keys, async () => json(draftResponse(++calls === 1 ? candidates : review)));
  const client = createByokWeeklyPicks(transport, keys, { async getItem(key) { return stored.get(key) ?? null; }, async setItem(key, value) { stored.set(key, value); } }, async (handle) => ({ status: "success", data: { source: { ...source, providerSourceId: `UC${handle.slice(1).padEnd(22, "a")}` }, provenance: "provider" } }), async (sourceId) => { inspections++; return { ...await inspect(), sourceId, sampledCount: 36 }; });
  await client.generate(["science"]);
  const result = await client.getWeeklyPicks(["science"]);
  expect(result.status).toBe("success");
  if (result.status !== "success") throw new Error("No edition");
  expect(result.response.interests.flatMap((group) => group.picks)).toHaveLength(12);
  expect(inspections).toBe(12); expect(calls).toBe(13);
  await client.generate(["science"]); expect(calls).toBe(13);
  const key = [...stored.keys()][0]; const legacy = JSON.parse(stored.get(key)!);
  legacy.policyVersion = "nourishing-v1.personal-interests-v1"; stored.set(key, JSON.stringify(legacy));
  expect((await client.getWeeklyPicks(["science"])).status).toBe("success");
  await client.generate(["science"]); expect(calls).toBe(13);
});

test("empty editions have one explicit recovery after cooldown, persisted even when the recovery fails", async () => {
  for (const failRecovery of [false, true]) {
    const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
    const stored = new Map<string, string>(); let calls = 0; let clock = Date.now();
    const transport = createProviderTransport(keys, async () => { calls++; return failRecovery && calls > 1 ? json({}, 403) : json(draftResponse([])); });
    const storage = { async getItem(key: string) { return stored.get(key) ?? null; }, async setItem(key: string, value: string) { stored.set(key, value); } };
    const resolver = async () => ({ status: "success" as const, data: { source, provenance: "provider" as const } });
    let client = createByokWeeklyPicks(transport, keys, storage, resolver, inspect, () => clock);
    await client.generate(["science"]); expect(await client.canRetryEmpty()).toBeTrue();
    await client.getWeeklyPicks(["science"]); expect(calls).toBe(1);
    await expect(client.generate(["science"])).rejects.toThrow(); expect(calls).toBe(1);
    clock += 61000;
    if (failRecovery) await expect(client.generate(["science"])).rejects.toThrow();
    else await client.generate(["science"]);
    expect(calls).toBe(2); expect(await client.canRetryEmpty()).toBeFalse();
    client = createByokWeeklyPicks(transport, keys, storage, resolver, inspect, () => clock);
    await expect(client.generate(["science"])).rejects.toThrow(); expect(calls).toBe(2);
  }
});

test("discovery samples at most three pages to find long-form work behind recent Shorts", async () => {
  const { keys } = fixture(); await keys.save("youtube", fakeKey);
  let pages = 0; let calls = 0;
  const transport = createProviderTransport(keys, async (input) => {
    const url = new URL(String(input)); calls++;
    if (url.pathname.endsWith("/channels")) return json({ items: [channelItem] });
    if (url.pathname.endsWith("/playlistItems")) {
      pages++;
      return json({ items: Array.from({ length: 12 }, (_, i) => ({ contentDetails: { videoId: `video${String((pages - 1) * 12 + i).padStart(6, "0")}` } })), nextPageToken: `page${pages}` });
    }
    return json({ items: url.searchParams.get("id")!.split(",").map((id) => ({ ...videoItem, id, contentDetails: { duration: pages === 3 ? "PT10M" : "PT30S" } })) });
  });
  const sample = await createByokYouTube(transport, keys).inspectDiscoverySource(channelId);
  expect(sample.sampledCount).toBe(36); expect(sample.videos).toHaveLength(36);
  expect(sample.videos.filter((video) => (video.durationSeconds ?? 0) >= 240)).toHaveLength(12);
  expect(pages).toBe(3); expect(calls).toBe(7);
});

test("three reviewed discoveries are readable before the search finishes and survive cancellation", async () => {
  const { keys } = fixture(); await keys.save("youtube", fakeKey); await keys.save("gemini", fakeKey);
  const stored = new Map<string, string>();
  let calls = 0; let resolutions = 0;
  let ready!: () => void; const available = new Promise<void>(resolve => { ready = resolve; });
  let release!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; });
  const candidates = [0, 1, 2, 3].map(i => ({ ...drafts[0], handle: `@science${i}` }));
  const transport = createProviderTransport(keys, async () => json(draftResponse(++calls === 1 ? candidates : review)));
  const client = createByokWeeklyPicks(transport, keys, {
    async getItem(key) { return stored.get(key) ?? null; }, async setItem(key, value) { stored.set(key, value); },
  }, async () => {
    const index = resolutions++;
    if (index === 3) await blocked;
    return { status: "success", data: { source: { ...source, providerSourceId: `UCabcdefghijklmnopqrstu${index}` }, provenance: "provider" } };
  }, async sourceId => ({ ...await inspect(), sourceId }));
  const controller = new AbortController();
  const counts: number[] = [];
  const pending = client.generate(["science"], controller.signal, "owner", undefined, progress => {
    counts.push(progress.reviewedCount); if (progress.available) ready();
  }).catch(error => error);
  await available;
  expect(client.isPreparing?.("owner")).toBe(true);
  const result = await client.getWeeklyPicks(["science"], "owner");
  expect(result.status).toBe("success");
  if (result.status === "success") expect(result.response.interests.flatMap(group => group.picks)).toHaveLength(3);
  expect(counts).toEqual([1, 2, 3]);
  controller.abort(); release();
  expect(await pending).toMatchObject({ kind: "cancelled" });
  expect(client.isPreparing?.("owner")).toBe(false);
  expect(await client.getWeeklyPicks(["science"], "owner")).toEqual(result);
  expect(calls).toBe(4);
  expect(await client.canRetryEmpty("owner")).toBe(false);
});
