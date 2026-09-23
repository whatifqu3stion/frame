import { describe, expect, test } from "bun:test";
import {
  buildWeeklyPickDrafts,
  parseWeeklyPickCandidates,
  weeklyPeriodEnd,
  type WeeklyPickCandidate,
} from "../weekly-pick-preparation";

const migrationPath = new URL("../migrations/20260923210000_weekly_pick_preparation.sql", import.meta.url);
const indexMigrationPath = new URL("../migrations/20260923213000_weekly_pick_preparation_index.sql", import.meta.url);
const commandPath = new URL("../prepare-weekly-picks.ts", import.meta.url);

const candidates: WeeklyPickCandidate[] = [
  candidate(2, "11111111-1111-4111-8111-111111111111"),
  candidate(1, "22222222-2222-4222-8222-222222222222"),
  candidate(3, "33333333-3333-4333-8333-333333333333"),
  candidate(4, "44444444-4444-4444-8444-444444444444"),
];

describe("Weekly Picks preparation", () => {
  test("builds a stable three-item draft without publishing", () => {
    const drafts = buildWeeklyPickDrafts(candidates, "2026-09-28");
    expect(drafts).toHaveLength(1);
    expect(drafts[0].periodEnd).toBe("2026-10-04");
    expect(drafts[0].publishPayload).toHaveLength(3);
    expect(drafts[0].review.map((item) => item.candidateRank)).toEqual([1, 2, 3]);
    expect(drafts[0].publishPayload.every((item) => item.reason === null)).toBeTrue();
  });

  test("rejects invalid period boundaries and malformed server rows", () => {
    expect(() => weeklyPeriodEnd("2026-09-29")).toThrow("Monday");
    expect(() => parseWeeklyPickCandidates([{ interest_id: "tech" }])).toThrow();
  });

  test("keeps preparation read-only and service-role-only", async () => {
    const migration = await Bun.file(migrationPath).text();
    const indexMigration = await Bun.file(indexMigrationPath).text();
    const command = (await Bun.file(commandPath).text()).toLowerCase();
    expect(migration).toContain("create or replace function public.get_weekly_pick_candidates");
    expect(migration).toContain("grant execute on function public.get_weekly_pick_candidates(date, text[], integer) to service_role;");
    expect(migration).not.toContain("grant execute on function public.get_weekly_pick_candidates(date, text[], integer) to anon");
    expect(command).not.toContain("publish_weekly_pick_set");
    expect(command).not.toContain("youtube.googleapis.com");
    expect(command).not.toContain("generativelanguage.googleapis.com");
    expect(indexMigration).toContain("weekly_pick_items (featured_media_item_id, source_id)");
  });

  test("treats curated catalog mappings as ingestion demand without removing lease demand", async () => {
    const migration = await Bun.file(migrationPath).text();
    expect(migration).toContain("from public.source_demand_leases as leases");
    expect(migration).toContain("from public.source_interests as mappings");
    expect(migration).toContain("and mappings.is_active");
    expect(migration).toContain("limit v_limit");
    expect(migration).toContain("for update of sync_state skip locked");
  });
});

function candidate(rank: number, sourceId: string): WeeklyPickCandidate {
  return {
    interestId: "tech",
    candidateRank: rank,
    sourceId,
    sourceProviderId: `provider-${rank}`,
    sourceDisplayName: `Source ${rank}`,
    featuredMediaItemId: sourceId.replace(/^./, "a"),
    featuredMediaTitle: `Video ${rank}`,
    featuredMediaPublishedAt: `2026-09-${String(20 + rank).padStart(2, "0")}T12:00:00.000Z`,
    lastPickedPeriodStart: null,
  };
}
