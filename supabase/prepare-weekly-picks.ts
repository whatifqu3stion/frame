import { createClient } from "@supabase/supabase-js";
import { STABLE_INTEREST_IDS } from "./functions/_shared/weekly-picks.ts";
import { buildWeeklyPickDrafts, parseWeeklyPickCandidates, weeklyPeriodEnd } from "./weekly-pick-preparation.ts";

const periodStart = argument("period-start");
if (!periodStart) throw new Error("Pass --period-start=YYYY-MM-DD for a Monday.");
weeklyPeriodEnd(periodStart);

const requestedInterests = (argument("interests") ?? STABLE_INTEREST_IDS.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const stableInterests = new Set<string>(STABLE_INTEREST_IDS);
if (requestedInterests.length === 0 || requestedInterests.some((interest) => !stableInterests.has(interest))) {
  throw new Error("Every requested interest must be a canonical Frame interest.");
}

const url = Deno.env.get("SUPABASE_URL");
const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !secretKey) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");

const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.rpc("get_weekly_pick_candidates", {
  p_period_start: periodStart,
  p_interest_ids: [...new Set(requestedInterests)],
  p_limit_per_interest: 6,
});
if (error) throw new Error("Weekly Pick candidates are unavailable.");

const candidates = parseWeeklyPickCandidates(data);
const drafts = buildWeeklyPickDrafts(candidates, periodStart);

// This command is intentionally read-only. A separate protected publication
// call must review and submit each exact publishPayload.
console.log(JSON.stringify({ periodStart, drafts }, null, 2));

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  const match = Deno.args.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}
