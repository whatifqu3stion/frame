import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { migrateDatabase, type MigrationExecutor } from "./migrations";

function adapter(db: Database): MigrationExecutor {
  return {
    execAsync: async (sql: string): Promise<void> => { db.exec(sql); },
    getFirstAsync: async <T,>(sql: string, params?: unknown): Promise<T | null> => (db.query(sql).get(...(Array.isArray(params) ? params : [])) as T | null) ?? null,
    getAllAsync: async <T,>(sql: string, params?: unknown): Promise<T[]> => db.query(sql).all(...(Array.isArray(params) ? params : [])) as T[],
  } as MigrationExecutor;
}

describe("Managed content access schema", () => {
  test("keeps policy, approvals, and requests profile-scoped and cascade-deletable", async () => {
    const db = new Database(":memory:");
    try {
      await migrateDatabase(adapter(db));
      db.exec("PRAGMA foreign_keys=ON");
      for (const id of ["managed-a", "managed-b"]) db.query("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES (?,?,\'managed\',1,1,1)").run(id, id);
      for (const id of ["managed-a", "managed-b"]) {
        db.query("INSERT INTO managed_content_policies VALUES (?,\'selectedVideos\',1)").run(id);
        db.query("INSERT INTO managed_approved_videos (profileId,videoId,title,sourceId,sourceTitle,thumbnailUrl,publishedAt,durationSeconds,description,approvedAt) VALUES (?,\'abcdefghijk\',\'Video\',\'source\',\'Source\',\'\',\'\',60,\'\',1)").run(id);
        db.query("INSERT INTO managed_approved_sources (profileId,sourceId,title,description,thumbnailUrl,followedAt,source,approvedAt) VALUES (?,\'source\',\'Source\',\'\',\'\',1,\'manual\',1)").run(id);
        db.query("INSERT INTO managed_approval_requests (profileId,kind,targetId,sourceId,title,sourceTitle,thumbnailUrl,publishedAt,durationSeconds,description,requestedAt) VALUES (?,\'video\',\'zzzzzzzzzzz\',\'source\',\'Requested\',\'Source\',\'\',\'\',60,\'\',1)").run(id);
      }
      db.query("DELETE FROM profiles WHERE id=\'managed-a\'").run();
      for (const table of ["managed_content_policies", "managed_approved_videos", "managed_approved_sources", "managed_approval_requests"]) {
        expect(db.query(`SELECT count(*) AS count FROM ${table} WHERE profileId='managed-a'`).get()).toEqual({ count: 0 });
        expect(db.query(`SELECT count(*) AS count FROM ${table} WHERE profileId='managed-b'`).get()).toEqual({ count: 1 });
      }
    } finally { db.close(); }
  });

  test("rejects invalid modes and request kinds", async () => {
    const db = new Database(":memory:");
    try {
      await migrateDatabase(adapter(db));
      db.query("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES ('managed','Managed','managed',1,1,1)").run();
      expect(() => db.query("INSERT INTO managed_content_policies VALUES ('managed','open',1)").run()).toThrow();
      expect(() => db.query("INSERT INTO managed_approval_requests (profileId,kind,targetId,sourceId,title,sourceTitle,thumbnailUrl,publishedAt,durationSeconds,description,requestedAt) VALUES ('managed','unknown','x','','','','','',0,'',1)").run()).toThrow();
    } finally { db.close(); }
  });
});
