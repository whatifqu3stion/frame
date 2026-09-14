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

/** This statement never removes a user's action history or changes a snapshot position. */
export const EXPIRE_TODAY_METADATA_SQL = `UPDATE today_snapshot_items
SET title='Video details expired', sourceTitle='YouTube source', thumbnailUrl='', publishedAt='',
    durationSeconds=0, description='', madeForKids=NULL, isLivestream=0, isUpcomingPremiere=0, fetchedAt=0
WHERE (fetchedAt <= ? OR fetchedAt > ?)
  AND (fetchedAt != 0 OR title != 'Video details expired' OR thumbnailUrl != '' OR COALESCE(description,'') != '')`;
