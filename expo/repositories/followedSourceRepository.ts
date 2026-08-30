import {
  followChannel,
  followChannels,
  initializeDatabase,
  listDistinctFollowedChannelIds,
  listFollowedChannels,
  unfollowChannel,
} from "@/db/database";
import type { FollowedChannel, ProviderId } from "@/types";

export type FollowedSourceIdentity = {
  provider: ProviderId;
  providerSourceId: string;
};

export type FollowedSourceRepository = {
  initialize(): Promise<void>;
  listForProfile(profileId: string): Promise<FollowedChannel[]>;
  listDistinctSources(): Promise<FollowedSourceIdentity[]>;
  follow(profileId: string, channel: FollowedChannel): Promise<void>;
  followMany(profileId: string, channels: FollowedChannel[]): Promise<void>;
  unfollow(profileId: string, providerSourceId: string): Promise<void>;
};

/** Profile-aware local follow storage with a device-wide, de-identified source union. */
export const followedSourceRepository: FollowedSourceRepository = {
  initialize: initializeDatabase,
  listForProfile: listFollowedChannels,
  async listDistinctSources(): Promise<FollowedSourceIdentity[]> {
    const providerSourceIds = await listDistinctFollowedChannelIds();
    return providerSourceIds.map((providerSourceId) => ({ provider: "youtube", providerSourceId }));
  },
  follow: followChannel,
  followMany: followChannels,
  unfollow: unfollowChannel,
};
