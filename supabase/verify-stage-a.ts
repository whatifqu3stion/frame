import { readFile } from "node:fs/promises";

// Explicitly invoked integration check, never part of the offline unit suite.
// Credentials remain server-side and neither SQL nor response internals are logged.
const approvedRef = "gzzazhqlphomzjndzrfm";
if (process.argv[2] !== "--approved-live-check") throw new Error("Explicit live-check confirmation is required.");
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("Authenticate the Supabase management tools before checking.");
const query = await readFile(new URL("./tests/pacific-quota.sql", import.meta.url), "utf8");
const response = await fetch(`https://api.supabase.com/v1/projects/${approvedRef}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, read_only: false }),
});
if (!response.ok) {
  const body: unknown = await response.json().catch(() => null);
  const message = typeof body === "object" && body !== null && "message" in body ? String(body.message) : "No diagnostic";
  // Only known assertion messages are safe to emit from the service response.
  const known = ["quota date boundary", "quota DST boundary", "ingestion kill switch", "resolution kill switch", "resolution must respect shared halt", "ingestion reservation", "resolution shared reservation", "shared ceiling", "denied request consumed quota", "quota exhaustion reset", "provider quota reset", "null reservation accepted", "public quota access", "bounded retention read", "expired media served", "expired source served", "source cleanup", "media cleanup"];
  throw new Error(`Stage A SQL check failed (HTTP ${response.status}): ${known.find((item) => message.includes(item)) ?? message.match(/ERROR:[^\n]*/)?.[0] ?? "inspect database diagnostics"}`);
}
const result: unknown = await response.json();
if (!Array.isArray(result) || result[0]?.result !== "Stage A quota and retention SQL assertions passed; transaction rolled back") throw new Error("Missing SQL acceptance result.");
console.log(result[0].result);
