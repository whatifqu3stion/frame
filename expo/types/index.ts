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

export type FollowedChannel = Channel & {
  followedAt: number;
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
  youtubeApiKey: string | null;
  hasPurchased: boolean;
};
