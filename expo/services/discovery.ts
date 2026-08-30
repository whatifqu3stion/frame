import type { DiscoveryResult, InterestId, TodayFeedResult } from "../types";

export type DiscoveryService = {
  getWeeklyPicks(profileId: string, interestIds: readonly InterestId[]): Promise<DiscoveryResult>;
  getTodayFeed(profileId: string): Promise<TodayFeedResult>;
};

const UNAVAILABLE_MESSAGE = "Shared discovery is not available until Frame's bounded recommendation service is ready.";

/** Prevents Weekly Picks work for profiles that have not chosen interests. */
export function shouldRequestWeeklyPicks(interestIds: readonly InterestId[]): boolean {
  return interestIds.length > 0;
}

/** Truthful Round 1 implementation. It never performs search or invents content. */
export const discoveryService: DiscoveryService = {
  async getWeeklyPicks(_profileId: string, interestIds: readonly InterestId[]): Promise<DiscoveryResult> {
    if (!shouldRequestWeeklyPicks(interestIds)) {
      return { status: "backend_allowance_unavailable", items: [], message: "Choose interests in Settings to receive occasional source suggestions." };
    }
    return { status: "backend_allowance_unavailable", items: [], message: UNAVAILABLE_MESSAGE };
  },
  async getTodayFeed(): Promise<TodayFeedResult> {
    return { status: "backend_allowance_unavailable", items: [], message: UNAVAILABLE_MESSAGE };
  },
};
