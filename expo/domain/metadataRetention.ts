import type { Channel, MetadataProvenance, Video } from "../types";
import type { TodaySnapshotItem } from "../models/today";

/** Maximum offline lifetime of provider-supplied metadata, measured from provider fetch. */
export const METADATA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

/** Unknown, invalid and future timestamps never grant a fresh retention window. */
export function isMetadataCurrent(fetchedAt: number | null | undefined, now: number): boolean {
  return typeof fetchedAt === "number" && Number.isFinite(fetchedAt) && fetchedAt > 0
    && fetchedAt <= now && now - fetchedAt < METADATA_MAX_AGE_MS;
}

/** Scrubs provider details without changing membership, actions, snoozes or identities. */
export function expireTodayItem(item: TodaySnapshotItem, now: number): TodaySnapshotItem {
  if (isMetadataCurrent(item.fetchedAt, now)) return item;
  return { ...item, title: "Video details expired", sourceTitle: "YouTube source", channelTitle: "YouTube source",
    thumbnailUrl: "", publishedAt: "", durationSeconds: 0, description: "", madeForKids: null,
    isLivestream: false, isUpcomingPremiere: false, fetchedAt: 0 };
}

/** Keeps bookmark identity and user fields; an unknown fetch time is not treated as fresh. */
export function expireVideo<T extends Video>(video: T, now: number): T {
  if (isMetadataCurrent(video.fetchedAt, now)) return video;
  return { ...video, title: "Video details expired", channelTitle: "YouTube source", thumbnailUrl: "",
    publishedAt: "", durationSeconds: 0, description: "", madeForKids: null, fetchedAt: null };
}

export function expireChannel<T extends Channel>(channel: T, now: number): T {
  if (isMetadataCurrent(channel.fetchedAt, now)) return channel;
  return { ...channel, title: "Source details expired", description: "", thumbnailUrl: "", fetchedAt: null };
}

export function expireResume<T extends MetadataProvenance & { title?: string; channelTitle?: string; thumbnailUrl?: string; durationSeconds?: number }>(row: T, now: number): T {
  if (isMetadataCurrent(row.fetchedAt, now)) return row;
  return { ...row, title: "Video details expired", channelTitle: "YouTube source", thumbnailUrl: "", durationSeconds: 0, fetchedAt: null };
}

/** Parameterized expiry statements do not modify any personal-action column. */
export const EXPIRE_LIBRARY_METADATA_SQL: readonly string[] = [
  ...["saved_videos", "watch_later"].map((table) => `UPDATE ${table}
    SET title='Video details expired', channelTitle='YouTube source', thumbnailUrl='', publishedAt='', durationSeconds=0, description='', fetchedAt=NULL
    WHERE (fetchedAt IS NULL OR fetchedAt <= ? OR fetchedAt > ?)
      AND (fetchedAt IS NOT NULL OR title != 'Video details expired' OR channelTitle != 'YouTube source' OR thumbnailUrl != '' OR publishedAt != '' OR durationSeconds != 0 OR COALESCE(description,'') != '')`),
  `UPDATE resume_positions SET title='Video details expired', channelTitle='YouTube source', thumbnailUrl='', durationSeconds=0, fetchedAt=NULL
    WHERE (fetchedAt IS NULL OR fetchedAt <= ? OR fetchedAt > ?)
      AND (fetchedAt IS NOT NULL OR COALESCE(title,'') != 'Video details expired' OR COALESCE(channelTitle,'') != 'YouTube source' OR COALESCE(thumbnailUrl,'') != '' OR COALESCE(durationSeconds,0) != 0)`,
  `UPDATE followed_channels SET title='Source details expired', description='', thumbnailUrl='', fetchedAt=NULL
    WHERE (fetchedAt IS NULL OR fetchedAt <= ? OR fetchedAt > ?)
      AND (fetchedAt IS NOT NULL OR title != 'Source details expired' OR thumbnailUrl != '' OR COALESCE(description,'') != '')`,
];

/** This statement never removes a user's action history or changes a snapshot position. */
export const EXPIRE_TODAY_METADATA_SQL = `UPDATE today_snapshot_items
SET title='Video details expired', sourceTitle='YouTube source', thumbnailUrl='', publishedAt='',
    durationSeconds=0, description='', madeForKids=NULL, isLivestream=0, isUpcomingPremiere=0, fetchedAt=0
WHERE (fetchedAt <= ? OR fetchedAt > ?)
  AND (fetchedAt != 0 OR title != 'Video details expired' OR thumbnailUrl != '' OR COALESCE(description,'') != '')`;
