import type { Channel, Video } from "../types";
import type { SourceFeedClientResult } from "./sourceFeedClient";

export type CachedChannelShelf = { channel: Channel; videos: Video[]; message: string };
type CachedFeedReader = { getCachedFeeds(ids: readonly string[]): Promise<SourceFeedClientResult> };

/** Source browsing reuses the bounded shared cache; a miss never triggers provider work. */
export function createCachedContentService(client: CachedFeedReader) {
  return {
    async getChannelShelf(channelId: string): Promise<CachedChannelShelf> {
      if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw new Error("Open a verified source from Sources.");
      const result = await client.getCachedFeeds([channelId]);
      if (result.status !== "success") {
        throw new Error(result.status === "network_error"
          ? "Frame is offline. Previously loaded uploads remain available."
          : "The shared source cache is temporarily unavailable. Try again later.");
      }
      const feed = result.response.feeds.find((entry) => entry.source.providerSourceId === channelId);
      if (!feed || result.response.state === "unavailable") throw new Error("This source is waiting for shared cache availability. No live lookup was made.");
      return {
        channel: { id: channelId, title: feed.source.displayName, thumbnailUrl: feed.source.thumbnailUrl ?? "" },
        videos: result.candidates.filter((video) => video.sourceId === channelId && !video.isLivestream && !video.isUpcomingPremiere),
        message: feed.freshness === "stale"
          ? "Showing cached uploads while Frame waits for a shared refresh."
          : feed.items.length === 0 ? "No uploads are cached yet. Frame refreshes sources centrally; you do not need to keep retrying." : "Recent cached uploads. This list has an end.",
      };
    },
  };
}
