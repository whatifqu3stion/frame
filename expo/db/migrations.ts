import type { SQLiteDatabase } from "expo-sqlite";
import { DEFAULT_OWNER_PROFILE_ID, DEFAULT_OWNER_PROFILE_NAME } from "../models/profile";

export const DATABASE_SCHEMA_VERSION = 1;

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
  statements.push(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION}`);
  return statements;
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

/** Migrates fresh or legacy databases to version 1 without deleting user records. */
export async function migrateDatabase(db: MigrationExecutor): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion > DATABASE_SCHEMA_VERSION) {
    throw new Error(`Database version ${currentVersion} is newer than this build supports.`);
  }
  if (currentVersion === DATABASE_SCHEMA_VERSION) return;

  const metadata = await readSchemaMetadata(db);
  const plan = buildVersion1MigrationPlan(metadata);
  await executeMigrationTransaction(db, plan);
}
