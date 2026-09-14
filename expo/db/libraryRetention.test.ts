import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { buildVersion1MigrationPlan, buildVersion2MigrationPlan, buildVersion3MigrationPlan, buildVersion4MigrationPlan, buildVersion5MigrationPlan, executeMigrationTransaction } from "./migrations";
import { EXPIRE_LIBRARY_METADATA_SQL, METADATA_MAX_AGE_MS, expireVideo, expireChannel, expireResume } from "../domain/metadataRetention";

const now = Date.parse("2026-09-14T12:00:00Z");
function version4(db: Database): void {
  for (const plan of [buildVersion1MigrationPlan({}), buildVersion2MigrationPlan(), buildVersion3MigrationPlan(), buildVersion4MigrationPlan()]) for (const sql of plan) db.exec(sql);
  db.exec("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES ('kid','Kid','managed',1,1,1)");
  for (const profile of ["owner-default", "kid"]) {
    for (const table of ["saved_videos", "watch_later"]) db.query(`INSERT INTO ${table} VALUES (?, 'same-video','Original','source','Source','thumb','date',100,'description',123)`).run(profile);
    db.query("INSERT INTO resume_positions VALUES (?, 'same-video',42,456,'Original','Source','thumb',100)").run(profile);
    db.query("INSERT INTO followed_channels VALUES (?, 'source','Source','description','thumb',789,'manual')").run(profile);
    db.query("INSERT INTO queues VALUES (?, 'session','My plan','[\"same-video\"]',999)").run(profile);
  }
}

describe("version 5 library retention", () => {
  test("adds unknown provenance, expires provider data and retains every personal record", () => {
    const db = new Database(":memory:");
    try {
      version4(db);
      for (const sql of buildVersion5MigrationPlan()) db.exec(sql);
      expect(db.query("PRAGMA user_version").get()).toEqual({user_version:5});
      expect(db.query("SELECT fetchedAt,title FROM saved_videos LIMIT 1").get()).toEqual({fetchedAt:null,title:"Original"});
      // A valid refresh for one profile must not lend freshness to the other.
      db.query("UPDATE saved_videos SET fetchedAt=? WHERE profileId='kid'").run(now);
      for (const sql of EXPIRE_LIBRARY_METADATA_SQL) db.query(sql).run(now-METADATA_MAX_AGE_MS,now);
      expect(db.query("SELECT title FROM saved_videos WHERE profileId='kid'").get()).toEqual({title:"Original"});
      expect(db.query("SELECT title,thumbnailUrl,description,savedAt FROM saved_videos WHERE profileId='owner-default'").get()).toEqual({title:"Video details expired",thumbnailUrl:"",description:"",savedAt:123});
      for (const profile of ["owner-default","kid"]) {
        expect(db.query("SELECT timestampSeconds,updatedAt FROM resume_positions WHERE profileId=?").get(profile)).toEqual({timestampSeconds:42,updatedAt:456});
        expect(db.query("SELECT id,followedAt,source,title FROM followed_channels WHERE profileId=?").get(profile)).toEqual({id:"source",followedAt:789,source:"manual",title:"Source details expired"});
        expect(db.query("SELECT name,orderedVideoIds,updatedAt FROM queues WHERE profileId=?").get(profile)).toEqual({name:"My plan",orderedVideoIds:'["same-video"]',updatedAt:999});
      }
      for (const table of ["saved_videos","watch_later","resume_positions","followed_channels","queues"]) expect(db.query(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({n:2});
    } finally { db.close(); }
  });
  test("rolls back a failed additive migration completely", async () => {
    const db = new Database(":memory:");
    try {
      version4(db);
      await expect(executeMigrationTransaction({ execAsync: async (sql) => { db.exec(sql); } }, [...buildVersion5MigrationPlan().slice(0,2), "INVALID SQL"])).rejects.toThrow();
      expect(db.query("PRAGMA user_version").get()).toEqual({user_version:4});
      const columns = db.query("PRAGMA table_info(saved_videos)").all() as {name:string}[];
      expect(columns.some((column) => column.name === "fetchedAt")).toBeFalse();
      expect(db.query("SELECT title FROM saved_videos LIMIT 1").get()).toEqual({title:"Original"});
    } finally { db.close(); }
  });
  test("copying metadata to Saved or progress cannot renew its fetch date", () => {
    const video = {id:"same",channelId:"source",title:"Title",channelTitle:"Source",thumbnailUrl:"thumb",publishedAt:"date",durationSeconds:100,fetchedAt:now-METADATA_MAX_AGE_MS+1};
    expect(expireVideo(video,now).fetchedAt).toBe(video.fetchedAt);
    expect(expireVideo({...video,savedAt:now+1},now+1)).toMatchObject({id:"same",savedAt:now+1,title:"Video details expired",fetchedAt:null});
    expect(expireResume({videoId:"same",timestampSeconds:42,updatedAt:now,title:"Title",fetchedAt:now+1},now)).toMatchObject({timestampSeconds:42,updatedAt:now,title:"Video details expired"});
    expect(expireChannel({id:"source",title:"Title",thumbnailUrl:"thumb",followedAt:now},now)).toMatchObject({id:"source",followedAt:now,title:"Source details expired"});
  });
});
