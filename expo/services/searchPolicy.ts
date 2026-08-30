import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";
import type { ServiceResult, Video } from "../types";

export const SEARCH_UNAVAILABLE_MESSAGE = "Live YouTube search is unavailable while Frame prepares bounded shared discovery.";

export function isLiveYouTubeSearchEnabled(): boolean {
  return FOUNDATION_CAPABILITIES.youtubeSearch;
}

export function unavailableSearchResult(): ServiceResult<Video[]> {
  return { status: "unavailable", message: SEARCH_UNAVAILABLE_MESSAGE };
}
