import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { DATABASE_SCHEMA_VERSION, buildVersion1MigrationPlan, buildVersion2MigrationPlan, buildVersion3MigrationPlan, buildVersion4MigrationPlan, buildVersion5MigrationPlan, buildVersion6MigrationPlan, buildVersion7MigrationPlan, buildVersion8MigrationPlan, buildVersion9MigrationPlan, buildVersion10MigrationPlan, buildVersion11MigrationPlan, executeMigrationTransaction, migrateDatabase, type MigrationExecutor } from "./migrations";

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


test("version 11 preserves legacy sessions, drafts and muted sources; new choices survive reopening", async () => {
  const db = new Database(":memory:");
  try {
    version6(db);
    for (const plan of [buildVersion7MigrationPlan(), buildVersion8MigrationPlan(), buildVersion9MigrationPlan(), buildVersion10MigrationPlan()]) for (const sql of plan) db.exec(sql);
    db.exec("INSERT INTO session_drafts (profileId,name,orderedVideoIds,updatedAt) VALUES ('owner-default','Draft','[]',123)");
    db.exec("INSERT INTO source_rules (profileId,sourceId,minimumDurationSeconds,hideLivestreams,hideUpcomingPremieres,todayContributionLimit,mutedUntil,updatedAt) VALUES ('owner-default','source',240,1,1,2,9007199254740991,123)");
    await migrateDatabase(adapter(db));
    expect(db.query("SELECT targetMinutes FROM queues WHERE profileId='owner-default'").get()).toEqual({ targetMinutes: null });
    expect(db.query("SELECT targetMinutes FROM session_drafts").get()).toEqual({ targetMinutes: null });
    expect(db.query("SELECT favorite,mutedUntil FROM source_rules").get()).toEqual({ favorite: 0, mutedUntil: 9007199254740991 });
    db.exec("UPDATE queues SET targetMinutes=30 WHERE profileId='owner-default'; UPDATE session_drafts SET targetMinutes=60; UPDATE source_rules SET favorite=1");
    expect(() => db.exec("UPDATE queues SET targetMinutes=-1")).toThrow();
    expect(() => db.exec("UPDATE source_rules SET favorite=2")).toThrow();
    const reopened = Database.deserialize(db.serialize());
    try {
      await migrateDatabase(adapter(reopened));
      expect(reopened.query("SELECT targetMinutes,currentIndex,orderedVideoIds FROM queues WHERE profileId='owner-default'").get()).toEqual({ targetMinutes: 30, currentIndex: 0, orderedVideoIds: '["video000001","video000002"]' });
      expect(reopened.query("SELECT targetMinutes FROM queues WHERE profileId='standard'").get()).toEqual({ targetMinutes: null });
      expect(reopened.query("SELECT targetMinutes FROM session_drafts").get()).toEqual({ targetMinutes: 60 });
      expect(reopened.query("SELECT favorite,mutedUntil FROM source_rules").get()).toEqual({ favorite: 1, mutedUntil: 9007199254740991 });
    } finally { reopened.close(); }
  } finally { db.close(); }
});

test("version 11 migration rolls back all additive columns on failure", async () => {
  const db = new Database(":memory:");
  try {
    version6(db);
    for (const plan of [buildVersion7MigrationPlan(), buildVersion8MigrationPlan(), buildVersion9MigrationPlan(), buildVersion10MigrationPlan()]) for (const sql of plan) db.exec(sql);
    await expect(executeMigrationTransaction(adapter(db), [...buildVersion11MigrationPlan().slice(0, -1), "INVALID SQL"])).rejects.toThrow();
    expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 10 });
    expect((db.query("PRAGMA table_info(queues)").all() as { name: string }[]).some((column) => column.name === "targetMinutes")).toBeFalse();
    await migrateDatabase(adapter(db));
    expect(db.query("SELECT count(*) AS count FROM queues").get()).toEqual({ count: 2 });
  } finally { db.close(); }
});

test("version 12 preserves targets and commitments, persists timer runs and rejects stale checkpoints", async () => {
  const { READ_SESSION_RUN_SQL, SAVE_SESSION_RUN_SQL, RESET_SESSION_RUN_SQL } = await import("./sessionRunSql");
  const { buildVersion12MigrationPlan } = await import("./migrations");
  const db = new Database(":memory:");
  try {
    version6(db);
    for (const plan of [buildVersion7MigrationPlan(), buildVersion8MigrationPlan(), buildVersion9MigrationPlan(), buildVersion10MigrationPlan(), buildVersion11MigrationPlan()]) for (const sql of plan) db.exec(sql);
    db.exec("UPDATE queues SET targetMinutes=30; INSERT INTO profile_playback_limits(profileId,dailyLimitMinutes,pendingDailyLimitMinutes,pendingActivatesAt,updatedAt) VALUES ('owner-default',30,60,999,1)");
    await expect(executeMigrationTransaction(adapter(db), [...buildVersion12MigrationPlan().slice(0, -1), "INVALID SQL"])).rejects.toThrow();
    expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 11 });
    expect(db.query("SELECT targetMinutes FROM queues LIMIT 1").get()).toEqual({ targetMinutes: 30 });
    await migrateDatabase(adapter(db));
    expect(db.query("SELECT commitment,pendingActivatesAt,dailyLimitMinutes FROM profile_playback_limits").get()).toEqual({ commitment: 1, pendingActivatesAt: 999, dailyLimitMinutes: 30 });
    db.exec("UPDATE queues SET targetMinutes=37 WHERE profileId='owner-default'");
    for (const invalid of [-1, 0, 1441, 2.5]) expect(() => db.exec(`UPDATE queues SET targetMinutes=${invalid}`)).toThrow();
    db.query(RESET_SESSION_RUN_SQL).run("owner-default", "same");
    const save = (runId: number, seconds: number, ended = 0, finish: string | null = null) => db.query(SAVE_SESSION_RUN_SQL).run("owner-default", "same", runId, seconds, ended, finish, "video000001", "owner-default", "same");
    save(1, 60.25); save(1, 20); // Older checkpoint cannot refund time.
    save(1, 60.25, 0, "video000001"); save(1, 60.25); // Late checkpoint cannot revoke the granted finish.
    const expected = { runId: 1, consumedSeconds: 60.25, ended: 0, finishVideoId: "video000001", lastVideoId: "video000001" };
    expect(db.query(READ_SESSION_RUN_SQL).get("owner-default", "same")).toEqual(expected);
    expect(db.query(READ_SESSION_RUN_SQL).get("standard", "same")).toBeNull();
    const reopened = Database.deserialize(db.serialize());
    try {
      await migrateDatabase(adapter(reopened));
      expect(reopened.query(READ_SESSION_RUN_SQL).get("owner-default", "same")).toEqual(expected);
      expect(reopened.query("SELECT targetMinutes FROM queues WHERE profileId='owner-default'").get()).toEqual({ targetMinutes: 37 });
    } finally { reopened.close(); }
    save(1, 80, 1); save(1, 81, 0, "video000001");
    expect(db.query(READ_SESSION_RUN_SQL).get("owner-default", "same")).toMatchObject({ ended: 1, finishVideoId: null });
    db.query(RESET_SESSION_RUN_SQL).run("owner-default", "same"); save(1, 100);
    expect(db.query(READ_SESSION_RUN_SQL).get("owner-default", "same")).toMatchObject({ runId: 2, consumedSeconds: 0, ended: 0, finishVideoId: null });
    db.exec("PRAGMA foreign_keys=ON; DELETE FROM queues WHERE profileId='owner-default'"); save(2, 10);
    expect(db.query(READ_SESSION_RUN_SQL).get("owner-default", "same")).toBeNull();
  } finally { db.close(); }
});

test("Today admission remains capped while extra followed sources stay in the library", async () => {
  const { LIBRARY_OVERFLOW_RULE_SQL, SAVE_SOURCE_RULE_SQL } = await import("./sourceRuleSql");
  const db = new Database(":memory:");
  const forever = Number.MAX_SAFE_INTEGER;
  try {
    await migrateDatabase(adapter(db));
    for (let i = 0; i < 102; i++) {
      db.query("INSERT INTO followed_channels(profileId,id,title,thumbnailUrl,followedAt,source) VALUES ('owner-default',?,'Creator','',1,'manual')").run(`source-${i}`);
      db.query(LIBRARY_OVERFLOW_RULE_SQL).run("owner-default", `source-${i}`, forever, 1, "owner-default", 1, 100);
    }
    expect(db.query("SELECT count(*) AS count FROM followed_channels").get()).toEqual({ count: 102 });
    expect(db.query("SELECT sourceId FROM source_rules ORDER BY sourceId").all()).toEqual([{ sourceId: "source-100" }, { sourceId: "source-101" }]);
    const change = (id: string, muted: number | null) => db.query(SAVE_SOURCE_RULE_SQL).run("owner-default", id, 240, 1, 1, 2, muted, 2, 0, muted ?? 0, 2, "owner-default", id, 2, 100) as { changes: number };
    expect(change("source-100", null).changes).toBe(0);
    expect(change("source-0", forever).changes).toBe(1);
    expect(change("source-100", null).changes).toBe(1);
    expect(change("source-101", null).changes).toBe(0);
    expect(change("source-1", null).changes).toBe(1); // Existing active source can change its other settings.
  } finally { db.close(); }
});
