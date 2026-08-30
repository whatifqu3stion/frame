import type { DiscoveryResult, InterestId, TodayFeedResult } from "../types";

export type DiscoveryService = {
  getWeeklyPicks(profileId: string, interestIds: readonly InterestId[]): Promise<DiscoveryResult>;
  getTodayFeed(profileId: string): Promise<TodayFeedResult>;
};

const UNAVAILABLE_MESSAGE = "Shared discovery is not available until Frame's bounded recommendation service is ready.";

/** Truthful Round 1 implementation. It never performs search or invents content. */
export const discoveryService: DiscoveryService = {
  async getWeeklyPicks(): Promise<DiscoveryResult> {
    return { status: "backend_allowance_unavailable", items: [], message: UNAVAILABLE_MESSAGE };
  },
  async getTodayFeed(): Promise<TodayFeedResult> {
    return { status: "backend_allowance_unavailable", items: [], message: UNAVAILABLE_MESSAGE };
  },
};
