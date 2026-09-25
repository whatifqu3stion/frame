import { createClient } from "@supabase/supabase-js";
import { executeDeepFind, geminiChannelQuery, hasServerPremiumEntitlement, type DeepFindDependencies, type DeepFindReservation, type DeepFindResponse } from "../_shared/deep-find.ts";
import { getSupabaseSecretKey, hasValidPublishableKey, readBoundedJsonBody } from "../_shared/edge-security.ts";
import type { SanitizedSource } from "../_shared/source-resolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const modelPattern = /^gemini-[a-z0-9._-]{1,64}$/;
const channelPattern = /^UC[A-Za-z0-9_-]{22}$/;
const timeoutMs = 12_000;

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { state: "invalid_request", message: "Use POST." });
  if (!hasValidPublishableKey(request, Deno.env.get)) {
    return jsonResponse(401, { state: "invalid_request", message: "A valid client API key is required." });
  }
  const body = await readBoundedJsonBody(request, 1024);
  if (!body.ok) return jsonResponse(body.status, { state: "invalid_request", message: body.message });

  const url = Deno.env.get("SUPABASE_URL");
  const secret = getSupabaseSecretKey(Deno.env.get);
  const rcSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY")?.trim();
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  const model = Deno.env.get("DEEP_FIND_GEMINI_MODEL")?.trim() ?? "";
  const youtubeKey = Deno.env.get("YOUTUBE_API_KEY")?.trim();
  const environment = Deno.env.get("FRAME_ENV");
  if (!url || !secret || !rcSecret || !geminiKey || !youtubeKey || !modelPattern.test(model)
    || !["development", "staging", "production"].includes(environment ?? "")) {
    return jsonResponse(503, { state: "unavailable", message: "Deep Find is not configured." });
  }

  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await executeDeepFind(body.value, createDependencies(client, rcSecret, geminiKey, model, youtubeKey, environment!));
  return jsonResponse(statusFor(result), result);
});

function createDependencies(
  client: ReturnType<typeof createClient>, rcSecret: string, geminiKey: string, model: string, youtubeKey: string, environment: string,
): DeepFindDependencies {
  return {
    async verifyPremium(identity): Promise<boolean> {
      const response = await timedFetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(identity)}`, {
        headers: { Authorization: `Bearer ${rcSecret}`, Accept: "application/json" },
      });
      if (!response.ok) throw new Error("entitlement check unavailable");
      return hasServerPremiumEntitlement(await response.json(), Date.now(), environment === "development" || environment === "staging");
    },
    async getRemaining(identity) {
      const [{ data: controls, error: controlError }, { data: rows, error: usageError }] = await Promise.all([
        client.from("service_controls").select("deep_find_enabled,maintenance_mode").single(),
        client.rpc("paid_deep_find_remaining", { p_installation_token: identity }),
      ]);
      const row = Array.isArray(rows) ? record(rows[0]) : null;
      if (controlError || usageError || !controls || !row || typeof row.remaining !== "number" || typeof row.reset_at !== "string") throw new Error("usage unavailable");
      return { remaining: row.remaining, resetAt: row.reset_at, enabled: controls.deep_find_enabled === true && controls.maintenance_mode !== true };
    },
    async reserve(identity): Promise<DeepFindReservation> {
      const { data, error } = await client.rpc("reserve_paid_deep_find", { p_installation_token: identity });
      const row = Array.isArray(data) ? record(data[0]) : null;
      if (error || !row || typeof row.outcome !== "string" || typeof row.remaining !== "number" || typeof row.reset_at !== "string") throw new Error("reservation unavailable");
      if (!["reserved", "disabled", "allowance_exhausted", "quota_exhausted"].includes(row.outcome)) throw new Error("reservation invalid");
      return { outcome: row.outcome as DeepFindReservation["outcome"], remaining: row.remaining, resetAt: row.reset_at, reservationId: typeof row.reservation_id === "string" ? row.reservation_id : null };
    },
    async release(identity, reservationId) {
      const { data, error } = await client.rpc("release_paid_deep_find", { p_installation_token: identity, p_reservation_id: reservationId });
      if (error || data !== true) throw new Error("reservation release unavailable");
    },
    async translate(query): Promise<string> {
      const response = await timedFetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          model,
          input: `Turn this specific request into one short YouTube channel search query. Do not include private user details or unsupported claims. Return only JSON. Request: ${JSON.stringify(query)}`,
          store: false,
          response_format: { type: "text", mime_type: "application/json", schema: {
            type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false,
          } },
        }),
      });
      if (!response.ok) throw new Error("translation unavailable");
      return geminiChannelQuery(await response.json());
    },
    async searchChannels(query): Promise<readonly string[]> {
      const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
      for (const [key, value] of Object.entries({ part: "id", type: "channel", maxResults: "3", q: query, key: youtubeKey })) endpoint.searchParams.set(key, value);
      const response = await timedFetch(endpoint);
      if (!response.ok) throw new Error("search unavailable");
      const data = record(await response.json());
      if (!data || !Array.isArray(data.items)) throw new Error("search invalid");
      return data.items.flatMap((item: unknown) => {
        const id = record(record(item)?.id)?.channelId;
        return typeof id === "string" && channelPattern.test(id) ? [id] : [];
      });
    },
    async verifyChannels(ids): Promise<readonly SanitizedSource[]> {
      if (ids.length === 0 || ids.length > 3 || ids.some((id) => !channelPattern.test(id))) throw new Error("invalid channels");
      const endpoint = new URL("https://www.googleapis.com/youtube/v3/channels");
      for (const [key, value] of Object.entries({ part: "snippet", id: ids.join(","), key: youtubeKey })) endpoint.searchParams.set(key, value);
      const response = await timedFetch(endpoint);
      if (!response.ok) throw new Error("channel verification unavailable");
      const data = record(await response.json());
      if (!data || !Array.isArray(data.items)) throw new Error("channel verification invalid");
      return data.items.flatMap((item: unknown) => {
        const row = record(item);
        const snippet = record(row?.snippet);
        const channelId = row?.id;
        if (typeof channelId !== "string" || !ids.includes(channelId) || !channelPattern.test(channelId) || typeof snippet?.title !== "string") return [];
        const thumbs = record(snippet.thumbnails);
        const thumbnail = record(thumbs?.high)?.url ?? record(thumbs?.default)?.url;
        return [{
          provider: "youtube" as const,
          providerSourceId: channelId,
          handle: typeof snippet.customUrl === "string" ? snippet.customUrl : null,
          displayName: snippet.title,
          description: typeof snippet.description === "string" ? snippet.description : "",
          thumbnailUrl: typeof thumbnail === "string" && thumbnail.startsWith("https://") ? thumbnail : null,
        }];
      });
    },
    async cacheSources(sources) {
      const now = new Date();
      const expires = new Date(now.getTime() + 29 * 86_400_000);
      const { error } = await client.from("sources").upsert(sources.map((source) => ({
        provider: source.provider,
        provider_source_id: source.providerSourceId,
        handle: source.handle,
        display_name: source.displayName,
        description: source.description,
        thumbnail_url: source.thumbnailUrl,
        status: "active",
        metadata_fetched_at: now.toISOString(),
        metadata_expires_at: expires.toISOString(),
      })), { onConflict: "provider,provider_source_id" });
      if (error) throw new Error("source caching unavailable");
    },
  };
}

async function timedFetch(input: string | URL, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(input, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function statusFor(response: DeepFindResponse): number {
  if (response.state === "invalid_request") return 400;
  if (response.state === "premium_required") return 403;
  if (response.state === "allowance_exhausted" || response.state === "quota_exhausted") return 429;
  return response.state === "disabled" || response.state === "unavailable" ? 503 : 200;
}

function jsonResponse(status: number, body: DeepFindResponse | Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
