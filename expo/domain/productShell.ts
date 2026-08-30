import type { FeedContractStatus } from "@/types";

export type TodayShellState =
  | "loading"
  | "offline"
  | "service_error"
  | "no_sources"
  | "no_qualifying_videos"
  | "caught_up"
  | "ready";

export type TodayStateInput = {
  followedSourceCount: number;
  isLoading: boolean;
  isError: boolean;
  status?: FeedContractStatus;
  itemCount: number;
};

/** Maps the future Today contract to finite, truthful interface states. */
export function resolveTodayShellState(input: TodayStateInput): TodayShellState {
  if (input.isLoading) return "loading";
  if (input.status === "network_error") return "offline";
  if (input.isError || input.status === "temporarily_unavailable") return "service_error";
  if (input.followedSourceCount === 0) return "no_sources";
  if (input.status === "success" && input.itemCount === 0) return "caught_up";
  if (input.itemCount > 0) return "ready";
  return "no_qualifying_videos";
}

/** Stable profile-aware query keys used by the product shell. */
export function shellProfileQueryKeys(profileId: string): {
  today: readonly ["today", string];
  saved: readonly ["library", string, "saved"];
  continueWatching: readonly ["library", string, "resume"];
  interests: readonly ["profile", string, "interests"];
} {
  return {
    today: ["today", profileId] as const,
    saved: ["library", profileId, "saved"] as const,
    continueWatching: ["library", profileId, "resume"] as const,
    interests: ["profile", profileId, "interests"] as const,
  };
}
