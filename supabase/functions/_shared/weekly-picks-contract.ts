export type WeeklyPicksState = "fresh" | "cached" | "empty" | "unavailable" | "maintenance";

export interface WeeklyPickSource {
  provider: string;
  providerSourceId: string;
  handle: string | null;
  displayName: string;
  description: string;
  thumbnailUrl: string | null;
}

export interface WeeklyPickFeaturedMedia {
  provider: string;
  providerMediaId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isLivestream: boolean;
  isUpcomingPremiere: boolean;
}

export interface WeeklyPick {
  order: number;
  reason: string | null;
  source: WeeklyPickSource;
  featuredMedia?: WeeklyPickFeaturedMedia;
}

export interface WeeklyInterestPicks {
  interestId: string;
  publicationPeriod: {
    start: string;
    end: string;
  };
  picks: WeeklyPick[];
}

export interface WeeklyPicksResponse {
  state: WeeklyPicksState;
  interests: WeeklyInterestPicks[];
  message?: string;
}
