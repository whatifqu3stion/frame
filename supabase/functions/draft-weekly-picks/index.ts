import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, readBoundedJsonBody } from "../_shared/edge-security.ts";
import {
  buildWeeklyPickAiPrompt,
  executeWeeklyPickDrafting,
  weeklyPickAiResponseSchema,
  type WeeklyPickAiProvider,
  type WeeklyPickDraftingRepository,
  type WeeklyPickDraftingResponse,
} from "../_shared/weekly-pick-drafting.ts";

const workerTokenPattern = /^[0-9a-f]{64}$/;
const modelPattern = /^gemini-[a-z0-9._-]{1,64}$/;
const requestTimeoutMs = 20_000;

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return jsonResponse(405, { state: "invalid_request", message: "Use POST." });

  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = getSupabaseSecretKey(Deno.env.get);
  if (!url || !secretKey) return jsonResponse(503, { state: "unavailable", message: "Drafting is not configured." });

  const token = request.headers.get("x-frame-worker-token")?.trim() ?? "";
  if (!workerTokenPattern.test(token)) return jsonResponse(401, { state: "unavailable", message: "Unauthorized." });

  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authorized, error: authorizationError } = await client.rpc("authorize_source_sync_worker", { p_token: token });
  if (authorizationError || authorized !== true) return jsonResponse(401, { state: "unavailable", message: "Unauthorized." });

  const body = await readBoundedJsonBody(request, 2_048);
  if (!body.ok) return jsonResponse(body.status, { state: "invalid_request", message: body.message });

  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim() ?? "";
  const model = Deno.env.get("WEEKLY_PICKS_GEMINI_MODEL")?.trim() ?? "";
  if (!apiKey || !modelPattern.test(model)) {
    return jsonResponse(503, { state: "unavailable", message: "AI drafting is not configured." });
  }

  const result = await executeWeeklyPickDrafting(body.value, createRepository(client), createGeminiProvider(apiKey, model));
  return jsonResponse(statusFor(result), result);
});

function createRepository(client: ReturnType<typeof createClient>): WeeklyPickDraftingRepository {
  return {
    async getCandidates(periodStart, interestIds, limitPerInterest): Promise<unknown> {
      const { data, error } = await client.rpc("get_weekly_pick_candidates", {
        p_period_start: periodStart,
        p_interest_ids: [...interestIds],
        p_limit_per_interest: limitPerInterest,
      });
      if (error) throw new Error("candidate read unavailable");
      return data;
    },

    async reserveAiRequest() {
      const { data, error } = await client.rpc("reserve_weekly_pick_ai_request");
      if (error || !Array.isArray(data) || !isRecord(data[0])) return "unavailable";
      const outcome = data[0].outcome;
      return outcome === "reserved" || outcome === "disabled" || outcome === "quota_exhausted"
        ? outcome
        : "unavailable";
    },
  };
}

function createGeminiProvider(apiKey: string, model: string): WeeklyPickAiProvider {
  return {
    async generateDraft(request): Promise<unknown> {
      const interestIds = [...new Set(request.candidates.map((candidate) => candidate.interestId))];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            model,
            input: buildWeeklyPickAiPrompt(request),
            store: false,
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: weeklyPickAiResponseSchema(interestIds),
            },
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("AI request unavailable");
        const value = await response.json().catch(() => null) as unknown;
        if (!isRecord(value) || typeof value.output_text !== "string") throw new Error("AI response invalid");
        return JSON.parse(value.output_text) as unknown;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function statusFor(result: WeeklyPickDraftingResponse): number {
  if (result.state === "invalid_request") return 400;
  if (result.state === "quota_exhausted") return 429;
  if (result.state === "unavailable") return 503;
  return 200;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
