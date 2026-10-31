/** A verified YouTube video shown in Frame. */
export type ProviderId = "youtube";
export type InterestId = string;

export type SourceRef = {
  providerId: ProviderId;
  sourceId: string;
};

export type MediaItemRef = {
  providerId: ProviderId;
  mediaId: string;
  source?: SourceRef;
};

export type FeedContractStatus =
  | "success"
  | "cached_success"
  | "temporarily_unavailable"
  | "network_error"
  | "backend_allowance_unavailable";

export type WeeklyPickPublicationPeriod = {
  start: string;
  end: string;
};

export type WeeklyPickFeaturedMediaPreview = {
  provider: ProviderId;
  providerMediaId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isLivestream: boolean;
  isUpcomingPremiere: boolean;
};

/** Public source recommendation data exposed by the Weekly Picks boundary. */
export type WeeklyPickSourceSuggestion = {
  fetchedAt?: number;
  provider: ProviderId;
  providerSourceId: string;
  handle: string | null;
  displayName: string;
  description: string;
  thumbnailUrl: string | null;
  recommendationReason: string | null;
  interestId: InterestId;
  publicationPeriod: WeeklyPickPublicationPeriod;
  featuredMedia?: WeeklyPickFeaturedMediaPreview;
};

export type DiscoveryResultReason = "no_interests" | "empty" | "maintenance" | "offline" | "configuration" | "backend";

export type DiscoveryResult = {
  status: FeedContractStatus;
  items: WeeklyPickSourceSuggestion[];
  reason?: DiscoveryResultReason;
  message?: string;
  cachedAt?: number;
};

export type TodayFeedResult = {
  status: FeedContractStatus;
  items: MediaItemRef[];
  message?: string;
  cachedAt?: number;
};

/** Provider fetch time, never the time a user saved, followed or resumed an item. */
export type MetadataProvenance = { fetchedAt?: number | null };

export type Video = MetadataProvenance & {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number;
  description?: string;
  madeForKids?: boolean | null;
};

export type Channel = MetadataProvenance & {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
};

export type ResolvedSource = {
  provider: "youtube";
  providerSourceId: string;
  handle: string | null;
  displayName: string;
  description: string;
  thumbnailUrl: string | null;
};

export type ResolvedVideo = {
  provider: "youtube";
  providerMediaId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isLivestream: boolean;
  isUpcomingPremiere: boolean;
  madeForKids: boolean | null;
};

export type SourceResolution = MetadataProvenance & {
  source: ResolvedSource;
  video?: ResolvedVideo;
  provenance: "cache" | "provider";
};

export type ChannelProvenance = "google" | "link" | "digest" | "manual";

export type FollowedChannel = Channel & {
  followedAt: number;
  source: ChannelProvenance;
};

/** One deliberately requested page of the signed-in user's subscriptions. */
export type GoogleSubscriptionPage = {
  items: FollowedChannel[];
  nextPageToken: string | null;
  totalResults: number | null;
};

export type GoogleImportResult = AddChannelResult & {
  importedCount: number;
};

export type ResumePosition = {
  sessionId?: string | null;
  videoId: string;
  timestampSeconds: number;
  updatedAt: number;
};

export type VideoQueue = {
  targetMinutes?: number | null;
  id: string;
  name: string;
  orderedVideoIds: string[];
  updatedAt: number;
  /** Next video to offer; length means the session has ended. */
  currentIndex: number;
};

/** One unfinished, profile-local Session composition. */
export type SessionDraft = {
  targetMinutes?: number | null;
  name: string;
  orderedVideoIds: string[];
  updatedAt: number;
};

export type InterestTopic = {
  id: InterestId;
  name: string;
  emoji: string;
};

export type ThemeMode = "warm" | "ink";
export type AccentMode = "blue" | "green" | "rose";

export type UserPreferences = {
  todayVideoCount: number;
  theme: ThemeMode;
  accent: AccentMode;
  hasCompletedOnboarding: boolean;
  googleEmail: string | null;
  googleConnectedAt: number | null;
};

export type ServiceFailureKind =
  | "offline"
  | "unauthorized"
  | "quota"
  | "unavailable"
  | "failed"
  | "invalid_request"
  | "not_found"
  | "allowance_exhausted"
  | "quota_exhausted"
  | "temporarily_unavailable"
  | "network_error";

/** A truthful result from a network-backed service. */
export type ServiceResult<T> =
  | { status: "success"; data: T }
  | { status: "empty"; data: T; message?: string }
  | { status: "partial"; data: T; message: string }
  | { status: ServiceFailureKind; message: string };

/** Result of a user-facing account or creator action. */
export type AddChannelResult = {
  ok: boolean;
  message: string;
};

