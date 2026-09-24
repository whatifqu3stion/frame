import { describe, expect, test } from "bun:test";
import {
  assertSupabaseProject,
  buildPublicationConfirmation,
  parseReviewedWeeklyPickBatch,
} from "../functions/_shared/weekly-pick-publication";

const migrationPath = new URL("../migrations/20260924160000_weekly_pick_batch_publication.sql", import.meta.url);
const commandPath = new URL("../publish-weekly-picks.ts", import.meta.url);

describe("reviewed Weekly Picks publication", () => {
  test("normalizes one exact bounded reviewed batch", () => {
    expect(parseReviewedWeeklyPickBatch(reviewed())).toEqual({
      periodStart: "2026-09-28",
      periodEnd: "2026-10-04",
      publications: [{
        interestId: "tech",
        picks: [{
          sourceId: "11111111-1111-4111-8111-111111111111",
          featuredMediaItemId: "22222222-2222-4222-8222-222222222222",
          reason: "A calm reason with normalized spacing.",
        }],
      }],
    });
  });

  test("rejects stale periods, duplicates, extra metadata, invalid IDs, and promotional links", () => {
    const invalid: unknown[] = [
      { ...reviewed(), periodEnd: "2026-10-05" },
      { ...reviewed(), publications: [reviewed().publications[0], reviewed().publications[0]] },
      { ...reviewed(), profileId: "private" },
      { ...reviewed(), publications: [{ interestId: "tech", picks: [{ ...reviewed().publications[0].picks[0], sourceId: "youtube-id" }] }] },
      { ...reviewed(), publications: [{ interestId: "tech", picks: [{ ...reviewed().publications[0].picks[0], reason: "Visit https://example.com" }] }] },
    ];
    for (const value of invalid) expect(() => parseReviewedWeeklyPickBatch(value)).toThrow();
  });

  test("binds confirmation to the exact normalized payload and project", async () => {
    const batch = parseReviewedWeeklyPickBatch(reviewed());
    const first = await buildPublicationConfirmation("abcdefghijklmnopqrst", batch);
    expect(first).toMatch(/^publish:abcdefghijklmnopqrst:2026-09-28:[0-9a-f]{16}$/);
    expect(await buildPublicationConfirmation("different-project-ref", batch)).not.toBe(first);
    const changed = parseReviewedWeeklyPickBatch({ ...reviewed(), publications: [{ interestId: "tech", picks: [{ ...reviewed().publications[0].picks[0], reason: null }] }] });
    expect(await buildPublicationConfirmation("abcdefghijklmnopqrst", changed)).not.toBe(first);
  });

  test("requires the reviewed project reference to match the Supabase URL", () => {
    expect(assertSupabaseProject("https://abcdefghijklmnopqrst.supabase.co", "abcdefghijklmnopqrst").hostname).toBe("abcdefghijklmnopqrst.supabase.co");
    expect(() => assertSupabaseProject("https://different-project-ref.supabase.co", "abcdefghijklmnopqrst")).toThrow();
    expect(assertSupabaseProject("http://127.0.0.1:54321", "local").hostname).toBe("127.0.0.1");
  });

  test("keeps publication service-role-only, atomic, reviewed, and provider-free", async () => {
    const migration = await Bun.file(migrationPath).text();
    const command = (await Bun.file(commandPath).text()).toLowerCase();
    expect(migration).toContain("create or replace function public.publish_weekly_pick_batch");
    expect(migration).toContain("or p_period_end is null");
    expect(migration).toContain("not (v_pick ?& array['sourceId', 'featuredMediaItemId', 'reason'])");
    expect(migration).toContain("select public.publish_weekly_pick_set(");
    expect(migration).toContain("grant execute on function public.publish_weekly_pick_batch(date, date, jsonb) to service_role;");
    expect(migration).not.toContain("grant execute on function public.publish_weekly_pick_batch(date, date, jsonb) to anon");
    expect(command).toContain('deno.args.includes("--execute")');
    expect(command).toContain('argument("confirm") !== confirmation');
    expect(command).toContain('argument("project-ref")');
    expect(command).toContain('client.rpc("publish_weekly_pick_batch"');
    expect(command).toContain("verify this period in the operator console before retrying");
    expect(command).not.toContain("nothing in this transaction was published");
    expect(command).not.toContain("youtube.googleapis.com");
    expect(command).not.toContain("generativelanguage.googleapis.com");
  });
});

function reviewed() {
  return {
    periodStart: "2026-09-28",
    periodEnd: "2026-10-04",
    publications: [{
      interestId: "tech",
      picks: [{
        sourceId: "11111111-1111-4111-8111-111111111111",
        featuredMediaItemId: "22222222-2222-4222-8222-222222222222",
        reason: "  A calm reason   with normalized spacing. ",
      }],
    }],
  };
}
