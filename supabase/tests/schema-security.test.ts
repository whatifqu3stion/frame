import { describe, expect, test } from "bun:test";

const catalogPath = new URL("../migrations/20260830150000_shared_catalog.sql", import.meta.url);
const controlsPath = new URL("../migrations/20260830150100_service_controls.sql", import.meta.url);
const readPath = new URL("../migrations/20260830150200_weekly_picks_read.sql", import.meta.url);
const hardenedReadPath = new URL("../migrations/20260830150300_harden_weekly_picks.sql", import.meta.url);
const taxonomyPath = new URL("../migrations/20260830210000_stabilize_discovery_taxonomy.sql", import.meta.url);
const publicationPath = new URL("../migrations/20260923193000_weekly_pick_publication.sql", import.meta.url);
const functionPath = new URL("../functions/weekly-picks/index.ts", import.meta.url);
const weeklyPicksLogicPath = new URL("../functions/_shared/weekly-picks.ts", import.meta.url);
const deploymentSyncPath = new URL("../sync-weekly-picks-deployment.ts", import.meta.url);
const mobileInterestsPath = new URL("../../expo/constants/interests.ts", import.meta.url);

const privateTableNames = [
  "profiles",
  "managed_profiles",
  "saved_videos",
  "watch_progress",
  "dismissals",
  "snoozes",
  "sessions",
  "appearance_preferences",
  "viewing_history",
];

async function sql(url: URL): Promise<string> {
  return await Bun.file(url).text();
}

describe("shared schema constraints", () => {
  test("rejects duplicate provider source and media IDs", async () => {
    const migration = await sql(catalogPath);
    expect(migration).toContain("unique (provider, provider_source_id)");
    expect(migration).toContain("unique (provider, provider_media_id)");
  });

  test("defines the same 15 canonical interests in database, Expo, and backend order", async () => {
    const migration = await sql(taxonomyPath);
    const mobileInterests = await Bun.file(mobileInterestsPath).text();
    const backendLogic = await Bun.file(weeklyPicksLogicPath).text();
    const canonicalValues = migration.match(/insert into public\.interest_categories[\s\S]*?values([\s\S]*?)on conflict \(id\)/)?.[1] ?? "";
    const backendValues = backendLogic.match(/STABLE_INTEREST_IDS = \[([\s\S]*?)\] as const/)?.[1] ?? "";
    const databaseRows = [...canonicalValues.matchAll(/\('([a-z]+)',\s*'([^']+)',\s*true,\s*(\d+)\)/g)]
      .map((match) => ({ id: match[1], label: match[2], order: Number(match[3]) }));
    const mobileRows = [...mobileInterests.matchAll(/id:\s*"([a-z]+)",\s*name:\s*"([^"]+)"/g)]
      .map((match, index) => ({ id: match[1], label: match[2], order: index + 1 }));
    const backendIds = [...backendValues.matchAll(/"([a-z]+)"/g)].map((match) => match[1]);
    expect(databaseRows).toHaveLength(15);
    expect(databaseRows).toEqual(mobileRows);
    expect(backendIds).toEqual(databaseRows.map((row) => row.id));
  });

  test("migrates all legacy source mappings without deletion", async () => {
    const migration = await sql(taxonomyPath);
    const expectedMappings = [
      ["photography", "design"], ["architecture", "design"], ["art", "design"],
      ["nature", "science"], ["philosophy", "learning"], ["literature", "learning"],
      ["writing", "learning"], ["essays", "learning"], ["interviews", "learning"], ["craft", "making"],
    ];
    for (const [legacyId, canonicalId] of expectedMappings) {
      expect(migration).toContain(`('${legacyId}', '${canonicalId}')`);
    }
    expect(migration).toContain("on conflict (source_id, interest_id) do update");
    expect(migration).not.toMatch(/delete\s+from/i);
  });

  test("rejects duplicate interest periods and limits each set to three positions", async () => {
    const migration = await sql(catalogPath);
    expect(migration).toContain("unique (interest_id, period_start, period_end)");
    expect(migration).toContain("check (display_order between 1 and 3)");
    expect(migration).toContain("unique (pick_set_id, display_order)");
  });

  test("publishes only bounded, validated, server-side Weekly Picks", async () => {
    const migration = await sql(publicationPath);
    expect(migration).toContain("create or replace function public.publish_weekly_pick_set");
    expect(migration).toContain("p_period_end <> p_period_start + 6");
    expect(migration).toContain("v_pick_count < 1 or v_pick_count > 3");
    expect(migration).toContain("A source may appear only once");
    expect(migration).toContain("sources.status = 'active'");
    expect(migration).toContain("media.source_id = v_source_id");
    expect(migration).toContain("not media.is_livestream");
    expect(migration).toContain("not media.is_upcoming_premiere");
    expect(migration).toContain("set status = 'published'");
    expect(migration).toContain("grant execute on function public.publish_weekly_pick_set(text, date, date, jsonb) to service_role;");
    expect(migration).not.toContain("grant execute on function public.publish_weekly_pick_set(text, date, date, jsonb) to anon");
    expect(migration).not.toContain("grant execute on function public.publish_weekly_pick_set(text, date, date, jsonb) to authenticated");
  });

  test("creates no cloud tables for private viewing behavior", async () => {
    const migrations = `${await sql(catalogPath)}\n${await sql(controlsPath)}\n${await sql(readPath)}\n${await sql(hardenedReadPath)}\n${await sql(taxonomyPath)}`;
    for (const tableName of privateTableNames) {
      expect(migrations).not.toMatch(new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${tableName}\\b`, "i"));
    }
  });
});

describe("database access boundary", () => {
  test("enables RLS and revokes anonymous and authenticated table privileges", async () => {
    const migrations = `${await sql(catalogPath)}\n${await sql(controlsPath)}`;
    const tables = [
      "interest_categories",
      "sources",
      "media_items",
      "source_interests",
      "weekly_pick_sets",
      "weekly_pick_items",
      "daily_provider_usage",
      "service_controls",
    ];
    for (const table of tables) {
      expect(migrations).toContain(`alter table public.${table} enable row level security;`);
      expect(migrations).toContain(`revoke all privileges on table public.${table} from anon, authenticated;`);
    }
  });

  test("allows only service-role execution of operational functions", async () => {
    const migrations = `${await sql(controlsPath)}\n${await sql(readPath)}\n${await sql(hardenedReadPath)}\n${await sql(publicationPath)}`;
    expect(migrations).toContain("revoke execute on function public.increment_daily_provider_usage(text, bigint, bigint) from public, anon, authenticated;");
    expect(migrations).toContain("grant execute on function public.increment_daily_provider_usage(text, bigint, bigint) to service_role;");
    expect(migrations).toContain("revoke execute on function public.get_current_weekly_picks(text[]) from public, anon, authenticated;");
    expect(migrations).toContain("grant execute on function public.get_current_weekly_picks(text[]) to service_role;");
    expect(migrations).toContain("revoke all on function public.publish_weekly_pick_set(text, date, date, jsonb) from public, anon, authenticated;");
    expect(migrations).toContain("grant execute on function public.publish_weekly_pick_set(text, date, date, jsonb) to service_role;");
  });

  test("database read function independently filters published current sets", async () => {
    const migration = await sql(hardenedReadPath);
    expect(migration).toContain("pick_sets.status = 'published'");
    expect(migration).toContain("pick_sets.published_at <= now()");
    expect(migration).toContain("between pick_sets.period_start and pick_sets.period_end");
    expect(migration).toContain("pick_items.display_order between 1 and 3");
    expect(migration).toContain("partition by pick_sets.interest_id");
    expect(migration).toContain("where publication_rank = 1");
  });

  test("keeps Supabase authoritative and Rork deployment files generated", async () => {
    const syncSource = await Bun.file(deploymentSyncPath).text();
    expect(syncSource).toContain('"weekly-picks/index.ts"');
    expect(syncSource).toContain('"_shared/weekly-picks.ts"');
    expect(syncSource).toContain("AUTO-GENERATED from supabase/functions");
  });

  test("Edge Function source contains no YouTube or AI integration", async () => {
    const source = (await Bun.file(functionPath).text()).toLowerCase();
    expect(source).not.toContain("youtube.googleapis.com");
    expect(source).not.toContain("generativelanguage.googleapis.com");
    expect(source).not.toContain("openai.com");
    expect(source).not.toContain("anthropic.com");
  });
});
