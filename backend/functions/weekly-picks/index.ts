import { createClient } from "npm:@supabase/supabase-js@2";
import {
  executeWeeklyPicks,
  MAX_INTERESTS_PER_REQUEST,
  type PublishedPickRow,
  type ServiceState,
  type WeeklyPicksRepository,
} from "../_shared/weekly-picks.ts";
import {
  getSupabaseSecretKey,
  hasValidPublishableKey,
  readBoundedJsonBody,
} from "../_shared/edge-security.ts";

const corsHeaders: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const maxRequestBytes = 4096;

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, "no-store", { state: "unavailable", interests: [], message: "Use POST." });
  if (!hasValidPublishableKey(request, Deno.env.get)) {
    return jsonResponse(401, "no-store", { state: "unavailable", interests: [], message: "A valid client API key is required." });
  }

  const body = await readBoundedJsonBody(request, maxRequestBytes);
  if (!body.ok) {
    return jsonResponse(body.status, "no-store", { state: "unavailable", interests: [], message: body.message });
  }

  const repository = createRepository();
  if (!repository) {
    return jsonResponse(503, "no-store", { state: "unavailable", interests: [], message: "Weekly Picks are unavailable." });
  }

  const result = await executeWeeklyPicks(body.value, repository);
  return jsonResponse(result.status, result.cacheControl, result.body);
});

function createRepository(): WeeklyPicksRepository | null {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = getSupabaseSecretKey(Deno.env.get);
  if (!url || !secretKey) return null;
  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async getServiceState(): Promise<ServiceState | null> {
      const { data, error } = await client
        .from("service_controls")
        .select("weekly_picks_enabled,maintenance_mode")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .maybeSingle();
      if (error) throw new Error("service controls unavailable");
      if (!isRecord(data)) return null;
      return {
        weeklyPicksEnabled: data.weekly_picks_enabled === true,
        maintenanceMode: data.maintenance_mode === true,
      };
    },

    async getActiveInterestIds(interestIds: readonly string[]): Promise<readonly string[]> {
      const { data, error } = await client
        .from("interest_categories")
        .select("id")
        .in("id", [...interestIds])
        .eq("is_active", true)
        .limit(MAX_INTERESTS_PER_REQUEST);
      if (error) throw new Error("interest validation unavailable");
      return Array.isArray(data)
        ? data.flatMap((item: unknown) => isRecord(item) && typeof item.id === "string" ? [item.id] : [])
        : [];
    },

    async getCurrentPublishedPicks(interestIds: readonly string[]): Promise<readonly PublishedPickRow[]> {
      const { data, error } = await client.rpc("get_current_weekly_picks", { p_interest_ids: [...interestIds] });
      if (error) throw new Error("weekly picks unavailable");
      return Array.isArray(data) ? data.flatMap(mapDatabaseRow) : [];
    },
  };
}

function mapDatabaseRow(value: unknown): PublishedPickRow[] {
  if (!isRecord(value)) return [];
  const requiredStrings = [
    value.pick_set_status,
    value.period_start,
    value.period_end,
    value.interest_id,
    value.source_provider,
    value.source_provider_id,
    value.source_display_name,
  ];
  if (!requiredStrings.every((item: unknown) => typeof item === "string") || typeof value.pick_order !== "number") return [];

  return [{
    pickSetStatus: value.pick_set_status as string,
    periodStart: value.period_start as string,
    periodEnd: value.period_end as string,
    interestId: value.interest_id as string,
    pickOrder: value.pick_order,
    publicReason: optionalString(value.public_reason),
    sourceProvider: value.source_provider as string,
    sourceProviderId: value.source_provider_id as string,
    sourceHandle: optionalString(value.source_handle),
    sourceDisplayName: value.source_display_name as string,
    sourceDescription: optionalString(value.source_description) ?? "",
    sourceThumbnailUrl: optionalString(value.source_thumbnail_url),
    mediaProvider: optionalString(value.media_provider),
    mediaProviderId: optionalString(value.media_provider_id),
    mediaTitle: optionalString(value.media_title),
    mediaDescription: optionalString(value.media_description),
    mediaThumbnailUrl: optionalString(value.media_thumbnail_url),
    mediaPublishedAt: optionalString(value.media_published_at),
    mediaDurationSeconds: typeof value.media_duration_seconds === "number" ? value.media_duration_seconds : null,
    mediaIsLivestream: typeof value.media_is_livestream === "boolean" ? value.media_is_livestream : null,
    mediaIsUpcomingPremiere: typeof value.media_is_upcoming_premiere === "boolean" ? value.media_is_upcoming_premiere : null,
  }];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(status: number, cacheControl: string, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Accept-Encoding",
    },
  });
}
