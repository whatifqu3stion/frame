/** A verified YouTube video shown in Frame. */
export type Video = {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number;
  description?: string;
};

export type Channel = {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
};

export type ChannelProvenance = "google" | "link" | "digest" | "manual";

export type FollowedChannel = Channel & {
  followedAt: number;
  source: ChannelProvenance;
};

export type ResumePosition = {
  videoId: string;
  timestampSeconds: number;
  updatedAt: number;
};

export type VideoQueue = {
  id: string;
  name: string;
  orderedVideoIds: string[];
  updatedAt: number;
};

export type InterestTopic = {
  id: string;
  name: string;
  emoji: string;
};

export type ThemeMode = "warm" | "ink";

export type UserPreferences = {
  theme: ThemeMode;
  hasCompletedOnboarding: boolean;
  googleEmail: string | null;
  googleConnectedAt: number | null;
};

export type ServiceFailureKind = "offline" | "unauthorized" | "quota" | "unavailable" | "failed";

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
