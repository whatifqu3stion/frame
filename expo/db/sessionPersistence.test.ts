import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { DATABASE_SCHEMA_VERSION, buildVersion1MigrationPlan, buildVersion2MigrationPlan, buildVersion3MigrationPlan, buildVersion4MigrationPlan, buildVersion5MigrationPlan, buildVersion6MigrationPlan, buildVersion7MigrationPlan, buildVersion8MigrationPlan, buildVersion9MigrationPlan, executeMigrationTransaction, migrateDatabase, type MigrationExecutor } from "./migrations";

function adapter(db: Database): MigrationExecutor {
  return {
    execAsync: async (sql: string): Promise<void> => { db.exec(sql); },
    getFirstAsync: async <T,>(sql: string, params?: unknown): Promise<T | null> => (db.query(sql).get(...(Array.isArray(params) ? params : [])) as T | null) ?? null,
    getAllAsync: async <T,>(sql: string, params?: unknown): Promise<T[]> => db.query(sql).all(...(Array.isArray(params) ? params : [])) as T[],
  } as MigrationExecutor;
}

function version6(db: Database): void {
  for (const plan of [buildVersion1MigrationPlan({}), buildVersion2MigrationPlan(), buildVersion3MigrationPlan(), buildVersion4MigrationPlan(), buildVersion5MigrationPlan(), buildVersion6MigrationPlan()]) for (const sql of plan) db.exec(sql);
  db.exec("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES ('standard','Standard','standard',1,1,1)");
  for (const profile of ["owner-default", "standard"]) db.query("INSERT INTO queues (profileId,id,name,orderedVideoIds,updatedAt) VALUES (?, 'same','Evening','[\"video000001\",\"video000002\"]',77)").run(profile);
}

describe("version 7 Session persistence", () => {
  test("upgrades version 6 without losing order or profile ownership, then survives restart", async () => {
    const db = new Database(":memory:");
    try {
      version6(db);
      await migrateDatabase(adapter(db));
      expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: DATABASE_SCHEMA_VERSION });
      for (const profile of ["owner-default", "standard"]) {
        expect(db.query("SELECT name,orderedVideoIds,updatedAt,currentIndex FROM queues WHERE profileId=?").get(profile)).toEqual({ name: "Evening", orderedVideoIds: '["video000001","video000002"]', updatedAt: 77, currentIndex: 0 });
      }
      db.query("INSERT INTO session_drafts (profileId,name,orderedVideoIds,updatedAt) VALUES ('owner-default','Weekend','[\"video000003\"]',88)").run();
      db.query("UPDATE queues SET currentIndex=2 WHERE profileId='owner-default' AND id='same'").run();
      await migrateDatabase(adapter(db));
      expect(db.query("SELECT currentIndex FROM queues WHERE profileId='owner-default'").get()).toEqual({ currentIndex: 2 });
      expect(db.query("SELECT currentIndex FROM queues WHERE profileId='standard'").get()).toEqual({ currentIndex: 0 });
      expect(db.query("SELECT name,orderedVideoIds FROM session_drafts WHERE profileId='owner-default'").get()).toEqual({ name: "Weekend", orderedVideoIds: '["video000003"]' });
      expect(db.query("SELECT count(*) AS count FROM session_drafts WHERE profileId='standard'").get()).toEqual({ count: 0 });
      db.exec("PRAGMA foreign_keys=ON; DELETE FROM profiles WHERE id='standard'");
      expect(db.query("SELECT count(*) AS count FROM queues WHERE profileId='standard'").get()).toEqual({ count: 0 });
      expect(db.query("SELECT name FROM session_drafts WHERE profileId='owner-default'").get()).toEqual({ name: "Weekend" });
    } finally { db.close(); }
  });
  test("migration rolls back cleanly and can be retried", async () => {
    const db = new Database(":memory:");
    try {
      version6(db);
      await expect(executeMigrationTransaction(adapter(db), [...buildVersion7MigrationPlan().slice(0, -1), "INVALID SQL"])).rejects.toThrow();
      expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 6 });
      expect((db.query("PRAGMA table_info(queues)").all() as { name: string }[]).some((column) => column.name === "currentIndex")).toBeFalse();
      await migrateDatabase(adapter(db));
      expect(db.query("SELECT count(*) AS count FROM queues").get()).toEqual({ count: 2 });
    } finally { db.close(); }
  });
});

test("version 9 upgrade preserves legacy resumes and persists explicit session provenance", async () => {
  const db = new Database(":memory:");
  try {
    version6(db);
    for (const plan of [buildVersion7MigrationPlan(), buildVersion8MigrationPlan(), buildVersion9MigrationPlan()]) for (const sql of plan) db.exec(sql);
    db.exec("INSERT INTO resume_positions(profileId,videoId,timestampSeconds,updatedAt) VALUES ('owner-default','video000001',42,77),('standard','video000001',18,66)");
    await migrateDatabase(adapter(db));
    expect(db.query("SELECT timestampSeconds,updatedAt,sessionId FROM resume_positions WHERE profileId='owner-default'").get()).toEqual({ timestampSeconds: 42, updatedAt: 77, sessionId: null });
    db.exec("UPDATE resume_positions SET sessionId='same' WHERE profileId='owner-default'");
    await migrateDatabase(adapter(db));
    expect(db.query("SELECT sessionId FROM resume_positions WHERE profileId='owner-default'").get()).toEqual({ sessionId: "same" });
    expect(db.query("SELECT timestampSeconds,sessionId FROM resume_positions WHERE profileId='standard'").get()).toEqual({ timestampSeconds: 18, sessionId: null });
  } finally { db.close(); }
});
