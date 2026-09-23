import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  CREATE_MANAGED_ALLOWANCES_TABLE_SQL,
  CREATE_PROFILE_PLAYBACK_LIMITS_TABLE_SQL,
  CREATE_PROFILE_PLAYBACK_USAGE_TABLE_SQL,
  CREATE_PROFILE_PLAYBACK_CONTROLS_TABLE_SQL,
  CREATE_PROFILE_SESSION_USAGE_TABLE_SQL,
  CREATE_SOURCE_RULES_TABLE_SQL,
  CREATE_TODAY_SNAPSHOTS_TABLE_SQL,
  CREATE_TODAY_SNAPSHOT_ITEMS_TABLE_SQL,
  DATABASE_SCHEMA_VERSION,
  PROFILE_OWNED_TABLES,
  buildVersion1MigrationPlan,
  buildVersion2MigrationPlan,
  buildVersion3MigrationPlan,
  buildVersion4MigrationPlan,
  buildVersion8MigrationPlan,
  createProfileOwnedTableSql,
  executeMigrationTransaction,
  migrateDatabase,
  profileEntityKey,
  type MigrationExecutor,
  type SchemaMetadata,
} from "./migrations";
import { DEFAULT_OWNER_PROFILE_ID } from "../models/profile";

function sqliteAdapter(database: Database): MigrationExecutor {
  return {
    execAsync: async (sql: string): Promise<void> => { database.exec(sql); },
    getFirstAsync: async <T,>(sql: string, params?: unknown): Promise<T | null> => {
      const values = Array.isArray(params) ? params : params === undefined ? [] : [params];
      return (database.query(sql).get(...values) as T | null) ?? null;
    },
    getAllAsync: async <T,>(sql: string, params?: unknown): Promise<T[]> => {
      const values = Array.isArray(params) ? params : params === undefined ? [] : [params];
      return database.query(sql).all(...values) as T[];
    },
  } as MigrationExecutor;
}

function createRepresentativeLegacyDatabase(database: Database): void {
  database.exec(`
    CREATE TABLE saved_videos (id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,channelId TEXT NOT NULL,channelTitle TEXT NOT NULL,thumbnailUrl TEXT NOT NULL,publishedAt TEXT NOT NULL,durationSeconds INTEGER NOT NULL,description TEXT,savedAt INTEGER NOT NULL);
    CREATE TABLE resume_positions (videoId TEXT PRIMARY KEY NOT NULL,timestampSeconds INTEGER NOT NULL,updatedAt INTEGER NOT NULL,title TEXT,channelTitle TEXT,thumbnailUrl TEXT,durationSeconds INTEGER);
    CREATE TABLE queues (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,orderedVideoIds TEXT NOT NULL,updatedAt INTEGER NOT NULL);
    CREATE TABLE watch_later (id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,channelId TEXT NOT NULL,channelTitle TEXT NOT NULL,thumbnailUrl TEXT NOT NULL,publishedAt TEXT NOT NULL,durationSeconds INTEGER NOT NULL,description TEXT,addedAt INTEGER NOT NULL);
    CREATE TABLE followed_channels (id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,description TEXT,thumbnailUrl TEXT NOT NULL,followedAt INTEGER NOT NULL);
    INSERT INTO saved_videos VALUES ('video-a','Saved','channel-a','Channel A','thumb','2026-01-01',60,NULL,10);
    INSERT INTO resume_positions VALUES ('video-a',20,11,'Saved','Channel A','thumb',60);
    INSERT INTO queues VALUES ('queue-a','Evening','["video-a"]',12);
    INSERT INTO watch_later VALUES ('video-b','Later','channel-b','Channel B','thumb','2026-01-02',120,NULL,13);
    INSERT INTO followed_channels VALUES ('channel-a','Channel A',NULL,'thumb',14);
  `);
}

const LEGACY_COLUMNS: SchemaMetadata = {
  saved_videos: ["id", "title", "channelId", "channelTitle", "thumbnailUrl", "publishedAt", "durationSeconds", "description", "savedAt"],
  resume_positions: ["videoId", "timestampSeconds", "updatedAt", "title", "channelTitle", "thumbnailUrl", "durationSeconds"],
  queues: ["id", "name", "orderedVideoIds", "updatedAt"],
  watch_later: ["id", "title", "channelId", "channelTitle", "thumbnailUrl", "publishedAt", "durationSeconds", "description", "addedAt"],
  followed_channels: ["id", "title", "description", "thumbnailUrl", "followedAt"],
};

describe("database version 1 migration", () => {
  test("executes fresh schema creation against SQLite", async () => {
    const database = new Database(":memory:");
    try {
      await migrateDatabase(sqliteAdapter(database));
      const version = database.query("PRAGMA user_version").get() as { user_version: number };
      const tables = database.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
      expect(version.user_version).toBe(DATABASE_SCHEMA_VERSION);
      expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining(["profiles", "managed_allowances", "profile_playback_limits", "profile_playback_usage", "profile_playback_controls", "profile_session_usage", "today_snapshots", "today_snapshot_items", "source_rules", ...PROFILE_OWNED_TABLES]));
      expect(database.query("SELECT role, sortOrder FROM profiles WHERE id = ?").get(DEFAULT_OWNER_PROFILE_ID)).toEqual({ role: "owner", sortOrder: 0 });
    } finally {
      database.close();
    }
  });

  test("executes representative legacy migration without losing records", async () => {
    const database = new Database(":memory:");
    try {
      createRepresentativeLegacyDatabase(database);
      const adapter = sqliteAdapter(database);
      await migrateDatabase(adapter);
      for (const table of PROFILE_OWNED_TABLES.filter((table) => table !== "watch_later")) {
        const row = database.query(`SELECT profileId FROM ${table} LIMIT 1`).get() as { profileId: string };
        expect(row.profileId).toBe(DEFAULT_OWNER_PROFILE_ID);
      }
      expect(database.query("SELECT COUNT(*) AS count FROM watch_later").get()).toEqual({ count: 0 });
      expect(database.query("SELECT savedAt, legacyWatchLaterAddedAt, fetchedAt FROM saved_videos WHERE id = 'video-b'").get()).toEqual({ savedAt: 13, legacyWatchLaterAddedAt: 13, fetchedAt: null });
      await migrateDatabase(adapter);
      expect(database.query("SELECT COUNT(*) AS count FROM saved_videos").get()).toEqual({ count: 2 });
      expect(database.query("SELECT COUNT(*) AS count FROM followed_channels").get()).toEqual({ count: 1 });
    } finally {
      database.close();
    }
  });

  test("creates every profile-aware table for a fresh schema", () => {
    const plan = buildVersion1MigrationPlan({});
    expect(plan[0]).toContain("CREATE TABLE IF NOT EXISTS profiles");
    for (const table of PROFILE_OWNED_TABLES) {
      expect(plan).toContain(createProfileOwnedTableSql(table));
      expect(createProfileOwnedTableSql(table)).toContain("profileId TEXT NOT NULL");
    }
    expect(plan.at(-1)).toBe("PRAGMA user_version = 1");
    expect(buildVersion2MigrationPlan()).toContain(CREATE_MANAGED_ALLOWANCES_TABLE_SQL);
    expect(buildVersion3MigrationPlan()).toEqual(expect.arrayContaining([CREATE_PROFILE_PLAYBACK_LIMITS_TABLE_SQL, CREATE_PROFILE_PLAYBACK_USAGE_TABLE_SQL]));
    expect(buildVersion4MigrationPlan()).toEqual(expect.arrayContaining([CREATE_TODAY_SNAPSHOTS_TABLE_SQL, CREATE_TODAY_SNAPSHOT_ITEMS_TABLE_SQL, CREATE_SOURCE_RULES_TABLE_SQL]));
    expect(buildVersion8MigrationPlan()).toEqual(expect.arrayContaining([CREATE_PROFILE_PLAYBACK_CONTROLS_TABLE_SQL, CREATE_PROFILE_SESSION_USAGE_TABLE_SQL]));
  });

  test("assigns representative legacy records to the stable Owner", () => {
    const plan = buildVersion1MigrationPlan(LEGACY_COLUMNS);
    for (const table of PROFILE_OWNED_TABLES) {
      const copy = plan.find((statement) => statement.startsWith(`INSERT INTO ${table}_profile_v1`));
      expect(copy).toContain(`SELECT '${DEFAULT_OWNER_PROFILE_ID}'`);
      expect(copy).toContain(`FROM ${table}`);
    }
    const followedCopy = plan.find((statement) => statement.startsWith("INSERT INTO followed_channels_profile_v1"));
    expect(followedCopy).toContain("'manual'");
  });

  test("does no work when initialization is repeated at the latest version", async () => {
    const calls: string[] = [];
    const db = {
      execAsync: async (sql: string): Promise<void> => { calls.push(sql); },
      getFirstAsync: async <T,>(_sql: string): Promise<T | null> => ({ user_version: DATABASE_SCHEMA_VERSION } as T),
      getAllAsync: async <T,>(): Promise<T[]> => [],
    };
    await migrateDatabase(db);
    expect(calls).toEqual([]);
  });

  test("rolls back a failed migration before setting the version", async () => {
    const calls: string[] = [];
    const originalRows = ["saved-video-1"];
    let visibleRows = [...originalRows];
    const executor = {
      execAsync: async (sql: string): Promise<void> => {
        calls.push(sql);
        if (sql === "DROP TABLE saved_videos") visibleRows = [];
        if (sql === "FAIL") throw new Error("injected migration failure");
        if (sql === "ROLLBACK") visibleRows = [...originalRows];
      },
    };
    await expect(executeMigrationTransaction(executor, ["DROP TABLE saved_videos", "FAIL", "PRAGMA user_version = 1"])).rejects.toThrow("injected migration failure");
    expect(calls.at(-1)).toBe("ROLLBACK");
    expect(calls).not.toContain("PRAGMA user_version = 1");
    expect(visibleRows).toEqual(originalRows);
  });

  test("migrates version 1 profiles additively without changing profile-owned content", async () => {
    const database = new Database(":memory:");
    try {
      const adapter = sqliteAdapter(database);
      await executeMigrationTransaction(adapter, buildVersion1MigrationPlan({}));
      database.query("INSERT INTO profiles (id,name,role,createdAt,updatedAt) VALUES ('standard-old','Standard','standard',1,1)").run();
      database.query("INSERT INTO saved_videos VALUES ('standard-old','video-old','Saved','channel','Channel','thumb','2026-01-01',60,NULL,1)").run();
      await migrateDatabase(adapter);
      expect(database.query("PRAGMA user_version").get()).toEqual({ user_version: DATABASE_SCHEMA_VERSION });
      expect(database.query("SELECT name, role, sortOrder FROM profiles WHERE id = 'standard-old'").get()).toEqual({ name: "Standard", role: "standard", sortOrder: 1 });
      expect(database.query("SELECT title FROM saved_videos WHERE profileId = 'standard-old'").get()).toEqual({ title: "Saved" });
      expect(database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'managed_allowances'").get()).toEqual({ name: "managed_allowances" });
    } finally {
      database.close();
    }
  });

  test("migrates existing Managed allowance and usage into profile-wide storage", async () => {
    const database = new Database(":memory:");
    try {
      const adapter = sqliteAdapter(database);
      await executeMigrationTransaction(adapter, buildVersion1MigrationPlan({}));
      await executeMigrationTransaction(adapter, buildVersion2MigrationPlan());
      database.query("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES ('managed-existing','Kid','managed',1,1,1)").run();
      database.query("INSERT INTO managed_allowances VALUES ('managed-existing','dailyLimit',30,'2026-09-04',1,2,0,321,0,1,0,3)").run();
      await migrateDatabase(adapter);
      expect(database.query("SELECT dailyLimitMinutes,pendingActivatesAt FROM profile_playback_limits WHERE profileId='managed-existing'").get()).toEqual({ dailyLimitMinutes: 30, pendingActivatesAt: null });
      expect(database.query("SELECT consumedSeconds,warnedFive,warnedOne FROM profile_playback_usage WHERE profileId='managed-existing'").get()).toEqual({ consumedSeconds: 321, warnedFive: 1, warnedOne: 0 });
      await migrateDatabase(adapter);
      expect(database.query("SELECT COUNT(*) AS count FROM profile_playback_limits WHERE profileId='managed-existing'").get()).toEqual({ count: 1 });
    } finally { database.close(); }
  });

  test("supports Managed create, rename, reorder, and cascade delete without touching Owner", async () => {
    const database = new Database(":memory:");
    try {
      await migrateDatabase(sqliteAdapter(database));
      database.exec("PRAGMA foreign_keys = ON");
      database.query("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES ('managed-local','Kid','managed',2,1,1)").run();
      const day = "2026-09-03";
      database.query("INSERT INTO managed_allowances VALUES ('managed-local','dailyLimit',30,?,1,1,0,0,0,0,0,1)").run(day);
      database.query("UPDATE profiles SET name = 'Kid Renamed', sortOrder = 1 WHERE id = 'managed-local'").run();
      expect(database.query("SELECT name, role, sortOrder FROM profiles WHERE id = 'managed-local'").get()).toEqual({ name: "Kid Renamed", role: "managed", sortOrder: 1 });
      database.query("DELETE FROM profiles WHERE id = 'managed-local'").run();
      expect(database.query("SELECT COUNT(*) AS count FROM managed_allowances WHERE profileId = 'managed-local'").get()).toEqual({ count: 0 });
      expect(database.query("SELECT COUNT(*) AS count FROM profiles WHERE id = ?").get(DEFAULT_OWNER_PROFILE_ID)).toEqual({ count: 1 });
    } finally {
      database.close();
    }
  });

  test("allows two profiles to save the same video independently", async () => {
    const database = new Database(":memory:");
    try {
      await migrateDatabase(sqliteAdapter(database));
      database.query("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES (?, 'Standard', 'standard', 1, 1, 1)").run("standard");
      const insert = database.query("INSERT INTO saved_videos (profileId,id,title,channelId,channelTitle,thumbnailUrl,publishedAt,durationSeconds,description,savedAt) VALUES (?, 'video-1', ?, 'channel', 'Channel', 'thumb', '2026-01-01', 60, NULL, 1)");
      insert.run(DEFAULT_OWNER_PROFILE_ID, "Owner copy");
      insert.run("standard", "Standard copy");
      expect(database.query("SELECT COUNT(*) AS count FROM saved_videos WHERE id = 'video-1'").get()).toEqual({ count: 2 });
      expect(profileEntityKey(DEFAULT_OWNER_PROFILE_ID, "video-1")).not.toBe(profileEntityKey("standard", "video-1"));
    } finally {
      database.close();
    }
  });

  test("stores finite Today snapshots with profile isolation and transactional cascade", async () => {
    const database = new Database(":memory:");
    try {
      await migrateDatabase(sqliteAdapter(database));
      database.exec("PRAGMA foreign_keys = ON");
      database.query("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES ('standard','Standard','standard',1,1,1)").run();
      const insertSnapshot = database.query("INSERT INTO today_snapshots VALUES (?, '2026-09-06', 1, 1, 'fresh')");
      insertSnapshot.run(DEFAULT_OWNER_PROFILE_ID);
      insertSnapshot.run("standard");
      const insertItem = database.query("INSERT INTO today_snapshot_items VALUES (?, '2026-09-06','video000001','source','Source','Title','https://example.com/thumb.jpg','2026-09-06',60,NULL,NULL,0,0,1,0,'pending',NULL,NULL)");
      insertItem.run(DEFAULT_OWNER_PROFILE_ID);
      insertItem.run("standard");
      expect(database.query("SELECT COUNT(*) AS count FROM today_snapshot_items WHERE mediaId='video000001'").get()).toEqual({ count: 2 });
      database.query("UPDATE today_snapshot_items SET disposition='dismissed',dispositionAt=2 WHERE profileId=? AND periodKey='2026-09-06' AND mediaId='video000001'").run(DEFAULT_OWNER_PROFILE_ID);
      const firstUndo = database.query("UPDATE today_snapshot_items SET disposition='pending',dispositionAt=3 WHERE profileId=? AND periodKey='2026-09-06' AND mediaId='video000001' AND disposition='dismissed'").run(DEFAULT_OWNER_PROFILE_ID) as { changes: number };
      const secondUndo = database.query("UPDATE today_snapshot_items SET disposition='pending' WHERE profileId=? AND periodKey='2026-09-06' AND mediaId='video000001' AND disposition='dismissed'").run(DEFAULT_OWNER_PROFILE_ID) as { changes: number };
      expect(firstUndo.changes).toBe(1);
      expect(secondUndo.changes).toBe(0);
      database.query("DELETE FROM profiles WHERE id='standard'").run();
      expect(database.query("SELECT COUNT(*) AS count FROM today_snapshots WHERE profileId='standard'").get()).toEqual({ count: 0 });
      expect(database.query("SELECT COUNT(*) AS count FROM today_snapshots WHERE profileId=?").get(DEFAULT_OWNER_PROFILE_ID)).toEqual({ count: 1 });
    } finally { database.close(); }
  });

  test("allows two profiles to follow the same source independently", async () => {
    const database = new Database(":memory:");
    try {
      await migrateDatabase(sqliteAdapter(database));
      database.query("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES (?, 'Managed', 'managed', 1, 1, 1)").run("managed");
      const insert = database.query("INSERT INTO followed_channels (profileId,id,title,description,thumbnailUrl,followedAt,source) VALUES (?, 'channel-1', 'Channel', NULL, 'thumb', 1, 'manual')");
      insert.run(DEFAULT_OWNER_PROFILE_ID);
      insert.run("managed");
      expect(database.query("SELECT COUNT(*) AS count FROM followed_channels WHERE id = 'channel-1'").get()).toEqual({ count: 2 });
      expect(createProfileOwnedTableSql("followed_channels")).toContain("PRIMARY KEY (profileId, id)");
    } finally {
      database.close();
    }
  });
});
