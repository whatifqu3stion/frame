import type { SQLiteDatabase } from "expo-sqlite";
import { DEFAULT_OWNER_PROFILE_ID, DEFAULT_OWNER_PROFILE_NAME } from "../models/profile";

export const DATABASE_SCHEMA_VERSION = 4;

export const PROFILE_OWNED_TABLES = [
  "saved_videos",
  "resume_positions",
  "queues",
  "watch_later",
  "followed_channels",
] as const;

export type ProfileOwnedTable = (typeof PROFILE_OWNED_TABLES)[number];

export type SchemaMetadata = Partial<Record<ProfileOwnedTable, readonly string[]>>;

export type MigrationExecutor = Pick<SQLiteDatabase, "execAsync" | "getAllAsync" | "getFirstAsync">;

const tableDefinitions: Record<ProfileOwnedTable, string> = {
  saved_videos: `
    profileId TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    channelId TEXT NOT NULL,
    channelTitle TEXT NOT NULL,
    thumbnailUrl TEXT NOT NULL,
    publishedAt TEXT NOT NULL,
    durationSeconds INTEGER NOT NULL,
    description TEXT,
    savedAt INTEGER NOT NULL,
    PRIMARY KEY (profileId, id),
    FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE`,
  resume_positions: `
    profileId TEXT NOT NULL,
    videoId TEXT NOT NULL,
    timestampSeconds INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    title TEXT,
    channelTitle TEXT,
    thumbnailUrl TEXT,
    durationSeconds INTEGER,
    PRIMARY KEY (profileId, videoId),
    FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE`,
  queues: `
    profileId TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    orderedVideoIds TEXT NOT NULL,
    updatedAt INTEGER NOT NULL,
    PRIMARY KEY (profileId, id),
    FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE`,
  watch_later: `
    profileId TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    channelId TEXT NOT NULL,
    channelTitle TEXT NOT NULL,
    thumbnailUrl TEXT NOT NULL,
    publishedAt TEXT NOT NULL,
    durationSeconds INTEGER NOT NULL,
    description TEXT,
    addedAt INTEGER NOT NULL,
    PRIMARY KEY (profileId, id),
    FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE`,
  followed_channels: `
    profileId TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    thumbnailUrl TEXT NOT NULL,
    followedAt INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    PRIMARY KEY (profileId, id),
    FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE`,
};

const copyColumns: Record<ProfileOwnedTable, readonly string[]> = {
  saved_videos: ["id", "title", "channelId", "channelTitle", "thumbnailUrl", "publishedAt", "durationSeconds", "description", "savedAt"],
  resume_positions: ["videoId", "timestampSeconds", "updatedAt", "title", "channelTitle", "thumbnailUrl", "durationSeconds"],
  queues: ["id", "name", "orderedVideoIds", "updatedAt"],
  watch_later: ["id", "title", "channelId", "channelTitle", "thumbnailUrl", "publishedAt", "durationSeconds", "description", "addedAt"],
  followed_channels: ["id", "title", "description", "thumbnailUrl", "followedAt", "source"],
};

export const CREATE_PROFILES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'standard', 'managed')),
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
)`;

export const CREATE_MANAGED_ALLOWANCES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS managed_allowances (
  profileId TEXT PRIMARY KEY NOT NULL,
  mode TEXT NOT NULL,
  dailyLimitMinutes INTEGER,
  dayKey TEXT NOT NULL,
  dayStartedAt INTEGER NOT NULL,
  lastSeenAt INTEGER NOT NULL,
  timezoneOffsetMinutes INTEGER NOT NULL,
  consumedSeconds INTEGER NOT NULL,
  addedSeconds INTEGER NOT NULL,
  warnedFive INTEGER NOT NULL,
  warnedOne INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
)`;

export const CREATE_PROFILE_PLAYBACK_LIMITS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS profile_playback_limits (
  profileId TEXT PRIMARY KEY NOT NULL,
  dailyLimitMinutes INTEGER,
  pendingDailyLimitMinutes INTEGER,
  pendingActivatesAt INTEGER,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
)`;

export const CREATE_PROFILE_PLAYBACK_USAGE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS profile_playback_usage (
  profileId TEXT PRIMARY KEY NOT NULL,
  dayKey TEXT NOT NULL,
  dayStartedAt INTEGER NOT NULL,
  lastSeenAt INTEGER NOT NULL,
  timezoneOffsetMinutes INTEGER NOT NULL,
  consumedSeconds INTEGER NOT NULL,
  warnedFive INTEGER NOT NULL,
  warnedOne INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
)`;

export const CREATE_TODAY_SNAPSHOTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS today_snapshots (
  profileId TEXT NOT NULL,
  periodKey TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  cacheFetchedAt INTEGER,
  freshness TEXT NOT NULL CHECK (freshness IN ('fresh', 'stale', 'offline')),
  PRIMARY KEY (profileId, periodKey),
  FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
)`;

export const CREATE_TODAY_SNAPSHOT_ITEMS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS today_snapshot_items (
  profileId TEXT NOT NULL,
  periodKey TEXT NOT NULL,
  mediaId TEXT NOT NULL,
  sourceId TEXT NOT NULL,
  sourceTitle TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnailUrl TEXT NOT NULL,
  publishedAt TEXT NOT NULL,
  durationSeconds INTEGER NOT NULL,
  description TEXT,
  madeForKids INTEGER,
  isLivestream INTEGER NOT NULL,
  isUpcomingPremiere INTEGER NOT NULL,
  fetchedAt INTEGER NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 11),
  disposition TEXT NOT NULL CHECK (disposition IN ('pending','saved','session','watched','snoozed','dismissed','unavailable')),
  dispositionAt INTEGER,
  snoozedUntil INTEGER,
  PRIMARY KEY (profileId, periodKey, mediaId),
  UNIQUE (profileId, periodKey, position),
  FOREIGN KEY (profileId, periodKey) REFERENCES today_snapshots(profileId, periodKey) ON DELETE CASCADE
)`;

export const CREATE_SOURCE_RULES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS source_rules (
  profileId TEXT NOT NULL,
  sourceId TEXT NOT NULL,
  minimumDurationSeconds INTEGER NOT NULL DEFAULT 0 CHECK (minimumDurationSeconds BETWEEN 0 AND 86400),
  hideLivestreams INTEGER NOT NULL DEFAULT 1 CHECK (hideLivestreams IN (0,1)),
  hideUpcomingPremieres INTEGER NOT NULL DEFAULT 1 CHECK (hideUpcomingPremieres IN (0,1)),
  todayContributionLimit INTEGER NOT NULL DEFAULT 2 CHECK (todayContributionLimit BETWEEN 1 AND 2),
  mutedUntil INTEGER,
  updatedAt INTEGER NOT NULL,
  PRIMARY KEY (profileId, sourceId),
  FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
)`;

export function createProfileOwnedTableSql(table: ProfileOwnedTable, tableName: string = table): string {
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${tableDefinitions[table]})`;
}

/** Composite key used by the web preview store and deterministic repository tests. */
export function profileEntityKey(profileId: string, entityId: string): string {
  return `${profileId}:${entityId}`;
}

/** Returns the deterministic work required to reach version 1 for a known schema. */
export function buildVersion1MigrationPlan(metadata: SchemaMetadata): string[] {
  const statements: string[] = [CREATE_PROFILES_TABLE_SQL, seedDefaultOwnerSql()];
  for (const table of PROFILE_OWNED_TABLES) {
    const columns = metadata[table];
    if (!columns) {
      statements.push(createProfileOwnedTableSql(table));
    } else if (!columns.includes("profileId")) {
      statements.push(...rebuildLegacyTableSql(table, columns));
    }
  }
  statements.push("PRAGMA user_version = 1");
  return statements;
}

/** Adds ordering and the legacy Managed allowance state without rewriting profile-owned content. */
export function buildVersion2MigrationPlan(): string[] {
  return [
    "ALTER TABLE profiles ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0",
    `UPDATE profiles SET sortOrder = CASE WHEN role = 'owner' THEN 0 ELSE (SELECT COUNT(*) FROM profiles AS earlier WHERE earlier.role != 'owner' AND (earlier.createdAt < profiles.createdAt OR (earlier.createdAt = profiles.createdAt AND earlier.id < profiles.id))) + 1 END`,
    CREATE_MANAGED_ALLOWANCES_TABLE_SQL,
    "PRAGMA user_version = 2",
  ];
}

/** Adds profile-wide playback limits and daily usage while preserving any existing Managed allowance state. */
export function buildVersion3MigrationPlan(): string[] {
  return [
    CREATE_PROFILE_PLAYBACK_LIMITS_TABLE_SQL,
    CREATE_PROFILE_PLAYBACK_USAGE_TABLE_SQL,
    `INSERT OR IGNORE INTO profile_playback_limits (profileId,dailyLimitMinutes,pendingDailyLimitMinutes,pendingActivatesAt,updatedAt)
     SELECT profileId, CASE WHEN mode = 'dailyLimit' THEN dailyLimitMinutes ELSE NULL END, NULL, NULL, updatedAt FROM managed_allowances`,
    `INSERT OR IGNORE INTO profile_playback_usage (profileId,dayKey,dayStartedAt,lastSeenAt,timezoneOffsetMinutes,consumedSeconds,warnedFive,warnedOne,updatedAt)
     SELECT profileId,dayKey,dayStartedAt,lastSeenAt,timezoneOffsetMinutes,consumedSeconds,warnedFive,warnedOne,updatedAt FROM managed_allowances`,
    "PRAGMA user_version = 3",
  ];
}

/** Adds finite profile-local Today snapshots and local source rules. */
export function buildVersion4MigrationPlan(): string[] {
  return [
    CREATE_TODAY_SNAPSHOTS_TABLE_SQL,
    CREATE_TODAY_SNAPSHOT_ITEMS_TABLE_SQL,
    CREATE_SOURCE_RULES_TABLE_SQL,
    "CREATE INDEX IF NOT EXISTS today_snapshot_items_profile_disposition_idx ON today_snapshot_items(profileId, disposition, dispositionAt)",
    "CREATE INDEX IF NOT EXISTS today_snapshot_items_profile_snooze_idx ON today_snapshot_items(profileId, snoozedUntil) WHERE disposition = 'snoozed'",
    "PRAGMA user_version = 4",
  ];
}

function seedDefaultOwnerSql(): string {
  return `INSERT OR IGNORE INTO profiles (id, name, role, createdAt, updatedAt) VALUES ('${DEFAULT_OWNER_PROFILE_ID}', '${DEFAULT_OWNER_PROFILE_NAME}', 'owner', 0, 0)`;
}

function rebuildLegacyTableSql(table: ProfileOwnedTable, existingColumns: readonly string[]): string[] {
  const replacement = `${table}_profile_v1`;
  const destinationColumns = ["profileId", ...copyColumns[table]];
  const sourceExpressions = copyColumns[table].map((column) => {
    if (table === "followed_channels" && column === "source" && !existingColumns.includes("source")) return "'manual'";
    return column;
  });
  return [
    `DROP TABLE IF EXISTS ${replacement}`,
    createProfileOwnedTableSql(table, replacement),
    `INSERT INTO ${replacement} (${destinationColumns.join(", ")}) SELECT '${DEFAULT_OWNER_PROFILE_ID}', ${sourceExpressions.join(", ")} FROM ${table}`,
    `DROP TABLE ${table}`,
    `ALTER TABLE ${replacement} RENAME TO ${table}`,
  ];
}

/** Executes a migration atomically and always attempts rollback after a failure. */
export async function executeMigrationTransaction(
  executor: Pick<MigrationExecutor, "execAsync">,
  statements: readonly string[],
): Promise<void> {
  await executor.execAsync("BEGIN IMMEDIATE TRANSACTION");
  try {
    for (const statement of statements) await executor.execAsync(statement);
    await executor.execAsync("COMMIT");
  } catch (error) {
    await executor.execAsync("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function readSchemaMetadata(db: MigrationExecutor): Promise<SchemaMetadata> {
  const metadata: SchemaMetadata = {};
  for (const table of PROFILE_OWNED_TABLES) {
    const tableRow = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table],
    );
    if (!tableRow) continue;
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    metadata[table] = columns.map((column) => column.name);
  }
  return metadata;
}

/** Migrates fresh or legacy databases additively without deleting user records. */
export async function migrateDatabase(db: MigrationExecutor): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion > DATABASE_SCHEMA_VERSION) {
    throw new Error(`Database version ${currentVersion} is newer than this build supports.`);
  }
  if (currentVersion < 1) {
    const metadata = await readSchemaMetadata(db);
    await executeMigrationTransaction(db, buildVersion1MigrationPlan(metadata));
    currentVersion = 1;
  }
  if (currentVersion < 2) {
    await executeMigrationTransaction(db, buildVersion2MigrationPlan());
    currentVersion = 2;
  }
  if (currentVersion < 3) {
    await executeMigrationTransaction(db, buildVersion3MigrationPlan());
    currentVersion = 3;
  }
  if (currentVersion < 4) {
    await executeMigrationTransaction(db, buildVersion4MigrationPlan());
  }
}
