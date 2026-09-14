import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { EXPIRE_TODAY_METADATA_SQL, METADATA_MAX_AGE_MS, expireTodayItem, isMetadataCurrent } from "./metadataRetention";
import { CREATE_TODAY_SNAPSHOT_ITEMS_TABLE_SQL } from "../db/migrations";
import { visibleTodayItems } from "./today";
import type { TodaySnapshotItem } from "../models/today";

const now = Date.parse("2026-09-14T12:00:00Z");
function item(fetchedAt: number): TodaySnapshotItem {
  return { id: "abcdefghijk", profileId: "owner-default", periodKey: "2026-09-14", sourceId: "source-a", channelId: "source-a", sourceTitle: "Source", channelTitle: "Source", title: "Original", thumbnailUrl: "https://example.com/image.jpg", description: "Original description", publishedAt: "2026-09-01", durationSeconds: 100, madeForKids: false, isLivestream: false, isUpcomingPremiere: false, fetchedAt, position: 2, disposition: "snoozed", dispositionAt: now - 1_000, snoozedUntil: now + 1_000 };
}

describe("local Today metadata retention", () => {
  test("expires precisely at thirty days and rejects unknown or future dates", () => {
    expect(isMetadataCurrent(now - METADATA_MAX_AGE_MS + 1, now)).toBeTrue();
    for (const date of [now - METADATA_MAX_AGE_MS, 0, null, undefined, NaN, Infinity, now + 1]) expect(isMetadataCurrent(date, now)).toBeFalse();
  });
  test("scrubs only metadata while preserving profile, order and every action", () => {
    const original = item(now - METADATA_MAX_AGE_MS);
    const expired = expireTodayItem(original, now);
    expect(expired).toMatchObject({ id: original.id, profileId: original.profileId, sourceId: original.sourceId, position: 2, disposition: "snoozed", dispositionAt: original.dispositionAt, snoozedUntil: original.snoozedUntil, title: "Video details expired", thumbnailUrl: "", description: "", madeForKids: null, fetchedAt: 0 });
    expect(original.title).toBe("Original");
    expect(expireTodayItem(expired, now)).toEqual(expired);
    expect(expireTodayItem(item(now), now).title).toBe("Original");
  });
  test("expired pending items are hidden without turning them into watched or dismissed", () => {
    const expired = { ...item(now - METADATA_MAX_AGE_MS), disposition: "pending" as const };
    expect(visibleTodayItems([expired], new Set(["source-a"]), new Map(), now)).toEqual([]);
    expect(expired.disposition).toBe("pending");
  });
  test("real SQLite cleanup preserves both profiles and is idempotent", () => {
    const db = new Database(":memory:");
    try {
      db.exec(CREATE_TODAY_SNAPSHOT_ITEMS_TABLE_SQL);
      const insert = db.query(`INSERT INTO today_snapshot_items(profileId,periodKey,mediaId,sourceId,sourceTitle,title,thumbnailUrl,publishedAt,durationSeconds,description,madeForKids,isLivestream,isUpcomingPremiere,fetchedAt,position,disposition,dispositionAt,snoozedUntil) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const profile of ["owner", "managed"]) {
        insert.run(profile,"2026-09-14","same-video","source-a","Source","Old","thumb","date",100,"description",1,0,0,now-METADATA_MAX_AGE_MS,0,"snoozed",10,now+1_000);
        insert.run(profile,"2026-09-14","fresh-video","source-a","Source","Fresh","thumb","date",100,"description",1,0,0,now,1,"saved",12,null);
      }
      const cleanup = db.query(EXPIRE_TODAY_METADATA_SQL);
      cleanup.run(now-METADATA_MAX_AGE_MS,now);
      expect(db.query("SELECT changes() AS n").get()).toEqual({ n: 2 });
      cleanup.run(now-METADATA_MAX_AGE_MS,now);
      expect(db.query("SELECT changes() AS n").get()).toEqual({ n: 0 });
      expect(db.query("SELECT count(*) AS n FROM today_snapshot_items").get()).toEqual({n:4});
      for (const profile of ["owner", "managed"]) {
        expect(db.query("SELECT title,description,position,disposition,dispositionAt,snoozedUntil FROM today_snapshot_items WHERE profileId=? AND mediaId='same-video'").get(profile)).toEqual({title:"Video details expired",description:"",position:0,disposition:"snoozed",dispositionAt:10,snoozedUntil:now+1_000});
        expect(db.query("SELECT title FROM today_snapshot_items WHERE profileId=? AND mediaId='fresh-video'").get(profile)).toEqual({title:"Fresh"});
      }
    } finally { db.close(); }
  });
});
