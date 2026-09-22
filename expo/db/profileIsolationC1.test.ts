import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { migrateDatabase, type MigrationExecutor } from "./migrations";
import { readProfileStorage, writeProfileStorage, profileStorageKey, type KeyValueStorage } from "../storage/profileStorage";

function adapter(db: Database): MigrationExecutor {
  return {
    execAsync: async (sql: string): Promise<void> => { db.exec(sql); },
    getFirstAsync: async <T,>(sql: string, params?: unknown): Promise<T | null> => (db.query(sql).get(...(Array.isArray(params) ? params : [])) as T | null) ?? null,
    getAllAsync: async <T,>(sql: string, params?: unknown): Promise<T[]> => db.query(sql).all(...(Array.isArray(params) ? params : [])) as T[],
  } as MigrationExecutor;
}

class MemoryStorage implements KeyValueStorage {
  readonly rows = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.rows.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.rows.set(key, value); }
  async removeItem(key: string): Promise<void> { this.rows.delete(key); }
}

describe("Stage C1 profile-owned local state", () => {
  test("same IDs remain independent for follows, Today actions/snoozes, Saved, progress, Sessions, rules and daily limits/usage", async () => {
    const db = new Database(":memory:");
    try {
      await migrateDatabase(adapter(db));
      for (const [index, profile] of ["owner-default", "standard", "managed"].entries()) {
        if (index) db.query("INSERT INTO profiles (id,name,role,createdAt,updatedAt,sortOrder) VALUES (?,?,?,?,?,?)").run(profile, profile, profile, 1, 1, index);
        db.query("INSERT INTO followed_channels (profileId,id,title,thumbnailUrl,followedAt,source) VALUES (?, 'source','Source','',1,'manual')").run(profile);
        db.query("INSERT INTO saved_videos (profileId,id,title,channelId,channelTitle,thumbnailUrl,publishedAt,durationSeconds,savedAt) VALUES (?, 'video','Video','source','Source','','',100,1)").run(profile);
        db.query("INSERT INTO resume_positions (profileId,videoId,timestampSeconds,updatedAt) VALUES (?, 'video',?,1)").run(profile, index + 10);
        db.query("INSERT INTO queues (profileId,id,name,orderedVideoIds,updatedAt,currentIndex) VALUES (?, 'session','Session','[\"video\"]',1,?)").run(profile, index);
        db.query("INSERT INTO session_drafts (profileId,name,orderedVideoIds,updatedAt) VALUES (?, ?,'[\"video\"]',1)").run(profile, `Draft ${index}`);
        db.query("INSERT INTO today_snapshots (profileId,periodKey,createdAt,freshness) VALUES (?, 'period',1,'fresh')").run(profile);
        db.query("INSERT INTO today_snapshot_items (profileId,periodKey,mediaId,sourceId,sourceTitle,title,thumbnailUrl,publishedAt,durationSeconds,isLivestream,isUpcomingPremiere,fetchedAt,position,disposition,snoozedUntil) VALUES (?, 'period','video','source','Source','Video','','',100,0,0,1,0,?,?)").run(profile, index === 0 ? "snoozed" : "dismissed", index === 0 ? 99 : null);
        db.query("INSERT INTO source_rules (profileId,sourceId,updatedAt) VALUES (?, 'source',?)").run(profile, index + 1);
        db.query("INSERT INTO profile_playback_limits (profileId,dailyLimitMinutes,updatedAt) VALUES (?,?,1)").run(profile, index + 20);
        db.query("INSERT INTO profile_playback_usage (profileId,dayKey,dayStartedAt,lastSeenAt,timezoneOffsetMinutes,consumedSeconds,warnedFive,warnedOne,updatedAt) VALUES (?, 'day',1,1,0,?,0,0,1)").run(profile, index + 30);
      }
      const checks: [string, string, readonly number[] | readonly string[]][] = [
        ["followed_channels", "title", ["Source", "Source", "Source"]],
        ["saved_videos", "title", ["Video", "Video", "Video"]],
        ["resume_positions", "timestampSeconds", [10, 11, 12]],
        ["queues", "currentIndex", [0, 1, 2]],
        ["session_drafts", "name", ["Draft 0", "Draft 1", "Draft 2"]],
        ["today_snapshots", "freshness", ["fresh", "fresh", "fresh"]],
        ["today_snapshot_items", "disposition", ["snoozed", "dismissed", "dismissed"]],
        ["source_rules", "updatedAt", [1, 2, 3]],
        ["profile_playback_limits", "dailyLimitMinutes", [20, 21, 22]],
        ["profile_playback_usage", "consumedSeconds", [30, 31, 32]],
      ];
      for (const [table, column, values] of checks) {
        for (const [index, profile] of ["owner-default", "standard", "managed"].entries()) {
          expect(db.query(`SELECT ${column} FROM ${table} WHERE profileId=?`).get(profile)).toEqual({ [column]: values[index] });
          expect(db.query(`SELECT count(*) AS count FROM ${table} WHERE profileId=?`).get(profile)).toEqual({ count: 1 });
        }
      }
      expect(db.query("SELECT snoozedUntil FROM today_snapshot_items WHERE profileId='owner-default'").get()).toEqual({ snoozedUntil: 99 });
      expect(db.query("SELECT snoozedUntil FROM today_snapshot_items WHERE profileId='standard'").get()).toEqual({ snoozedUntil: null });
      db.query("UPDATE today_snapshot_items SET disposition='watched' WHERE profileId='standard'").run();
      expect(db.query("SELECT disposition FROM today_snapshot_items WHERE profileId='owner-default'").get()).toEqual({ disposition: "snoozed" });
      db.query("DELETE FROM session_drafts WHERE profileId='managed'").run();
      expect(db.query("SELECT name FROM session_drafts WHERE profileId='owner-default'").get()).toEqual({ name: "Draft 0" });
      await migrateDatabase(adapter(db));
      expect(db.query("SELECT count(*) AS count FROM today_snapshot_items").get()).toEqual({ count: 3 });
    } finally { db.close(); }
  });

  test("legacy unscoped interests/appearance/searches migrate once to Owner without leaking to other roles", async () => {
    const storage = new MemoryStorage();
    const names = ["preferences", "interests", "recentSearches"] as const;
    const legacy = ["frame.preferences.v1", "frame.interests.v1", "frame.recentSearches.v1"];
    for (const [index, name] of names.entries()) {
      storage.rows.set(legacy[index], `owner-${index}`);
      expect(await readProfileStorage(storage, name, "standard")).toBeNull();
      expect(await readProfileStorage(storage, name, "managed")).toBeNull();
      expect(await readProfileStorage(storage, name, "owner-default")).toBe(`owner-${index}`);
      await writeProfileStorage(storage, name, "standard", `standard-${index}`);
      storage.rows.set(legacy[index], "later-legacy");
      expect(await readProfileStorage(storage, name, "owner-default")).toBe(`owner-${index}`);
      expect(await readProfileStorage(storage, name, "standard")).toBe(`standard-${index}`);
      expect(storage.rows.get(profileStorageKey(name, "managed"))).toBeUndefined();
    }
  });
});
