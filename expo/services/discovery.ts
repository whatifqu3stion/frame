import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";
import type { DiscoveryResult, InterestId, TodayFeedResult, WeeklyPickSourceSuggestion } from "../types";
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
      message: "Weekly picks are not configured for this build.",
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

  const items = mapPublicSourceSuggestions(response);
  return {
    status: response.state === "cached" ? "cached_success" : "success",
    items,
    ...(response.message ? { message: response.message } : {}),
  };
}

function mapPublicSourceSuggestions(response: WeeklyPicksResponse): WeeklyPickSourceSuggestion[] {
  return response.interests.flatMap((interest) => interest.picks.map((pick) => ({
    provider: pick.source.provider,
    providerSourceId: pick.source.providerSourceId,
    handle: pick.source.handle,
    displayName: pick.source.displayName,
    description: pick.source.description,
    thumbnailUrl: pick.source.thumbnailUrl,
    recommendationReason: pick.reason,
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
  })));
}

export const discoveryService: DiscoveryService = createDiscoveryService(weeklyPicksClient);
