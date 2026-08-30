import { describe, expect, test } from "bun:test";
import {
  executeWeeklyPicks,
  MAX_INTERESTS_PER_REQUEST,
  mapPublishedPickRows,
  type PublishedPickRow,
  type WeeklyPicksRepository,
  validateWeeklyPicksInput,
} from "../functions/_shared/weekly-picks";

const now = new Date("2026-08-30T12:00:00.000Z");

function row(overrides: Partial<PublishedPickRow> = {}): PublishedPickRow {
  return {
    pickSetStatus: "published",
    periodStart: "2026-08-24",
    periodEnd: "2026-08-30",
    interestId: "science",
    pickOrder: 1,
    publicReason: "A clear public reason.",
    sourceProvider: "youtube",
    sourceProviderId: "source-public-id",
    sourceHandle: "trusted-source",
    sourceDisplayName: "Trusted Source",
    sourceDescription: "Public source description.",
    sourceThumbnailUrl: "https://example.com/source.jpg",
    mediaProvider: "youtube",
    mediaProviderId: "media-public-id",
    mediaTitle: "Featured media",
    mediaDescription: "Public media description.",
    mediaThumbnailUrl: "https://example.com/media.jpg",
    mediaPublishedAt: "2026-08-27T12:00:00.000Z",
    mediaDurationSeconds: 600,
    mediaIsLivestream: false,
    mediaIsUpcomingPremiere: false,
    ...overrides,
  };
}

function repository(overrides: Partial<WeeklyPicksRepository> = {}): WeeklyPicksRepository {
  return {
    getServiceState: async () => ({ weeklyPicksEnabled: true, maintenanceMode: false }),
    getActiveInterestIds: async (interestIds: readonly string[]) => interestIds,
    getCurrentPublishedPicks: async () => [row()],
    ...overrides,
  };
}

describe("Weekly Picks input boundary", () => {
  test("rejects malformed, unknown, arbitrary, and excessive inputs", () => {
    expect(validateWeeklyPicksInput(null).ok).toBe(false);
    expect(validateWeeklyPicksInput({ interestIds: [] }).ok).toBe(false);
    expect(validateWeeklyPicksInput({ interestIds: ["unknown"] }).ok).toBe(false);
    expect(validateWeeklyPicksInput({ interestIds: ["science"], order: "desc" }).ok).toBe(false);
    expect(validateWeeklyPicksInput({ interestIds: Array(MAX_INTERESTS_PER_REQUEST + 1).fill("science") }).ok).toBe(false);
  });

  test("deduplicates known stable IDs", () => {
    expect(validateWeeklyPicksInput({ interestIds: ["science", "science", "design"] })).toEqual({
      ok: true,
      interestIds: ["science", "design"],
    });
  });

  test("rejects known but inactive interests", async () => {
    const result = await executeWeeklyPicks(
      { interestIds: ["science", "design"] },
      repository({ getActiveInterestIds: async () => ["science"] }),
      now,
    );
    expect(result.status).toBe(400);
    expect(result.body.state).toBe("unavailable");
  });
});

describe("Weekly Picks response boundary", () => {
  test("never returns draft, expired-period, or future-period rows", () => {
    const mapped = mapPublishedPickRows([
      row({ pickSetStatus: "draft" }),
      row({ pickSetStatus: "expired" }),
      row({ periodStart: "2026-08-01", periodEnd: "2026-08-23" }),
      row({ periodStart: "2026-08-31", periodEnd: "2026-09-06" }),
    ], ["science"], now);
    expect(mapped).toEqual([]);
  });

  test("returns no more than three ordered picks per interest", () => {
    const mapped = mapPublishedPickRows([
      row({ pickOrder: 3 }),
      row({ pickOrder: 1 }),
      row({ pickOrder: 2 }),
      row({ pickOrder: 2, sourceProviderId: "duplicate-position" }),
      row({ pickOrder: 4 }),
    ], ["science"], now);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.picks.map((pick) => pick.order)).toEqual([1, 2, 3]);
  });

  test("omits internal IDs and inactive or absent featured-media fields", async () => {
    const result = await executeWeeklyPicks(
      { interestIds: ["science"] },
      repository({ getCurrentPublishedPicks: async () => [row({ mediaProvider: null, mediaProviderId: null, mediaTitle: null })] }),
      now,
    );
    expect(result.body.state).toBe("fresh");
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("pickSetId");
    expect(serialized).not.toContain("sourceId");
    expect(serialized).not.toContain("quota");
    expect(result.body.interests[0]?.picks[0]?.featuredMedia).toBeUndefined();
  });

  test("returns maintenance, empty, and unavailable states", async () => {
    const maintenance = await executeWeeklyPicks(
      { interestIds: ["science"] },
      repository({ getServiceState: async () => ({ weeklyPicksEnabled: false, maintenanceMode: false }) }),
      now,
    );
    const empty = await executeWeeklyPicks(
      { interestIds: ["science"] },
      repository({ getCurrentPublishedPicks: async () => [] }),
      now,
    );
    const unavailable = await executeWeeklyPicks(
      { interestIds: ["science"] },
      repository({ getServiceState: async () => { throw new Error("database details"); } }),
      now,
    );
    expect(maintenance.body.state).toBe("maintenance");
    expect(empty.body.state).toBe("empty");
    expect(unavailable.body).toEqual({ state: "unavailable", interests: [], message: "Weekly Picks are unavailable." });
  });

  test("does not call YouTube or AI while serving a request", async () => {
    const originalFetch = globalThis.fetch;
    let externalCalls = 0;
    globalThis.fetch = (async () => {
      externalCalls += 1;
      throw new Error("unexpected external request");
    }) as typeof fetch;
    try {
      await executeWeeklyPicks({ interestIds: ["science"] }, repository(), now);
      expect(externalCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
