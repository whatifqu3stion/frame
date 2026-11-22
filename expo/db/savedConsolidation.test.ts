import { Database } from "bun:sqlite";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, test } from "bun:test";
import { buildVersion1MigrationPlan, buildVersion2MigrationPlan, buildVersion3MigrationPlan, buildVersion4MigrationPlan, buildVersion5MigrationPlan, buildVersion6MigrationPlan, executeMigrationTransaction, migrateDatabase, type MigrationExecutor } from "./migrations";
import { SAVE_VIDEO_SQL, UNSAVE_VIDEO_SQL } from "./savedLibrarySql";
import { EXPIRE_LIBRARY_METADATA_SQL, METADATA_MAX_AGE_MS } from "../domain/metadataRetention";

const now = Date.parse("2026-09-14T12:00:00Z");
const owner = "owner-default";
function seedVersion5(db: Database): void {
  for (const plan of [buildVersion1MigrationPlan({}), buildVersion2MigrationPlan(), buildVersion3MigrationPlan(), buildVersion4MigrationPlan(), buildVersion5MigrationPlan()]) {
    for (const sql of plan) db.exec(sql);
  }
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES ('standard','Standard','standard',1,1,1)");
  for (const profile of [owner, "standard"]) {
    db.query(SAVE_VIDEO_SQL).run(profile, "duplicate", `Saved ${profile}`, "source", "Source", "thumb", "date", 100, "notes", 10, now - 1000);
    db.query("INSERT INTO watch_later VALUES (?, 'duplicate','Later duplicate','source','Source','later-thumb','date',200,'later notes',20,?)").run(profile, now);
    db.query("INSERT INTO watch_later VALUES (?, 'later-only','Later only','source','Source','thumb','date',100,NULL,30,?)").run(profile, profile === owner ? null : now);
    db.query("INSERT INTO resume_positions VALUES (?, 'duplicate',42,50,'Progress','Source','thumb',100,?)").run(profile, now);
    db.query("INSERT INTO queues VALUES (?, 'session','Evening','[\"later-only\",\"duplicate\"]',60)").run(profile);
    db.query("INSERT INTO followed_channels VALUES (?, 'source','Source','notes','thumb',70,'manual',?)").run(profile, now);
    db.query("INSERT INTO today_snapshots VALUES (?, '2026-09-14',80,?, 'fresh')").run(profile, now);
    db.query("INSERT INTO today_snapshot_items VALUES (?, '2026-09-14','duplicate','source','Source','Title','thumb','date',100,NULL,NULL,0,0,?,0,'snoozed',90,100)").run(profile, now);
  }
}
function executor(db: Database): Pick<MigrationExecutor, "execAsync"> {
  return { execAsync: async (sql: string): Promise<void> => { db.exec(sql); } };
}
async function migrate(db: Database): Promise<void> {
  await executeMigrationTransaction(executor(db), buildVersion6MigrationPlan(now));
}
function personalState(db: Database): unknown[] {
  return ["resume_positions", "queues", "followed_channels", "today_snapshots", "today_snapshot_items"].map((table) => db.query(`SELECT * FROM ${table} ORDER BY profileId`).all());
}

describe("one canonical Saved library", () => {
  test("merges duplicates and later-only links per profile, retaining original dates and provenance", async () => {
    const db = new Database(":memory:");
    try {
      seedVersion5(db);
      const personal = personalState(db);
      await migrate(db);
      expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 6 });
      expect(db.query("SELECT count(*) AS n FROM saved_videos").get()).toEqual({ n: 4 });
      expect(db.query("SELECT count(*) AS n FROM watch_later").get()).toEqual({ n: 0 });
      for (const profile of [owner, "standard"]) {
        expect(db.query("SELECT title,savedAt,legacyWatchLaterAddedAt,fetchedAt FROM saved_videos WHERE profileId=? AND id='duplicate'").get(profile)).toEqual({ title: "Later duplicate", savedAt: 10, legacyWatchLaterAddedAt: 20, fetchedAt: now });
        expect(db.query("SELECT title,savedAt,legacyWatchLaterAddedAt,fetchedAt FROM saved_videos WHERE profileId=? AND id='later-only'").get(profile)).toEqual({ title: "Later only", savedAt: 30, legacyWatchLaterAddedAt: 30, fetchedAt: profile === owner ? null : now });
      }
      expect(personalState(db)).toEqual(personal);
      const before = db.query("SELECT * FROM saved_videos ORDER BY profileId,id").all();
      const adapter = {
        ...executor(db),
        getFirstAsync: async <T,>(sql: string, params?: unknown): Promise<T | null> => db.query(sql).get(...(Array.isArray(params) ? params : [])) as T | null,
        getAllAsync: async <T,>(sql: string, params?: unknown): Promise<T[]> => db.query(sql).all(...(Array.isArray(params) ? params : [])) as T[],
      } as MigrationExecutor;
      await migrateDatabase(adapter);
      expect(db.query("SELECT * FROM saved_videos ORDER BY profileId,id").all()).toEqual(before);
    } finally { db.close(); }
  });

  test("chooses valid metadata as one bundle, never future dates or an older duplicate", async () => {
    for (const [savedFetch, laterFetch, expectedTitle, expectedFetch] of [
      [null, now, "Later duplicate", now],
      [now - METADATA_MAX_AGE_MS, now, "Later duplicate", now],
      [now + 1, now, "Later duplicate", now],
      [now, now + 1, `Saved ${owner}`, now],
      [now, null, `Saved ${owner}`, now],
      [now, now - 1, `Saved ${owner}`, now],
      [now, now, `Saved ${owner}`, now],
    ] as const) {
      const db = new Database(":memory:");
      try {
        seedVersion5(db);
        db.query("UPDATE saved_videos SET fetchedAt=? WHERE profileId=? AND id='duplicate'").run(savedFetch, owner);
        db.query("UPDATE watch_later SET fetchedAt=? WHERE profileId=? AND id='duplicate'").run(laterFetch, owner);
        await migrate(db);
        expect(db.query("SELECT title,fetchedAt,thumbnailUrl,durationSeconds,description,savedAt,legacyWatchLaterAddedAt FROM saved_videos WHERE profileId=? AND id='duplicate'").get(owner)).toEqual({
          title: expectedTitle, fetchedAt: expectedFetch,
          thumbnailUrl: expectedTitle === "Later duplicate" ? "later-thumb" : "thumb",
          durationSeconds: expectedTitle === "Later duplicate" ? 200 : 100,
          description: expectedTitle === "Later duplicate" ? "later notes" : "notes",
          savedAt: 10, legacyWatchLaterAddedAt: 20,
        });
      } finally { db.close(); }
    }
  });

  test("a failure after the merge and legacy cleanup rolls back all rows and the schema", async () => {
    const db = new Database(":memory:");
    try {
      seedVersion5(db);
      const saved = db.query("SELECT * FROM saved_videos ORDER BY profileId,id").all();
      const later = db.query("SELECT * FROM watch_later ORDER BY profileId,id").all();
      await expect(executeMigrationTransaction(executor(db), [...buildVersion6MigrationPlan(now).slice(0, -1), "INVALID SQL"])).rejects.toThrow();
      expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 5 });
      expect(db.query("SELECT * FROM saved_videos ORDER BY profileId,id").all()).toEqual(saved);
      expect(db.query("SELECT * FROM watch_later ORDER BY profileId,id").all()).toEqual(later);
      expect((db.query("PRAGMA table_info(saved_videos)").all() as { name: string }[]).some((column) => column.name === "legacyWatchLaterAddedAt")).toBeFalse();
      await migrate(db);
      expect(db.query("SELECT count(*) AS n FROM saved_videos").get()).toEqual({ n: 4 });
    } finally { db.close(); }
  });

  test("expired and unknown legacy metadata stays expired without losing bookmark dates", async () => {
    const db = new Database(":memory:");
    try {
      seedVersion5(db);
      db.query("UPDATE saved_videos SET fetchedAt=? WHERE profileId=?").run(now - METADATA_MAX_AGE_MS, owner);
      db.query("UPDATE watch_later SET fetchedAt=? WHERE profileId=? AND id='duplicate'").run(now - METADATA_MAX_AGE_MS, owner);
      await migrate(db);
      for (const sql of EXPIRE_LIBRARY_METADATA_SQL) db.query(sql).run(now - METADATA_MAX_AGE_MS, now);
      expect(db.query("SELECT title,thumbnailUrl,fetchedAt,savedAt,legacyWatchLaterAddedAt FROM saved_videos WHERE profileId=? AND id='duplicate'").get(owner)).toEqual({ title: "Video details expired", thumbnailUrl: "", fetchedAt: null, savedAt: 10, legacyWatchLaterAddedAt: 20 });
      expect(db.query("SELECT title,fetchedAt,savedAt FROM saved_videos WHERE profileId=? AND id='later-only'").get(owner)).toEqual({ title: "Video details expired", fetchedAt: null, savedAt: 30 });
      expect(db.query("SELECT title FROM saved_videos WHERE profileId='standard' AND id='later-only'").get()).toEqual({ title: "Later only" });
    } finally { db.close(); }
  });

  test("repeated saves are idempotent and unsaving cannot resurrect a legacy duplicate or change another profile", async () => {
    const db = new Database(":memory:");
    try {
      seedVersion5(db);
      await migrate(db);
      const personal = personalState(db);
      const before = db.query("SELECT * FROM saved_videos WHERE profileId=? AND id='duplicate'").get(owner);
      db.query(SAVE_VIDEO_SQL).run(owner, "duplicate", "Replacement", "source", "Source", "new", "date", 200, null, now, now);
      expect(db.query("SELECT * FROM saved_videos WHERE profileId=? AND id='duplicate'").get(owner)).toEqual(before);
      db.query(UNSAVE_VIDEO_SQL).run(owner, "duplicate");
      db.query(UNSAVE_VIDEO_SQL).run(owner, "duplicate");
      expect(db.query("SELECT id FROM saved_videos WHERE profileId=? AND id='duplicate'").get(owner)).toBeNull();
      expect(db.query("SELECT id FROM saved_videos WHERE profileId='standard' AND id='duplicate'").get()).toEqual({ id: "duplicate" });
      expect(db.query("SELECT count(*) AS n FROM watch_later").get()).toEqual({ n: 0 });
      expect(personalState(db)).toEqual(personal);
      db.query(SAVE_VIDEO_SQL).run(owner, "duplicate", "Saved again", "source", "Source", "thumb", "date", 100, null, now, now);
      expect(db.query("SELECT savedAt,legacyWatchLaterAddedAt FROM saved_videos WHERE profileId=? AND id='duplicate'").get(owner)).toEqual({ savedAt: now, legacyWatchLaterAddedAt: null });
    } finally { db.close(); }
  });

  test("Saved, playback, Sessions and Today use the same collection with no Later write path", async () => {
    const paths = ["app/(tabs)/saved.tsx", "app/watch/[id].tsx", "app/session.tsx", "app/session/[id].tsx", "providers/AppProvider.tsx"];
    for (const path of paths) {
      const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
      expect(source).not.toContain("watchLaterQuery");
      expect(source).not.toContain("toggleWatchLater");
      expect(source).not.toContain("...watchLater");
      expect(source).not.toContain("addToWatchLater");
    }
    const db = await readFile(new URL("./database.ts", import.meta.url), "utf8");
    expect(db).not.toContain("export async function addWatchLater");
    expect(db).not.toContain("webStore.watchLater");
    expect(db).toContain("SAVE_VIDEO_SQL,");
    expect(db).toContain("db.runAsync(UNSAVE_VIDEO_SQL, [profileId, videoId])");
    expect(db).toContain("if (!webStore.saved.has(key))");
    const today = await readFile(new URL("../repositories/todayRepository.ts", import.meta.url), "utf8");
    expect(today).toContain("listSavedVideos(profileId)");
  });
});
