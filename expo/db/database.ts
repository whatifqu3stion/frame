import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { DATABASE_SCHEMA_VERSION, migrateDatabase, profileEntityKey } from "@/db/migrations";
import type { Profile } from "@/models/profile";
import type { FollowedChannel, ResumePosition, Video, VideoQueue } from "@/types";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export { DATABASE_SCHEMA_VERSION } from "@/db/migrations";

export type DatabaseDiagnostics = {
  storage: "sqlite" | "memory-web-preview";
  version: number;
  tables: string[];
};

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === "web") throw new Error("SQLite unavailable on web");
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("frame.db")
      .then(async (db) => {
        await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;");
        await migrateDatabase(db);
        await db.execAsync("PRAGMA foreign_keys = ON;");
        return db;
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}

const webStore = {
  saved: new Map<string, Video & { savedAt: number }>(),
  resume: new Map<string, ResumeRow>(),
  queues: new Map<string, VideoQueue>(),
  watchLater: new Map<string, Video & { addedAt: number }>(),
  channels: new Map<string, FollowedChannel>(),
};

function profileValues<T>(store: Map<string, T>, profileId: string): T[] {
  const prefix = `${profileId}:`;
  return Array.from(store.entries()).filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
}

function clearProfileMap<T>(store: Map<string, T>, profileId: string): void {
  const prefix = `${profileId}:`;
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}

/** Initializes migrations eagerly for device-level smoke tests. */
export async function initializeDatabase(): Promise<void> {
  if (Platform.OS !== "web") await getDb();
}

/** Reads non-sensitive database metadata without changing the schema. */
export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const expectedTables = ["followed_channels", "profiles", "queues", "resume_positions", "saved_videos", "watch_later"];
  if (Platform.OS === "web") return { storage: "memory-web-preview", version: DATABASE_SCHEMA_VERSION, tables: expectedTables };
  const db = await getDb();
  const versionRow = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const tableRows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return { storage: "sqlite", version: versionRow?.user_version ?? 0, tables: tableRows.map((row) => row.name) };
}

export async function listProfiles(): Promise<Profile[]> {
  if (Platform.OS === "web") return [];
  const db = await getDb();
  return db.getAllAsync<Profile>("SELECT * FROM profiles ORDER BY createdAt ASC");
}

export async function listSavedVideos(profileId: string): Promise<Video[]> {
  if (Platform.OS === "web") return profileValues(webStore.saved, profileId).sort((a, b) => b.savedAt - a.savedAt).map((video) => ({ ...video }));
  const db = await getDb();
  return db.getAllAsync<Video & { savedAt: number }>("SELECT * FROM saved_videos WHERE profileId = ? ORDER BY savedAt DESC", [profileId]);
}

export async function isVideoSaved(profileId: string, videoId: string): Promise<boolean> {
  if (Platform.OS === "web") return webStore.saved.has(profileEntityKey(profileId, videoId));
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM saved_videos WHERE profileId = ? AND id = ?", [profileId, videoId]);
  return Boolean(row);
}

export async function saveVideo(profileId: string, video: Video): Promise<void> {
  const savedAt = Date.now();
  if (Platform.OS === "web") {
    webStore.saved.set(profileEntityKey(profileId, video.id), { ...video, savedAt });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO saved_videos (profileId,id,title,channelId,channelTitle,thumbnailUrl,publishedAt,durationSeconds,description,savedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId,id) DO UPDATE SET title=excluded.title,channelId=excluded.channelId,channelTitle=excluded.channelTitle,thumbnailUrl=excluded.thumbnailUrl,publishedAt=excluded.publishedAt,durationSeconds=excluded.durationSeconds,description=excluded.description,savedAt=excluded.savedAt`,
    [profileId, video.id, video.title, video.channelId, video.channelTitle, video.thumbnailUrl, video.publishedAt, video.durationSeconds, video.description ?? null, savedAt],
  );
}

export async function unsaveVideo(profileId: string, videoId: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.saved.delete(profileEntityKey(profileId, videoId));
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM saved_videos WHERE profileId = ? AND id = ?", [profileId, videoId]);
}

export type ResumeRow = ResumePosition & {
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
};

export async function listResume(profileId: string): Promise<ResumeRow[]> {
  if (Platform.OS === "web") return profileValues(webStore.resume, profileId).sort((a, b) => b.updatedAt - a.updatedAt);
  const db = await getDb();
  return db.getAllAsync<ResumeRow>("SELECT * FROM resume_positions WHERE profileId = ? ORDER BY updatedAt DESC LIMIT 24", [profileId]);
}

export async function getResume(profileId: string, videoId: string): Promise<ResumeRow | null> {
  if (Platform.OS === "web") return webStore.resume.get(profileEntityKey(profileId, videoId)) ?? null;
  const db = await getDb();
  return (await db.getFirstAsync<ResumeRow>("SELECT * FROM resume_positions WHERE profileId = ? AND videoId = ?", [profileId, videoId])) ?? null;
}

export async function upsertResume(profileId: string, video: Video, timestampSeconds: number): Promise<void> {
  const row: ResumeRow = {
    videoId: video.id,
    timestampSeconds: Math.floor(timestampSeconds),
    updatedAt: Date.now(),
    title: video.title,
    channelTitle: video.channelTitle,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
  };
  if (Platform.OS === "web") {
    webStore.resume.set(profileEntityKey(profileId, video.id), row);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO resume_positions (profileId,videoId,timestampSeconds,updatedAt,title,channelTitle,thumbnailUrl,durationSeconds)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId,videoId) DO UPDATE SET timestampSeconds=excluded.timestampSeconds,updatedAt=excluded.updatedAt,title=excluded.title,channelTitle=excluded.channelTitle,thumbnailUrl=excluded.thumbnailUrl,durationSeconds=excluded.durationSeconds`,
    [profileId, row.videoId, row.timestampSeconds, row.updatedAt, row.title ?? null, row.channelTitle ?? null, row.thumbnailUrl ?? null, row.durationSeconds ?? null],
  );
}

export async function clearResume(profileId: string, videoId: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.resume.delete(profileEntityKey(profileId, videoId));
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM resume_positions WHERE profileId = ? AND videoId = ?", [profileId, videoId]);
}

function safeParseIds(input: string): string[] {
  try {
    const parsed = JSON.parse(input) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export async function listQueues(profileId: string): Promise<VideoQueue[]> {
  if (Platform.OS === "web") return profileValues(webStore.queues, profileId).sort((a, b) => b.updatedAt - a.updatedAt);
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; orderedVideoIds: string; updatedAt: number }>(
    "SELECT id,name,orderedVideoIds,updatedAt FROM queues WHERE profileId = ? ORDER BY updatedAt DESC",
    [profileId],
  );
  return rows.map((row) => ({ ...row, orderedVideoIds: safeParseIds(row.orderedVideoIds) }));
}

export async function upsertQueue(profileId: string, queue: VideoQueue): Promise<void> {
  if (Platform.OS === "web") {
    webStore.queues.set(profileEntityKey(profileId, queue.id), { ...queue });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO queues (profileId,id,name,orderedVideoIds,updatedAt) VALUES (?,?,?,?,?)
     ON CONFLICT(profileId,id) DO UPDATE SET name=excluded.name,orderedVideoIds=excluded.orderedVideoIds,updatedAt=excluded.updatedAt`,
    [profileId, queue.id, queue.name, JSON.stringify(queue.orderedVideoIds), queue.updatedAt],
  );
}

export async function deleteQueue(profileId: string, id: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.queues.delete(profileEntityKey(profileId, id));
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM queues WHERE profileId = ? AND id = ?", [profileId, id]);
}

export async function listWatchLater(profileId: string): Promise<Video[]> {
  if (Platform.OS === "web") return profileValues(webStore.watchLater, profileId).sort((a, b) => b.addedAt - a.addedAt).map((video) => ({ ...video }));
  const db = await getDb();
  return db.getAllAsync<Video & { addedAt: number }>("SELECT * FROM watch_later WHERE profileId = ? ORDER BY addedAt DESC", [profileId]);
}

export async function addWatchLater(profileId: string, video: Video): Promise<void> {
  const addedAt = Date.now();
  if (Platform.OS === "web") {
    webStore.watchLater.set(profileEntityKey(profileId, video.id), { ...video, addedAt });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO watch_later (profileId,id,title,channelId,channelTitle,thumbnailUrl,publishedAt,durationSeconds,description,addedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId,id) DO UPDATE SET title=excluded.title,channelId=excluded.channelId,channelTitle=excluded.channelTitle,thumbnailUrl=excluded.thumbnailUrl,publishedAt=excluded.publishedAt,durationSeconds=excluded.durationSeconds,description=excluded.description,addedAt=excluded.addedAt`,
    [profileId, video.id, video.title, video.channelId, video.channelTitle, video.thumbnailUrl, video.publishedAt, video.durationSeconds, video.description ?? null, addedAt],
  );
}

export async function removeWatchLater(profileId: string, videoId: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.watchLater.delete(profileEntityKey(profileId, videoId));
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM watch_later WHERE profileId = ? AND id = ?", [profileId, videoId]);
}

export async function listFollowedChannels(profileId: string): Promise<FollowedChannel[]> {
  if (Platform.OS === "web") return profileValues(webStore.channels, profileId).sort((a, b) => b.followedAt - a.followedAt);
  const db = await getDb();
  return db.getAllAsync<FollowedChannel>("SELECT * FROM followed_channels WHERE profileId = ? ORDER BY followedAt DESC", [profileId]);
}

export async function followChannel(profileId: string, channel: FollowedChannel): Promise<void> {
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, channel.id);
    const existing = webStore.channels.get(key);
    webStore.channels.set(key, existing ? { ...channel, followedAt: existing.followedAt, source: existing.source } : { ...channel });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO followed_channels (profileId,id,title,description,thumbnailUrl,followedAt,source) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(profileId,id) DO UPDATE SET title=excluded.title,description=excluded.description,thumbnailUrl=excluded.thumbnailUrl`,
    [profileId, channel.id, channel.title, channel.description ?? null, channel.thumbnailUrl, channel.followedAt, channel.source],
  );
}

export async function followChannels(profileId: string, channels: FollowedChannel[]): Promise<void> {
  if (Platform.OS === "web") {
    for (const channel of channels) await followChannel(profileId, channel);
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const channel of channels) {
      await db.runAsync(
        `INSERT INTO followed_channels (profileId,id,title,description,thumbnailUrl,followedAt,source) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(profileId,id) DO UPDATE SET title=excluded.title,description=excluded.description,thumbnailUrl=excluded.thumbnailUrl`,
        [profileId, channel.id, channel.title, channel.description ?? null, channel.thumbnailUrl, channel.followedAt, channel.source],
      );
    }
  });
}

export async function unfollowChannel(profileId: string, id: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.channels.delete(profileEntityKey(profileId, id));
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM followed_channels WHERE profileId = ? AND id = ?", [profileId, id]);
}

/** Clears only the active profile's local records; profiles and other profiles remain intact. */
export async function clearAllData(profileId: string): Promise<void> {
  if (Platform.OS === "web") {
    clearProfileMap(webStore.saved, profileId);
    clearProfileMap(webStore.resume, profileId);
    clearProfileMap(webStore.queues, profileId);
    clearProfileMap(webStore.watchLater, profileId);
    clearProfileMap(webStore.channels, profileId);
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of ["saved_videos", "resume_positions", "queues", "watch_later", "followed_channels"] as const) {
      await db.runAsync(`DELETE FROM ${table} WHERE profileId = ?`, [profileId]);
    }
  });
}
