import { describe, expect, test } from "bun:test";

const catalogPath = new URL("../migrations/20260830150000_shared_catalog.sql", import.meta.url);
const controlsPath = new URL("../migrations/20260830150100_service_controls.sql", import.meta.url);
const readPath = new URL("../migrations/20260830150200_weekly_picks_read.sql", import.meta.url);
const hardenedReadPath = new URL("../migrations/20260830150300_harden_weekly_picks.sql", import.meta.url);
const functionPath = new URL("../functions/weekly-picks/index.ts", import.meta.url);
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

  test("seeds exactly the existing mobile interest taxonomy", async () => {
    const migration = await sql(catalogPath);
    const mobileInterests = await Bun.file(mobileInterestsPath).text();
    const seededIds = [...migration.matchAll(/\('([a-z]+)',\s*'[^']+',\s*\d+\)/g)].map((match) => match[1]);
    const mobileIds = [...mobileInterests.matchAll(/id:\s*"([a-z]+)"/g)].map((match) => match[1]);
    expect(seededIds).toEqual(mobileIds);
  });

  test("rejects duplicate interest periods and limits each set to three positions", async () => {
    const migration = await sql(catalogPath);
    expect(migration).toContain("unique (interest_id, period_start, period_end)");
    expect(migration).toContain("check (display_order between 1 and 3)");
    expect(migration).toContain("unique (pick_set_id, display_order)");
  });

  test("creates no cloud tables for private viewing behavior", async () => {
    const migrations = `${await sql(catalogPath)}\n${await sql(controlsPath)}\n${await sql(readPath)}\n${await sql(hardenedReadPath)}`;
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
    const migrations = `${await sql(controlsPath)}\n${await sql(readPath)}\n${await sql(hardenedReadPath)}`;
    expect(migrations).toContain("revoke execute on function public.increment_daily_provider_usage(text, bigint, bigint) from public, anon, authenticated;");
    expect(migrations).toContain("grant execute on function public.increment_daily_provider_usage(text, bigint, bigint) to service_role;");
    expect(migrations).toContain("revoke execute on function public.get_current_weekly_picks(text[]) from public, anon, authenticated;");
    expect(migrations).toContain("grant execute on function public.get_current_weekly_picks(text[]) to service_role;");
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

  test("Edge Function source contains no YouTube or AI integration", async () => {
    const source = (await Bun.file(functionPath).text()).toLowerCase();
    expect(source).not.toContain("youtube.googleapis.com");
    expect(source).not.toContain("generativelanguage.googleapis.com");
    expect(source).not.toContain("openai.com");
    expect(source).not.toContain("anthropic.com");
  });
});
