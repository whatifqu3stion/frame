import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  DATABASE_SCHEMA_VERSION,
  PROFILE_OWNED_TABLES,
  buildVersion1MigrationPlan,
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
      expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining(["profiles", ...PROFILE_OWNED_TABLES]));
      expect(database.query("SELECT role FROM profiles WHERE id = ?").get(DEFAULT_OWNER_PROFILE_ID)).toEqual({ role: "owner" });
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
      for (const table of PROFILE_OWNED_TABLES) {
        const row = database.query(`SELECT profileId FROM ${table} LIMIT 1`).get() as { profileId: string };
        expect(row.profileId).toBe(DEFAULT_OWNER_PROFILE_ID);
      }
      await migrateDatabase(adapter);
      expect(database.query("SELECT COUNT(*) AS count FROM saved_videos").get()).toEqual({ count: 1 });
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
    expect(plan.at(-1)).toBe(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION}`);
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

  test("does no work when initialization is repeated at version 1", async () => {
    const calls: string[] = [];
    const db = {
      execAsync: async (sql: string): Promise<void> => { calls.push(sql); },
      getFirstAsync: async <T,>(_sql: string): Promise<T | null> => ({ user_version: 1 } as T),
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

  test("allows two profiles to save the same video independently", async () => {
    const database = new Database(":memory:");
    try {
      await migrateDatabase(sqliteAdapter(database));
      database.query("INSERT INTO profiles VALUES (?, 'Standard', 'standard', 1, 1)").run("standard");
      const insert = database.query("INSERT INTO saved_videos VALUES (?, 'video-1', ?, 'channel', 'Channel', 'thumb', '2026-01-01', 60, NULL, 1)");
      insert.run(DEFAULT_OWNER_PROFILE_ID, "Owner copy");
      insert.run("standard", "Standard copy");
      expect(database.query("SELECT COUNT(*) AS count FROM saved_videos WHERE id = 'video-1'").get()).toEqual({ count: 2 });
      expect(profileEntityKey(DEFAULT_OWNER_PROFILE_ID, "video-1")).not.toBe(profileEntityKey("standard", "video-1"));
    } finally {
      database.close();
    }
  });

  test("allows two profiles to follow the same source independently", async () => {
    const database = new Database(":memory:");
    try {
      await migrateDatabase(sqliteAdapter(database));
      database.query("INSERT INTO profiles VALUES (?, 'Managed', 'managed', 1, 1)").run("managed");
      const insert = database.query("INSERT INTO followed_channels VALUES (?, 'channel-1', 'Channel', NULL, 'thumb', 1, 'manual')");
      insert.run(DEFAULT_OWNER_PROFILE_ID);
      insert.run("managed");
      expect(database.query("SELECT COUNT(*) AS count FROM followed_channels WHERE id = 'channel-1'").get()).toEqual({ count: 2 });
      expect(createProfileOwnedTableSql("followed_channels")).toContain("PRIMARY KEY (profileId, id)");
    } finally {
      database.close();
    }
  });
});
