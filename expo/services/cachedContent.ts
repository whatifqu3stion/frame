import { isLongFormVideo } from "../domain/contentPolicy";
import type { Channel, Video } from "../types";
import type { SourceFeedClientResult } from "./sourceFeedClient";

export type CachedChannelShelf = { channel: Channel; videos: Video[]; message: string };
type CachedFeedReader = { getCachedFeeds(ids: readonly string[]): Promise<SourceFeedClientResult> };

/** Source browsing consumes the bounded feed adapter, which caches direct BYOK metadata. */
export function createCachedContentService(client: CachedFeedReader) {
  return {
    async getChannelShelf(channelId: string): Promise<CachedChannelShelf> {
      if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw new Error("Open a verified source from Sources.");
      const result = await client.getCachedFeeds([channelId]);
      if (result.status !== "success") {
        throw new Error(result.status === "network_error"
          ? "Frame is offline. Previously loaded uploads remain available."
          : "Video data is unavailable. Check your YouTube key and quota in Settings → YouTube & Gemini.");
      }
      const feed = result.response.feeds.find((entry) => entry.source.providerSourceId === channelId);
      if (!feed || result.response.state === "unavailable") throw new Error("This source is unavailable. Check your YouTube key or try again later.");
      return {
        channel: { id: channelId, title: feed.source.displayName, thumbnailUrl: feed.source.thumbnailUrl ?? "", fetchedAt: feed.source.fetchedAt ? Date.parse(feed.source.fetchedAt) : null },
        videos: result.candidates.filter((video) => video.sourceId === channelId && isLongFormVideo(video) && !video.isLivestream && !video.isUpcomingPremiere),
        message: feed.freshness === "stale"
          ? "Showing previously loaded uploads."
          : feed.items.length === 0 ? "No public uploads were found for this source." : "Recent cached uploads. This list has an end.",
      };
    },
  };
}
