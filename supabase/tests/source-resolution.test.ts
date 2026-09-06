import {
  executeSourceResolution,
  sanitizeSource,
  type CachedResolution,
  type ProviderChannel,
  type ProviderVideo,
  type SanitizedSource,
  type SanitizedVideo,
  type SourceResolutionRepository,
  type YouTubeResolutionProvider,
} from "../functions/_shared/source-resolution";

const installationToken = "a".repeat(64);
const source: SanitizedSource = {
  provider: "youtube",
  providerSourceId: "UCabcdefghijklmnopqrstuv",
  handle: "@frame",
  displayName: "Frame Source",
  description: "Verified source",
  thumbnailUrl: "https://example.com/source.jpg",
};
const video: ProviderVideo = {
  provider: "youtube",
  providerMediaId: "abcdefghijk",
  providerSourceId: source.providerSourceId,
  title: "A real video",
  description: "Video description",
  thumbnailUrl: "https://example.com/video.jpg",
  publishedAt: "2026-09-01T12:00:00.000Z",
  durationSeconds: 120,
  isLivestream: false,
  isUpcomingPremiere: false,
};

class MemoryRepository implements SourceResolutionRepository {
  cached: CachedResolution | null = null;
  reservation: "reserved" | "allowance_exhausted" | "quota_exhausted" | "temporarily_unavailable" = "reserved";
  readonly reservations: number[] = [];
  readonly sources = new Map<string, SanitizedSource>();
  readonly videos = new Map<string, SanitizedVideo>();
  definitiveMisses: { kind: "channelId" | "handle" | "video"; value: string }[] = [];

  async findFresh(): Promise<CachedResolution | null> { return this.cached; }
  async reserve(_token: string, count: 1 | 2) { this.reservations.push(count); return this.reservation; }
  async upsertSource(value: SanitizedSource): Promise<SanitizedSource> {
    this.sources.set(value.providerSourceId, value);
    return value;
  }
  async upsertVideo(value: SanitizedVideo): Promise<SanitizedVideo> {
    this.videos.set(value.providerMediaId, value);
    return value;
  }
  async markDefinitiveNotFound(input: { kind: "channelId" | "handle" | "video"; value: string }): Promise<void> {
    this.definitiveMisses.push(input);
  }
}

class RecordingProvider implements YouTubeResolutionProvider {
  channelCalls = 0;
  videoCalls = 0;
  channel: ProviderChannel = source;
  async getChannel() { this.channelCalls += 1; return { outcome: "success" as const, data: this.channel }; }
  async getVideo() { this.videoCalls += 1; return { outcome: "success" as const, data: video }; }
}

function request(kind: "channelId" | "handle" | "video", value: string): unknown {
  return { kind, value, installationToken };
}

describe("bounded shared-source resolution", () => {
  test("strictly validates supported inputs before cache, quota, or provider access", async () => {
    const invalid = [
      {},
      request("handle", "search words"),
      request("channelId", "not-a-channel"),
      request("video", "playlist1234"),
      { ...request("handle", "frame"), profileId: "private" },
      { kind: "handle", value: "frame", installationToken: "raw" },
    ];
    for (const value of invalid) {
      const repository = new MemoryRepository();
      const provider = new RecordingProvider();
      expect((await executeSourceResolution(value, repository, provider)).outcome).toBe("invalid_request");
      expect(repository.reservations).toEqual([]);
      expect(provider.channelCalls + provider.videoCalls).toBe(0);
    }
  });

  test("returns a fresh cache hit without provider or quota usage", async () => {
    const repository = new MemoryRepository();
    repository.cached = { source };
    const provider = new RecordingProvider();
    const result = await executeSourceResolution(request("handle", "frame"), repository, provider);
    expect(result).toEqual({ outcome: "success", source, provenance: "cache" });
    expect(repository.reservations).toEqual([]);
    expect(provider.channelCalls).toBe(0);
  });

  test("reserves one call for channel and handle resolution", async () => {
    for (const input of [request("channelId", source.providerSourceId), request("handle", "frame")]) {
      const repository = new MemoryRepository();
      const provider = new RecordingProvider();
      expect((await executeSourceResolution(input, repository, provider)).outcome).toBe("success");
      expect(repository.reservations).toEqual([1]);
      expect(provider.channelCalls).toBe(1);
    }
  });

  test("reserves two calls atomically before video and canonical channel lookup", async () => {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    const result = await executeSourceResolution(request("video", video.providerMediaId), repository, provider);
    expect(result.outcome).toBe("success");
    expect(repository.reservations).toEqual([2]);
    expect(provider.videoCalls).toBe(1);
    expect(provider.channelCalls).toBe(1);
  });

  test("disabled, quota, and installation denial make no provider request or catalog change", async () => {
    for (const denial of ["temporarily_unavailable", "allowance_exhausted", "quota_exhausted"] as const) {
      const repository = new MemoryRepository();
      repository.reservation = denial;
      const provider = new RecordingProvider();
      expect((await executeSourceResolution(request("handle", "frame"), repository, provider)).outcome).toBe(denial);
      expect(provider.channelCalls).toBe(0);
      expect(repository.sources.size).toBe(0);
    }
  });

  test("stable channel identity deduplicates metadata and handle changes", async () => {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    await executeSourceResolution(request("handle", "old-handle"), repository, provider);
    provider.channel = { ...source, handle: "@new-handle", displayName: "Renamed Source" };
    await executeSourceResolution(request("handle", "new-handle"), repository, provider);
    expect(repository.sources.size).toBe(1);
    expect(repository.sources.get(source.providerSourceId)?.handle).toBe("@new-handle");
  });

  test("returns only sanitized source and video fields", async () => {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    provider.channel = { ...source, displayName: "Name\u0000 with control", thumbnailUrl: "http://unsafe.example/image" };
    const result = await executeSourceResolution(request("video", video.providerMediaId), repository, provider);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    expect(Object.keys(result).sort()).toEqual(["outcome", "provenance", "source", "video"]);
    expect(Object.keys(result.source).sort()).toEqual(["description", "displayName", "handle", "provider", "providerSourceId", "thumbnailUrl"]);
    expect(result.source.thumbnailUrl).toBeNull();
    expect(JSON.stringify(result)).not.toContain(installationToken);
  });

  test("marks unavailable only for definitive not-found", async () => {
    for (const outcome of ["not_found", "temporarily_unavailable", "network_error"] as const) {
      const repository = new MemoryRepository();
      const provider = new RecordingProvider();
      provider.getChannel = async () => ({ outcome });
      expect((await executeSourceResolution(request("handle", "frame"), repository, provider)).outcome).toBe(outcome);
      expect(repository.definitiveMisses).toHaveLength(outcome === "not_found" ? 1 : 0);
    }
  });

  test("sanitizer bounds text and rejects unsafe metadata", () => {
    const sanitized = sanitizeSource({ ...source, description: "x".repeat(6000), thumbnailUrl: "javascript:alert(1)" });
    expect(sanitized.description).toHaveLength(5000);
    expect(sanitized.thumbnailUrl).toBeNull();
  });
});

const migrationPath = new URL("../migrations/20260906120000_bounded_source_resolution.sql", import.meta.url);
const edgePath = new URL("../functions/resolve-source/index.ts", import.meta.url);

describe("source-resolution security migration and Edge boundary", () => {
  test("uses one private hashed installation usage table and one atomic reservation", async () => {
    const migration = await Bun.file(migrationPath).text();
    expect(migration).toContain("source_resolution_enabled boolean not null default false");
    expect(migration).toContain("source_resolution_daily_installation_call_limit integer not null default 10");
    expect(migration).toContain("create table if not exists public.daily_installation_action_usage");
    expect(migration).toContain("v_installation_hash := encode(extensions.digest(p_installation_token, 'sha256'), 'hex')");
    expect(migration).not.toMatch(/profile_id|interest|viewing|raw_installation|url\s+text/i);
    expect(migration).toContain("alter table public.daily_installation_action_usage force row level security;");
    expect(migration).toContain("revoke all privileges on table public.daily_installation_action_usage from public, anon, authenticated;");
    expect(migration).toContain("grant execute on function public.reserve_source_resolution_quota(text, integer) to service_role;");
    expect(migration).toContain("daily_youtube_unit_ceiling - v_control.reserved_safety_units");
    expect(migration).not.toContain("increment_daily_provider_usage(");
  });

  test("uses bounded POST-only requests and approved provider methods without search", async () => {
    const edge = await Bun.file(edgePath).text();
    expect(edge).toContain("readBoundedJsonBody(request, maxRequestBytes)");
    expect(edge).toContain("hasValidPublishableKey(request, Deno.env.get)");
    expect(edge).toContain('resource: "channels" | "videos"');
    expect(edge).not.toContain("search.list");
    expect(edge).not.toContain("/search");
    expect(edge).not.toMatch(/console\.(?:log|warn|error)/);
  });
});
