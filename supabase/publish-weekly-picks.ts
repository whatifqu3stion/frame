import { createClient } from "@supabase/supabase-js";
import {
  assertSupabaseProject,
  buildPublicationConfirmation,
  MAX_REVIEWED_PUBLICATION_BYTES,
  parseReviewedWeeklyPickBatch,
} from "./functions/_shared/weekly-pick-publication.ts";

const filePath = argument("file");
const projectRef = argument("project-ref");
if (!filePath) {
  throw new Error("Pass --file=PATH to one reviewed Weekly Picks JSON file.");
}
if (!projectRef) {
  throw new Error(
    "Pass --project-ref=REF for the exact Supabase project you reviewed.",
  );
}

const file = await Deno.readTextFile(filePath);
if (
  new TextEncoder().encode(file).byteLength > MAX_REVIEWED_PUBLICATION_BYTES
) throw new Error("The reviewed file is too large.");
let decoded: unknown;
try {
  decoded = JSON.parse(file) as unknown;
} catch {
  throw new Error("The reviewed file is not valid JSON.");
}
const batch = parseReviewedWeeklyPickBatch(decoded);
const confirmation = await buildPublicationConfirmation(projectRef, batch);
const execute = Deno.args.includes("--execute");

if (!execute) {
  console.log(JSON.stringify(
    {
      state: "review_required",
      projectRef,
      periodStart: batch.periodStart,
      periodEnd: batch.periodEnd,
      interests: batch.publications.map((publication) => ({
        interestId: publication.interestId,
        pickCount: publication.picks.length,
      })),
      confirmation,
      next: `Re-run with --execute --confirm=${confirmation}`,
    },
    null,
    2,
  ));
  Deno.exit(0);
}

if (argument("confirm") !== confirmation) {
  throw new Error(
    "Execution requires the exact confirmation emitted by a dry run of this file.",
  );
}
const url = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
const secretKey = Deno.env.get("SUPABASE_SECRET_KEY")?.trim() ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
if (!url || !secretKey) {
  throw new Error(
    "SUPABASE_URL and a server-only Supabase secret key are required for execution.",
  );
}
assertSupabaseProject(url, projectRef);

const client = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.rpc("publish_weekly_pick_batch", {
  p_period_start: batch.periodStart,
  p_period_end: batch.periodEnd,
  p_publications: batch.publications,
});
if (error) {
  throw new Error(
    "Publication did not return a confirmed success. Verify this period in the operator console before retrying.",
  );
}
const published = parsePublishedRows(
  data,
  batch.publications.map((publication) => publication.interestId),
);
console.log(
  JSON.stringify(
    {
      state: "published",
      projectRef,
      periodStart: batch.periodStart,
      published,
    },
    null,
    2,
  ),
);

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  const match = Deno.args.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function parsePublishedRows(
  value: unknown,
  expectedInterests: readonly string[],
): { interestId: string; setId: string }[] {
  if (!Array.isArray(value) || value.length !== expectedInterests.length) {
    throw new Error(
      "Publication completed with an unexpected response. Verify the period in the operator console.",
    );
  }
  const rows = value.map((row) => {
    if (
      !isRecord(row) || typeof row.interest_id !== "string" ||
      typeof row.set_id !== "string"
    ) throw new Error("Publication returned an invalid response.");
    return { interestId: row.interest_id, setId: row.set_id };
  });
  if (rows.some((row, index) => row.interestId !== expectedInterests[index])) {
    throw new Error("Publication returned interests in an unexpected order.");
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
