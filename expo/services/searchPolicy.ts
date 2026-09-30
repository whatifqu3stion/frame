import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";
import type { ServiceResult, Video } from "../types";

export const SEARCH_UNAVAILABLE_MESSAGE = "Live search is unavailable. Explore this week’s picks in Sources.";

export function isLiveYouTubeSearchEnabled(): boolean {
  return FOUNDATION_CAPABILITIES.youtubeSearch;
}

export function unavailableSearchResult(): ServiceResult<Video[]> {
  return { status: "unavailable", message: SEARCH_UNAVAILABLE_MESSAGE };
}

