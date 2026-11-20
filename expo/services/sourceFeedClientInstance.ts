import { byokYouTube } from "./byok";
import { PREVIEW_LIBRARY_ENABLED } from "../preview/mode";
import { makePreviewLibrary } from "../preview/library";
import type { SourceFeedClientResult } from "./sourceFeedClient";

export const sourceFeedClient = {
  async getCachedFeeds(sourceIds: readonly string[], refresh = false): Promise<SourceFeedClientResult> {
    if (!PREVIEW_LIBRARY_ENABLED) return byokYouTube.getCachedFeeds(sourceIds, refresh);
    const now = Date.now() - 60_000;
    const { videos } = makePreviewLibrary(now);
    return { status: "success", response: { state: "fresh", feeds: [], unavailableSourceIds: [], fetchedAt: new Date(now).toISOString() }, candidates: videos.filter((video) => sourceIds.includes(video.channelId)).map((video) => ({ ...video, fetchedAt: now, sourceId: video.channelId, sourceTitle: video.channelTitle, isLivestream: false, isUpcomingPremiere: false })) };
  },
};
