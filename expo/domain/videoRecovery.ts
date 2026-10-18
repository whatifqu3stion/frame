import type { Video } from "../types";
import { isMetadataCurrent } from "./metadataRetention";
import { isLongFormDuration } from "./videoLength";

export function validRecoveredVideo(id: string, video: Video | null, now: number): video is Video {
  return Boolean(video && isLongFormDuration(video.durationSeconds) && video.id === id && /^UC[A-Za-z0-9_-]{22}$/.test(video.channelId) && video.title.trim() && isMetadataCurrent(video.fetchedAt, now));
}
