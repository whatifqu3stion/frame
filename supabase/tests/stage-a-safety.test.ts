import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
const text = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("Stage A operational safeguards", () => {
  test("all YouTube accounting shares Pacific calendar helpers and reservations respect the halt", async () => {
    const sql = await text("../migrations/20260914120000_pacific_youtube_quota.sql");
    expect(sql).toContain("America/Los_Angeles");
    expect(sql.match(/v_usage_date date := public.youtube_quota_date\(\)/g)).toHaveLength(2);
    expect(sql).toContain("case when p_provider = 'youtube' then public.youtube_quota_date()");
    expect(sql).toContain("v_control.youtube_ingestion_halted_until > now()");
    expect(sql).toContain("v_controls.youtube_ingestion_halted_until > now()");
    expect(sql).not.toContain("youtube_ingestion_enabled = true");
    expect(sql).not.toContain("delete from");
    expect(sql).toContain("interval '25 hours'");
  });
  test("cached RPC enforces hard metadata limits before the bounded per-source selection", async () => {
    const sql = await text("../migrations/20260914123000_cached_metadata_retention.sql");
    expect(sql).toContain("s.metadata_expires_at > now()");
    expect(sql).toContain("media.metadata_expires_at > now()");
    expect(sql).toContain("media.metadata_fetched_at > now() - interval '30 days'");
    expect(sql).toContain("cross join lateral");
    expect(sql).toContain("least(coalesce(p_limit_per_source, 0), 20)");
    expect(sql).toContain("cardinality(p_provider_source_ids) between 1 and 25");
    expect(sql).toContain("from public, anon, authenticated");
  });
  test("retention uses a bounded provider-independent scheduled job and source reads enforce expiry", async () => {
    const sql = await text("../migrations/20260914123000_cached_metadata_retention.sql");
    expect(sql).toContain("cron.schedule('frame-metadata-retention'");
    expect(sql).toContain("select public.expire_stale_youtube_metadata(100)");
    expect(sql).toContain("for update of m skip locked");
    expect(sql).not.toContain("http_post");
    const edge = await text("../functions/source-feed/index.ts");
    expect(edge).toContain('.gt("metadata_expires_at"');
    expect(edge).toContain('.gt("metadata_fetched_at"');
  });
});
