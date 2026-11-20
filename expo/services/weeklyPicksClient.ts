import { INTEREST_LIBRARY } from "../constants/interests";
import type { InterestId, ProviderId } from "../types";

export const WEEKLY_PICKS_REQUEST_TIMEOUT_MS = 10_000;
export const WEEKLY_PICKS_MAX_PER_INTEREST = 12;

export type WeeklyPicksResponseState = "fresh" | "cached" | "empty" | "maintenance" | "unavailable";

export type WeeklyPicksSource = {
  provider: ProviderId;
  providerSourceId: string;
  handle: string | null;
  displayName: string;
  description: string;
  thumbnailUrl: string | null;
};

export type WeeklyPicksFeaturedMedia = {
  provider: ProviderId;
  providerMediaId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isLivestream: boolean;
  isUpcomingPremiere: boolean;
};

export type WeeklyPicksPick = {
  order: number;
  fetchedAt?: number;
  reason: string | null;
  source: WeeklyPicksSource;
  featuredMedia?: WeeklyPicksFeaturedMedia;
};

export type WeeklyPicksInterest = {
  interestId: InterestId;
  publicationPeriod: { start: string; end: string };
  picks: WeeklyPicksPick[];
};

export type WeeklyPicksResponse = {
  state: WeeklyPicksResponseState;
  interests: WeeklyPicksInterest[];
  message?: string;
};

export type WeeklyPicksClientResult =
  | { status: "success"; response: WeeklyPicksResponse }
  | { status: "missing_configuration" }
  | { status: "invalid_request" }
  | { status: "unauthorized" }
  | { status: "http_unavailable" }
  | { status: "network_error" }
  | { status: "invalid_response" };

export type WeeklyPicksClient = {
  /** Local preparation only; public responses remain unchanged. */
  isPreparing?(profileId: string): boolean;
  policyVersion?: string;
  compatiblePolicyVersions?: readonly string[];
  getWeeklyPicks(interestIds: readonly InterestId[], profileId?: string): Promise<WeeklyPicksClientResult>;
};

type WeeklyPicksClientOptions = {
  supabaseUrl?: string;
  publishableKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const canonicalInterestIds = new Set<InterestId>(INTEREST_LIBRARY.map((interest) => interest.id));
const responseStates = new Set<WeeklyPicksResponseState>(["fresh", "cached", "empty", "maintenance", "unavailable"]);

/** Creates a profile-agnostic, read-only client for the public Weekly Picks function. */
export function createWeeklyPicksClient(options: WeeklyPicksClientOptions): WeeklyPicksClient {
  const endpoint = buildWeeklyPicksEndpoint(options.supabaseUrl);
  const publishableKey = options.publishableKey?.trim() ?? "";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? WEEKLY_PICKS_REQUEST_TIMEOUT_MS;

  return {
    async getWeeklyPicks(interestIds: readonly InterestId[]): Promise<WeeklyPicksClientResult> {
      if (!endpoint || !publishableKey) return { status: "missing_configuration" };
      const uniqueInterestIds = [...new Set(interestIds)];
      if (
        uniqueInterestIds.length === 0
        || uniqueInterestIds.length > canonicalInterestIds.size
        || uniqueInterestIds.some((interestId) => !canonicalInterestIds.has(interestId))
      ) return { status: "invalid_request" };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: publishableKey,
            },
            body: JSON.stringify({ interestIds: uniqueInterestIds }),
            signal: controller.signal,
          });
        } catch {
          return { status: "network_error" };
        }

        if (response.status === 401) return { status: "unauthorized" };
        if (response.status === 400 || response.status === 413) return { status: "invalid_request" };
        if (!response.ok) return { status: "http_unavailable" };

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return { status: "invalid_response" };
        }
        return isWeeklyPicksResponse(body)
          ? { status: "success", response: body }
          : { status: "invalid_response" };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/** Validates the complete public function contract without coercing partial data. */
export function isWeeklyPicksResponse(value: unknown, allowedInterests: ReadonlySet<string> = canonicalInterestIds): value is WeeklyPicksResponse {
  if (!isRecordWithOnlyKeys(value, ["state", "interests", "message"])) return false;
  if (typeof value.state !== "string" || !responseStates.has(value.state as WeeklyPicksResponseState)) return false;
  if (!Array.isArray(value.interests) || (value.message !== undefined && typeof value.message !== "string")) return false;
  if ((value.state === "empty" || value.state === "maintenance" || value.state === "unavailable") && value.interests.length !== 0) return false;
  if ((value.state === "fresh" || value.state === "cached") && value.interests.length === 0) return false;

  const seenInterestIds = new Set<string>();
  for (const interest of value.interests) {
    if (!isWeeklyPicksInterest(interest, allowedInterests) || seenInterestIds.has(interest.interestId)) return false;
    seenInterestIds.add(interest.interestId);
  }
  return true;
}

function buildWeeklyPicksEndpoint(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\/+$/, "") ?? "";
  if (!normalized) return null;
  try {
    const url = new URL(`${normalized}/functions/v1/weekly-picks`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isWeeklyPicksInterest(value: unknown, allowedInterests: ReadonlySet<string>): value is WeeklyPicksInterest {
  if (!isRecordWithOnlyKeys(value, ["interestId", "publicationPeriod", "picks"])) return false;
  if (typeof value.interestId !== "string" || !allowedInterests.has(value.interestId)) return false;
  if (!isPublicationPeriod(value.publicationPeriod)) return false;
  if (!Array.isArray(value.picks) || value.picks.length === 0 || value.picks.length > WEEKLY_PICKS_MAX_PER_INTEREST) return false;
  const orders = new Set<number>();
  for (const pick of value.picks) {
    if (!isWeeklyPicksPick(pick) || orders.has(pick.order)) return false;
    orders.add(pick.order);
  }
  return true;
}

function isPublicationPeriod(value: unknown): value is { start: string; end: string } {
  if (!isRecordWithOnlyKeys(value, ["start", "end"])) return false;
  return typeof value.start === "string"
    && typeof value.end === "string"
    && isCalendarDate(value.start)
    && isCalendarDate(value.end)
    && value.start <= value.end;
}

function isWeeklyPicksPick(value: unknown): value is WeeklyPicksPick {
  if (!isRecordWithOnlyKeys(value, ["order", "reason", "source", "featuredMedia", "fetchedAt"])) return false;
  if (value.fetchedAt !== undefined && (typeof value.fetchedAt !== "number" || !Number.isFinite(value.fetchedAt) || value.fetchedAt < 0)) return false;
  if (!Number.isInteger(value.order) || (value.order as number) < 1 || (value.order as number) > WEEKLY_PICKS_MAX_PER_INTEREST) return false;
  if (value.reason !== null && typeof value.reason !== "string") return false;
  if (!isWeeklyPicksSource(value.source)) return false;
  return value.featuredMedia === undefined || isWeeklyPicksFeaturedMedia(value.featuredMedia);
}

function isWeeklyPicksSource(value: unknown): value is WeeklyPicksSource {
  if (!isRecordWithOnlyKeys(value, ["provider", "providerSourceId", "handle", "displayName", "description", "thumbnailUrl"])) return false;
  return value.provider === "youtube"
    && isNonEmptyString(value.providerSourceId)
    && (value.handle === null || typeof value.handle === "string")
    && isNonEmptyString(value.displayName)
    && typeof value.description === "string"
    && isNullableString(value.thumbnailUrl);
}

function isWeeklyPicksFeaturedMedia(value: unknown): value is WeeklyPicksFeaturedMedia {
  if (!isRecordWithOnlyKeys(value, [
    "provider",
    "providerMediaId",
    "title",
    "description",
    "thumbnailUrl",
    "publishedAt",
    "durationSeconds",
    "isLivestream",
    "isUpcomingPremiere",
  ])) return false;
  return value.provider === "youtube"
    && isNonEmptyString(value.providerMediaId)
    && isNonEmptyString(value.title)
    && typeof value.description === "string"
    && isNullableString(value.thumbnailUrl)
    && (value.publishedAt === null || (typeof value.publishedAt === "string" && !Number.isNaN(Date.parse(value.publishedAt))))
    && (value.durationSeconds === null || (Number.isInteger(value.durationSeconds) && (value.durationSeconds as number) >= 0))
    && typeof value.isLivestream === "boolean"
    && typeof value.isUpcomingPremiere === "boolean";
}

function isRecordWithOnlyKeys(value: unknown, allowedKeys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export const weeklyPicksClient: WeeklyPicksClient = createWeeklyPicksClient({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
