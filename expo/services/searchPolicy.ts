import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";
import type { ServiceResult, Video } from "../types";

export const SEARCH_UNAVAILABLE_MESSAGE = "Find a channel in Sources, then search inside it. General video search is not available in Frame.";

export function isLiveYouTubeSearchEnabled(): boolean {
  return FOUNDATION_CAPABILITIES.youtubeSearch;
}

export function unavailableSearchResult(): ServiceResult<Video[]> {
  return { status: "unavailable", message: SEARCH_UNAVAILABLE_MESSAGE };
}

