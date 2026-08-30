import { describe, expect, test } from "bun:test";

const catalogPath = new URL("../migrations/20260830150000_shared_catalog.sql", import.meta.url);
const leasesPath = new URL("../migrations/20260830230000_source_demand_leases.sql", import.meta.url);

async function sql(url: URL): Promise<string> {
  return await Bun.file(url).text();
}

describe("Round 3A shared source demand foundation", () => {
  test("preserves one shared source per provider identity", async () => {
    const catalog = await sql(catalogPath);
    const leases = await sql(leasesPath);
    expect(catalog).toContain("unique (provider, provider_source_id)");
    expect(leases).toContain("references public.sources(id) on update restrict on delete restrict");
    expect(leases).not.toMatch(/create\s+table[^;]+(?:source_registry|demand_sources)/i);
  });

  test("stores only bounded anonymous lease hashes and expiration timestamps", async () => {
    const migration = await sql(leasesPath);
    const tableDefinition = migration.match(/create table if not exists public\.source_demand_leases \(([\s\S]*?)\n\);/)?.[1] ?? "";
    expect(tableDefinition).toContain("lease_token_hash text not null unique");
    expect(tableDefinition).toContain("check (lease_token_hash ~ '^[0-9a-f]{64}$')");
    expect(tableDefinition).toContain("expires_at > renewed_at");
    expect(tableDefinition).toContain("expires_at <= renewed_at + interval '90 days'");
    for (const forbidden of ["profile", "user_id", "installation", "revenuecat", "google", "email", "ip_address", "fingerprint", "plaintext", "token text"]) {
      expect(tableDefinition.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("adds only active-source and expiration cleanup indexes", async () => {
    const migration = await sql(leasesPath);
    expect(migration).toContain("on public.source_demand_leases (source_id, expires_at)");
    expect(migration).toContain("on public.source_demand_leases (expires_at)");
    expect(migration.match(/create index if not exists source_demand_leases_/g)).toHaveLength(2);
  });

  test("validates and renews one lease without duplicating its hash", async () => {
    const migration = await sql(leasesPath);
    expect(migration).toContain("p_lease_token_hash !~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("p_expires_at <= now()");
    expect(migration).toContain("p_expires_at > now() + interval '90 days'");
    expect(migration).toContain("on conflict (lease_token_hash) do update");
    expect(migration).toContain("renewed_at = now()");
    expect(migration).toContain("lease token hash is already assigned to another source");
  });

  test("releases only one matching hash and purges only expired leases", async () => {
    const migration = await sql(leasesPath);
    expect(migration).toContain("where leases.lease_token_hash = p_lease_token_hash;");
    expect(migration).toContain("where leases.expires_at <= now();");
    expect(migration).not.toMatch(/delete\s+from\s+public\.sources/i);
  });

  test("keeps lease storage and functions service-role-only", async () => {
    const migration = await sql(leasesPath);
    expect(migration).toContain("alter table public.source_demand_leases enable row level security;");
    expect(migration).toContain("alter table public.source_demand_leases force row level security;");
    expect(migration).toContain("revoke all privileges on table public.source_demand_leases from public, anon, authenticated;");
    for (const signature of [
      "public.create_or_renew_source_demand_lease(uuid, text, timestamptz)",
      "public.release_source_demand_lease(text)",
      "public.purge_expired_source_demand_leases()",
    ]) {
      expect(migration).toContain(`revoke execute on function ${signature} from public, anon, authenticated;`);
      expect(migration).toContain(`grant execute on function ${signature} to service_role;`);
    }
    expect(migration.match(/security definer/g)).toHaveLength(3);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(3);
  });

  test("adds a disabled lease control without enabling unfinished services", async () => {
    const migration = await sql(leasesPath);
    expect(migration).toContain("source_leases_enabled boolean not null default false");
    expect(migration).toContain("controls.source_leases_enabled = false");
    expect(migration).toContain("controls.weekly_picks_enabled = false");
    expect(migration).toContain("controls.youtube_ingestion_enabled = false");
  });
});
