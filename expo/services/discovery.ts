import { FOUNDATION_CAPABILITIES, WEEKLY_DISCOVERY_DISPLAY_MAX } from "../constants/productConfig";
import type { DiscoveryResult, InterestId, SourceResolution, TodayFeedResult, WeeklyPickSourceSuggestion } from "../types";
import {
  weeklyPicksClient,
  type WeeklyPicksClient,
  type WeeklyPicksClientResult,
  type WeeklyPicksResponse,
} from "./weeklyPicksClient";

export type DiscoveryService = {
  getWeeklyPicks(profileId: string, interestIds: readonly InterestId[]): Promise<DiscoveryResult>;
  getTodayFeed(profileId: string): Promise<TodayFeedResult>;
};

const UNAVAILABLE_MESSAGE = "Shared discovery is not available until Frame's bounded recommendation service is ready.";

/** Prevents Weekly Picks work for profiles that have not chosen interests. */
export function shouldRequestWeeklyPicks(interestIds: readonly InterestId[], enabled: boolean = FOUNDATION_CAPABILITIES.weeklyDiscovery): boolean {
  return enabled && interestIds.length > 0;
}

/** Creates the service boundary that keeps profile identity separate from the shared request. */
export function createDiscoveryService(client: WeeklyPicksClient, enabled: boolean = FOUNDATION_CAPABILITIES.weeklyDiscovery): DiscoveryService {
  return {
    async getWeeklyPicks(_profileId: string, interestIds: readonly InterestId[]): Promise<DiscoveryResult> {
      if (interestIds.length === 0) {
        return { status: "success", items: [], reason: "no_interests", message: "Choose interests in Settings to receive occasional source suggestions." };
      }
      if (!enabled) return { status: "temporarily_unavailable", items: [], reason: "configuration", message: "Weekly Picks are not available in this build yet." };
      const result = await client.getWeeklyPicks(interestIds);
      return mapWeeklyPicksClientResult(result);
    },
    async getTodayFeed(): Promise<TodayFeedResult> {
      return { status: "backend_allowance_unavailable", items: [], message: UNAVAILABLE_MESSAGE };
    },
  };
}

export function mapWeeklyPicksClientResult(result: WeeklyPicksClientResult): DiscoveryResult {
  if (result.status === "missing_configuration" || result.status === "unauthorized") {
    return {
      status: "backend_allowance_unavailable",
      items: [],
      reason: "configuration",
      message: "Prepare this week’s picks with your YouTube and Gemini keys.",
    };
  }
  if (result.status === "network_error") {
    return {
      status: "network_error",
      items: [],
      reason: "offline",
      message: "Weekly picks need a connection. Your sources and preferences were not changed.",
    };
  }
  if (result.status === "invalid_request") {
    return {
      status: "temporarily_unavailable",
      items: [],
      reason: "backend",
      message: "Weekly picks could not be requested right now.",
    };
  }
  if (result.status === "http_unavailable" || result.status === "invalid_response") {
    return {
      status: "temporarily_unavailable",
      items: [],
      reason: "backend",
      message: "The weekly service is unavailable right now.",
    };
  }
  return mapWeeklyPicksResponse(result.response);
}

function mapWeeklyPicksResponse(response: WeeklyPicksResponse): DiscoveryResult {
  if (response.state === "maintenance") {
    return {
      status: "temporarily_unavailable",
      items: [],
      reason: "maintenance",
      message: "Weekly picks are paused while Frame prepares the next publication.",
    };
  }
  if (response.state === "unavailable") {
    return {
      status: "temporarily_unavailable",
      items: [],
      reason: "backend",
      message: "The weekly service is unavailable right now.",
    };
  }
  if (response.state === "empty") {
    return { status: "success", items: [], reason: "empty", message: response.message ?? "No Weekly Picks are published for these interests." };
  }

  const items = selectWeeklyPickSuggestions(response);
  return {
    status: response.state === "cached" ? "cached_success" : "success",
    items,
    ...(response.message ? { message: response.message } : {}),
  };
}

/**
 * Selects one pick per interest before taking a second from any interest.
 * The result is deterministic, globally bounded, and deduplicated by source.
 */
export function selectWeeklyPickSuggestions(
  response: WeeklyPicksResponse,
  maximum: number = WEEKLY_DISCOVERY_DISPLAY_MAX,
): WeeklyPickSourceSuggestion[] {
  if (!Number.isInteger(maximum) || maximum <= 0) return [];
  const orderedGroups = response.interests.map((interest) => ({
    interest,
    picks: [...interest.picks].sort((left, right) => left.order - right.order),
    cursor: 0,
  }));
  const suggestions: WeeklyPickSourceSuggestion[] = [];
  const seenSources = new Set<string>();

  let madeProgress = true;
  while (madeProgress && suggestions.length < maximum) {
    madeProgress = false;
    for (const group of orderedGroups) {
      while (group.cursor < group.picks.length) {
        const pick = group.picks[group.cursor];
        group.cursor += 1;
        const sourceKey = `${pick.source.provider}:${pick.source.providerSourceId}`;
        if (seenSources.has(sourceKey)) continue;
        seenSources.add(sourceKey);
        suggestions.push(mapPublicSourceSuggestion(group.interest, pick));
        madeProgress = true;
        break;
      }
      if (suggestions.length >= maximum) break;
    }
  }
  return suggestions;
}

function mapPublicSourceSuggestion(
  interest: WeeklyPicksResponse["interests"][number],
  pick: WeeklyPicksResponse["interests"][number]["picks"][number],
): WeeklyPickSourceSuggestion {
  return {
    provider: pick.source.provider,
    providerSourceId: pick.source.providerSourceId,
    handle: pick.source.handle,
    displayName: pick.source.displayName,
    description: pick.source.description,
    thumbnailUrl: pick.source.thumbnailUrl,
    recommendationReason: pick.reason,
    ...(pick.fetchedAt !== undefined ? { fetchedAt: pick.fetchedAt } : {}),
    interestId: interest.interestId,
    publicationPeriod: {
      start: interest.publicationPeriod.start,
      end: interest.publicationPeriod.end,
    },
    ...(pick.featuredMedia ? {
      featuredMedia: {
        provider: pick.featuredMedia.provider,
        providerMediaId: pick.featuredMedia.providerMediaId,
        title: pick.featuredMedia.title,
        description: pick.featuredMedia.description,
        thumbnailUrl: pick.featuredMedia.thumbnailUrl,
        publishedAt: pick.featuredMedia.publishedAt,
        durationSeconds: pick.featuredMedia.durationSeconds,
        isLivestream: pick.featuredMedia.isLivestream,
        isUpcomingPremiere: pick.featuredMedia.isUpcomingPremiere,
      },
    } : {}),
  };
}

/** Converts a public cached suggestion into the existing explicit follow contract. */
export function weeklyPickToSourceResolution(suggestion: WeeklyPickSourceSuggestion): SourceResolution {
  return {
    ...(suggestion.fetchedAt !== undefined ? { fetchedAt: suggestion.fetchedAt } : {}),
    source: {
      provider: suggestion.provider,
      providerSourceId: suggestion.providerSourceId,
      handle: suggestion.handle,
      displayName: suggestion.displayName,
      description: suggestion.description,
      thumbnailUrl: suggestion.thumbnailUrl,
    },
    ...(suggestion.featuredMedia ? {
      video: {
        provider: suggestion.featuredMedia.provider,
        providerMediaId: suggestion.featuredMedia.providerMediaId,
        title: suggestion.featuredMedia.title,
        description: suggestion.featuredMedia.description,
        thumbnailUrl: suggestion.featuredMedia.thumbnailUrl,
        publishedAt: suggestion.featuredMedia.publishedAt,
        durationSeconds: suggestion.featuredMedia.durationSeconds,
        isLivestream: suggestion.featuredMedia.isLivestream,
        isUpcomingPremiere: suggestion.featuredMedia.isUpcomingPremiere,
        madeForKids: null,
      },
    } : {}),
    provenance: "cache",
  };
}

/** Shared UTC week key so an open app can request the next published edition. */
export function weeklyDiscoveryPeriodKey(now: number = Date.now()): string {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) return "invalid";
  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayFromMonday);
  return date.toISOString().slice(0, 10);
}

export const discoveryService: DiscoveryService = createDiscoveryService(weeklyPicksClient);
