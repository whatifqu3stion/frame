import type { Video } from "@/types";

export type TodayDisposition = "pending" | "saved" | "session" | "watched" | "snoozed" | "dismissed" | "unavailable";
export type TodayFreshness = "fresh" | "stale" | "offline";

export type CachedTodayCandidate = Video & {
  sourceId: string;
  sourceTitle: string;
  isLivestream: boolean;
  isUpcomingPremiere: boolean;
  fetchedAt: number;
};

export type TodaySourceRule = {
  profileId: string;
  sourceId: string;
  minimumDurationSeconds: number;
  hideLivestreams: boolean;
  hideUpcomingPremieres: boolean;
  todayContributionLimit: number;
  mutedUntil: number | null;
  updatedAt: number;
};

export type TodaySnapshotItem = CachedTodayCandidate & {
  profileId: string;
  periodKey: string;
  position: number;
  disposition: TodayDisposition;
  dispositionAt: number | null;
  snoozedUntil: number | null;
};

export type TodaySnapshot = {
  profileId: string;
  periodKey: string;
  createdAt: number;
  cacheFetchedAt: number | null;
  freshness: TodayFreshness;
  items: TodaySnapshotItem[];
};

export type TodayPeriod = {
  key: string;
  startsAt: number;
  endsAt: number;
};

export type TodayLoadState = "ready" | "empty" | "no_sources" | "no_cache" | "network_error" | "unavailable";

export type TodayLoadResult = {
  state: TodayLoadState;
  snapshot: TodaySnapshot | null;
  message?: string;
};
