import { describe, expect, test } from "bun:test";
import {
  executeSourceIngestion,
  SOURCE_UPLOADS_PAGE_SIZE,
  type IngestionChannel,
  type IngestionServiceState,
  type IngestionVideo,
  type ProviderResult,
  type ReservationOutcome,
  type SourceIngestionRepository,
  type SourceSyncClaim,
  type YouTubeIngestionProvider,
} from "../functions/_shared/source-ingestion";
import {
  executeSourceFeed,
  type CachedSourceFeedRecord,
  type SourceFeedRepository,
} from "../functions/_shared/source-feed";

const now = new Date("2026-09-06T12:00:00.000Z");
const sourceId = "00000000-0000-0000-0000-000000000111";
const channelId = "UCabcdefghijklmnopqrstuv";
const claim: SourceSyncClaim = {
  sourceId,
  providerSourceId: channelId,
  uploadsPlaylistId: "UUabcdefghijklmnopqrstuv",
  sourceMetadataFetchedAt: "2026-09-06T11:00:00.000Z",
  sourceMetadataExpiresAt: "2026-09-07T11:00:00.000Z",
};

function video(id: string, madeForKids: boolean | null = false): IngestionVideo {
  return {
    provider: "youtube",
    providerMediaId: id,
    providerSourceId: channelId,
    title: `Video ${id}`,
    description: "Cached description",
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    publishedAt: "2026-09-06T10:00:00.000Z",
    durationSeconds: 120,
    isLivestream: false,
    isUpcomingPremiere: false,
    madeForKids,
    availability: "active",
  };
}

class MemoryRepository implements SourceIngestionRepository {
  serviceState: IngestionServiceState = { ingestionEnabled: true, maintenanceMode: false, haltedUntil: null };
  claims: SourceSyncClaim[] = [claim];
  reservation: ReservationOutcome = "reserved";
  readonly reservations: Array<{ requestCount: number; quotaUnits: number }> = [];
  readonly sources = new Map<string, IngestionChannel>();
  readonly videos = new Map<string, IngestionVideo>();
  readonly completions: Array<{ sourceId: string; outcome: string; errorCode: string | null }> = [];
  readonly halts: string[] = [];
  maintenanceCalls = 0;
  claimCalls = 0;

  async getServiceState(): Promise<IngestionServiceState> { return this.serviceState; }
  async claimDueSources(): Promise<readonly SourceSyncClaim[]> {
    this.claimCalls += 1;
    return this.claims;
  }
  async reserveProviderQuota(requestCount: number, quotaUnits: number): Promise<ReservationOutcome> {
    this.reservations.push({ requestCount, quotaUnits });
    return this.reservation;
  }
  async upsertSources(channels: readonly IngestionChannel[]): Promise<void> {
    for (const channel of channels) this.sources.set(channel.providerSourceId, channel);
  }
  async upsertVideos(videos: readonly IngestionVideo[]): Promise<void> {
    for (const item of videos) this.videos.set(item.providerMediaId, item);
  }
  async markVideosUnavailable(_sourceId: string, providerMediaIds: readonly string[]): Promise<void> {
    for (const id of providerMediaIds) {
      const existing = this.videos.get(id);
      if (existing) this.videos.set(id, { ...existing, availability: "unavailable" });
    }
  }
  async completeClaim(source: string, _token: string, outcome: string, errorCode: string | null): Promise<void> {
    this.completions.push({ sourceId: source, outcome, errorCode });
  }
  async haltIngestion(errorCode: "provider_auth" | "provider_quota" | "provider_circuit_open"): Promise<void> {
    this.halts.push(errorCode);
  }
  async expireStaleMetadata(): Promise<void> { this.maintenanceCalls += 1; }
}

class RecordingProvider implements YouTubeIngestionProvider {
  channelCalls = 0;
  uploadsCalls = 0;
  videoCalls = 0;
  channelResult: ProviderResult<readonly IngestionChannel[]> = { outcome: "success", data: [] };
  uploadsResult: ProviderResult<readonly string[]> = { outcome: "success", data: ["abcdefghijk"] };
  videoResult: ProviderResult<readonly IngestionVideo[]> = { outcome: "success", data: [video("abcdefghijk")] };
  readonly videoBatches: string[][] = [];
  readonly uploadsLimits: number[] = [];

  async getChannels(): Promise<ProviderResult<readonly IngestionChannel[]>> {
    this.channelCalls += 1;
    return this.channelResult;
  }
  async getUploadsPage(_playlistId: string, maxResults: number): Promise<ProviderResult<readonly string[]>> {
    this.uploadsCalls += 1;
    this.uploadsLimits.push(maxResults);
    return this.uploadsResult;
  }
  async getVideos(ids: readonly string[]): Promise<ProviderResult<readonly IngestionVideo[]>> {
    this.videoCalls += 1;
    this.videoBatches.push([...ids]);
    if (this.videoResult.outcome !== "success") return this.videoResult;
    const byId = new Map(this.videoResult.data.map((item: IngestionVideo) => [item.providerMediaId, item]));
    return { outcome: "success", data: ids.flatMap((id: string) => byId.get(id) ?? []) };
  }
}

describe("bounded shared source ingestion", () => {
  test("multiple installation leases still produce one shared refresh claim", async () => {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    const result = await executeSourceIngestion(repository, provider, now, () => "claim-one");
    expect(result).toMatchObject({ state: "success", claimed: 1, succeeded: 1 });
    expect(repository.claimCalls).toBe(1);
    expect(provider.uploadsCalls).toBe(1);
    expect(provider.videoCalls).toBe(1);
  });

  test("quota denial prevents every outbound provider request", async () => {
    const repository = new MemoryRepository();
    repository.reservation = "quota_exhausted";
    const provider = new RecordingProvider();
    const result = await executeSourceIngestion(repository, provider, now, () => "claim-quota");
    expect(result.state).toBe("halted");
    expect(provider.channelCalls + provider.uploadsCalls + provider.videoCalls).toBe(0);
    expect(repository.halts).toEqual(["provider_quota"]);
  });

  test("requests only one bounded uploads page per claimed source", async () => {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    await executeSourceIngestion(repository, provider, now, () => "claim-page");
    expect(provider.uploadsCalls).toBe(1);
    expect(provider.uploadsLimits).toEqual([SOURCE_UPLOADS_PAGE_SIZE]);
  });

  test("batches up to one hundred video ids into two provider requests", async () => {
    const repository = new MemoryRepository();
    repository.claims = Array.from({ length: 5 }, (_value: unknown, index: number) => ({
      ...claim,
      sourceId: `00000000-0000-0000-0000-00000000011${index}`,
      providerSourceId: `UCabcdefghijklmnopqrstu${index}`,
      uploadsPlaylistId: `UUabcdefghijklmnopqrstu${index}`,
    }));
    const provider = new RecordingProvider();
    let uploadsIndex = 0;
    provider.getUploadsPage = async (_playlistId: string, maxResults: number) => {
      provider.uploadsCalls += 1;
      provider.uploadsLimits.push(maxResults);
      const prefix = String(uploadsIndex++).padStart(2, "0");
      return {
        outcome: "success",
        data: Array.from({ length: 20 }, (_unused: unknown, itemIndex: number) => `${prefix}${String(itemIndex).padStart(9, "0")}`),
      };
    };
    provider.getVideos = async (ids: readonly string[]) => {
      provider.videoCalls += 1;
      provider.videoBatches.push([...ids]);
      return {
        outcome: "success",
        data: ids.map((id: string) => {
          const owner = Number(id.slice(0, 2));
          return { ...video(id), providerSourceId: repository.claims[owner]?.providerSourceId ?? channelId };
        }),
      };
    };
    const result = await executeSourceIngestion(repository, provider, now, () => "claim-batches");
    expect(result.claimed).toBe(5);
    expect(provider.uploadsCalls).toBe(5);
    expect(provider.videoBatches.map((batch: string[]) => batch.length)).toEqual([50, 50]);
  });

  test("repeated ingestion upserts remain idempotent and retain made-for-kids", async () => {
    const repository = new MemoryRepository();
    const provider = new RecordingProvider();
    provider.videoResult = { outcome: "success", data: [video("abcdefghijk", true)] };
    await executeSourceIngestion(repository, provider, now, () => "claim-first");
    await executeSourceIngestion(repository, provider, now, () => "claim-second");
    expect(repository.videos.size).toBe(1);
    expect(repository.videos.get("abcdefghijk")?.madeForKids).toBe(true);
    expect(repository.completions.filter((entry) => entry.outcome === "success")).toHaveLength(2);
  });

  test("transient provider errors preserve cached records and apply failure completion", async () => {
    const repository = new MemoryRepository();
    repository.videos.set("existing000", video("existing000"));
    const provider = new RecordingProvider();
    provider.uploadsResult = { outcome: "transient" };
    const result = await executeSourceIngestion(repository, provider, now, () => "claim-transient");
    expect(result.failed).toBe(1);
    expect(repository.videos.has("existing000")).toBe(true);
    expect(repository.completions[0]).toMatchObject({ outcome: "transient_failure", errorCode: "uploads_unavailable" });
  });

  test("definitively missing videos are marked unavailable without deleting older cache", async () => {
    const repository = new MemoryRepository();
    repository.videos.set("abcdefghijk", video("abcdefghijk"));
    const provider = new RecordingProvider();
    provider.videoResult = { outcome: "success", data: [] };
    await executeSourceIngestion(repository, provider, now, () => "claim-missing");
    expect(repository.videos.get("abcdefghijk")?.availability).toBe("unavailable");
    expect(repository.videos.size).toBe(1);
  });
});

describe("cached source feed", () => {
  const cached: CachedSourceFeedRecord = {
    source: {
      provider: "youtube",
      providerSourceId: channelId,
      handle: "@frame",
      displayName: "Frame Source",
      thumbnailUrl: "https://example.com/source.jpg",
    },
    sourceStatus: "active",
    lastSuccessAt: "2026-09-06T12:00:00.000Z",
    nextAttemptAt: "2026-09-06T18:00:00.000Z",
    lastErrorCode: null,
    items: [{
      provider: "youtube",
      providerMediaId: "abcdefghijk",
      title: "Cached video",
      description: "Description",
      thumbnailUrl: "https://example.com/video.jpg",
      publishedAt: "2026-09-06T10:00:00.000Z",
      durationSeconds: 120,
      isLivestream: false,
      isUpcomingPremiere: false,
      madeForKids: false,
      fetchedAt: "2026-09-06T11:00:00.000Z",
    }],
  };

  test("returns fresh and stale cache without a provider dependency", async () => {
    let reads = 0;
    const repository: SourceFeedRepository = {
      async readCachedSourceFeeds(): Promise<readonly CachedSourceFeedRecord[]> { reads += 1; return [cached]; },
    };
    const fresh = await executeSourceFeed({ providerSourceId: channelId }, repository, now);
    const stale = await executeSourceFeed(
      { providerSourceId: channelId },
      { readCachedSourceFeeds: async () => [{ ...cached, nextAttemptAt: "2026-09-06T11:00:00.000Z" }] },
      now,
    );
    const failing = await executeSourceFeed(
      { providerSourceId: channelId },
      { readCachedSourceFeeds: async () => [{ ...cached, lastErrorCode: "provider_unavailable" }] },
      now,
    );
    expect(fresh.body.state).toBe("fresh");
    expect(stale.body.state).toBe("stale");
    expect(failing.body.state).toBe("stale");
    expect(reads).toBe(1);
    expect(fresh.body.fetchedAt).toBe("2026-09-06T11:00:00.000Z");
  });

  test("returns truthful empty and unavailable states", async () => {
    const empty = await executeSourceFeed(
      { providerSourceId: channelId },
      { readCachedSourceFeeds: async () => [{ ...cached, items: [] }] },
      now,
    );
    const unavailable = await executeSourceFeed(
      { providerSourceId: channelId },
      { readCachedSourceFeeds: async () => [] },
      now,
    );
    expect(empty.body.state).toBe("empty");
    expect(unavailable.body.state).toBe("unavailable");
  });

  test("reads a bounded multi-source request once and preserves per-source limits", async () => {
    const secondId = "UCabcdefghijklmnopqrstu2";
    let receivedIds: readonly string[] = [];
    let receivedLimit = 0;
    const second = { ...cached, source: { ...cached.source, providerSourceId: secondId, displayName: "Second source" } };
    const result = await executeSourceFeed(
      { providerSourceIds: [channelId, secondId], limitPerSource: 2 },
      { readCachedSourceFeeds: async (ids, limit) => { receivedIds = ids; receivedLimit = limit; return [cached, second]; } },
      now,
    );
    expect(receivedIds).toEqual([channelId, secondId]);
    expect(receivedLimit).toBe(2);
    expect(result.body.state).toBe("fresh");
    expect(result.body.feeds).toHaveLength(2);
  });

  test("rejects duplicate, malformed, excessive, and oversized feed inputs", async () => {
    const repository: SourceFeedRepository = { readCachedSourceFeeds: async () => { throw new Error("must not read"); } };
    expect((await executeSourceFeed({ providerSourceIds: [channelId, channelId] }, repository, now)).status).toBe(400);
    expect((await executeSourceFeed({ providerSourceIds: ["not-a-channel"] }, repository, now)).status).toBe(400);
    expect((await executeSourceFeed({ providerSourceIds: Array.from({ length: 26 }, (_, index) => `UCabcdefghijklmnopqr${String(index).padStart(4, "0")}`) }, repository, now)).status).toBe(400);
    expect((await executeSourceFeed({ providerSourceIds: [channelId], limitPerSource: 21 }, repository, now)).status).toBe(400);
  });
});

const migrationPath = new URL("../migrations/20260906150000_shared_source_ingestion.sql", import.meta.url);
const workerPath = new URL("../functions/sync-sources/index.ts", import.meta.url);
const feedPath = new URL("../functions/source-feed/index.ts", import.meta.url);
const batchedFeedMigrationPath = new URL("../migrations/20260906180000_batched_cached_source_feeds.sql", import.meta.url);

describe("ingestion schema and Edge boundaries", () => {
  test("claims due actively leased sources atomically and recovers expired locks", async () => {
    const migration = await Bun.file(migrationPath).text();
    expect(migration).toContain("create table if not exists public.source_sync_state");
    expect(migration).toContain("leases.expires_at > now()");
    expect(migration).toContain("sync_state.next_attempt_at <= now()");
    expect(migration).toContain("sync_state.locked_until <= now()");
    expect(migration).toContain("for update of sync_state skip locked");
    expect(migration).toContain("source_sync_batch_limit smallint not null default 5");
    expect(migration).toContain("source_sync_success_interval_minutes integer not null default 360");
  });

  test("keeps exact quota reservation and bounded exponential failure backoff atomic", async () => {
    const migration = await Bun.file(migrationPath).text();
    expect(migration).toContain("create or replace function public.reserve_youtube_ingestion_quota");
    expect(migration).toContain("daily_youtube_unit_ceiling - v_controls.reserved_safety_units");
    expect(migration).toContain("power(2, least(sync_state.consecutive_failures, 6))");
    expect(migration).toContain("floor(random() * 61)");
    expect(migration).toContain("grant execute on function public.claim_due_source_syncs(uuid, integer) to service_role;");
    expect(migration).toContain("alter table public.source_sync_state force row level security;");
  });

  test("worker is server-only, bounded, batched, and never searches", async () => {
    const worker = await Bun.file(workerPath).text();
    expect(worker).toContain('request.headers.get("x-frame-worker-token")');
    expect(worker).toContain('client.rpc("authorize_source_sync_worker"');
    expect(worker).not.toContain("hasValidPublishableKey");
    expect(worker).toContain('resource: "channels" | "playlistItems" | "videos"');
    expect(worker).not.toContain("search.list");
    expect(worker).not.toContain("/search");
    expect(worker).toContain('maxResults: String(Math.min(maxResults, 20))');
  });

  test("cached feed has no provider path and shared tables contain no private data", async () => {
    const feed = (await Bun.file(feedPath).text()).toLowerCase();
    const migration = (await Bun.file(migrationPath).text()).toLowerCase();
    expect(feed).not.toContain("youtube.googleapis.com");
    expect(feed).not.toContain("generativelanguage.googleapis.com");
    for (const forbidden of ["profile_id", "watch_progress", "viewing_history", "entitlement", "revenuecat"]) {
      expect(migration).not.toContain(forbidden);
    }
    const batchedMigration = (await Bun.file(batchedFeedMigrationPath).text()).toLowerCase();
    expect(migration).toContain("add column if not exists made_for_kids boolean");
    expect(feed).toContain('client.rpc("read_cached_source_feed_items"');
    expect(batchedMigration).toContain("row_number() over");
    expect(batchedMigration).toContain("cardinality(p_provider_source_ids) between 1 and 25");
    expect(batchedMigration).not.toContain("youtube.googleapis.com");
    expect(batchedMigration).not.toContain("generativelanguage.googleapis.com");
  });
});
