import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import type { FollowedChannel, ResumePosition, Video, VideoQueue } from "@/types";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === "web") {
    throw new Error("SQLite unavailable on web");
  }
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("frame.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS saved_videos (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          channelId TEXT NOT NULL,
          channelTitle TEXT NOT NULL,
          thumbnailUrl TEXT NOT NULL,
          publishedAt TEXT NOT NULL,
          durationSeconds INTEGER NOT NULL,
          description TEXT,
          savedAt INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS resume_positions (
          videoId TEXT PRIMARY KEY NOT NULL,
          timestampSeconds INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          title TEXT,
          channelTitle TEXT,
          thumbnailUrl TEXT,
          durationSeconds INTEGER
        );
        CREATE TABLE IF NOT EXISTS queues (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          orderedVideoIds TEXT NOT NULL,
          updatedAt INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS watch_later (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          channelId TEXT NOT NULL,
          channelTitle TEXT NOT NULL,
          thumbnailUrl TEXT NOT NULL,
          publishedAt TEXT NOT NULL,
          durationSeconds INTEGER NOT NULL,
          description TEXT,
          addedAt INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS followed_channels (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          thumbnailUrl TEXT NOT NULL,
          followedAt INTEGER NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual'
        );
      `);
      const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(followed_channels)");
      if (!columns.some((column) => column.name === "source")) {
        await db.execAsync("ALTER TABLE followed_channels ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
      }
      return db;
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

// In-memory fallback for web previews so the UI still works.
const webStore = {
  saved: new Map<string, Video & { savedAt: number }>(),
  resume: new Map<string, ResumePosition & { title?: string; channelTitle?: string; thumbnailUrl?: string; durationSeconds?: number }>(),
  queues: new Map<string, VideoQueue>(),
  watchLater: new Map<string, Video & { addedAt: number }>(),
  channels: new Map<string, FollowedChannel>(),
};

export async function listSavedVideos(): Promise<Video[]> {
  if (Platform.OS === "web") {
    return Array.from(webStore.saved.values())
      .sort((a, b) => b.savedAt - a.savedAt)
      .map((v) => ({ ...v }));
  }
  const db = await getDb();
  const rows = await db.getAllAsync<Video & { savedAt: number }>(
    "SELECT * FROM saved_videos ORDER BY savedAt DESC",
  );
  return rows;
}

export async function isVideoSaved(videoId: string): Promise<boolean> {
  if (Platform.OS === "web") return webStore.saved.has(videoId);
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM saved_videos WHERE id = ?", [videoId]);
  return Boolean(row);
}

export async function saveVideo(v: Video): Promise<void> {
  const savedAt = Date.now();
  if (Platform.OS === "web") {
    webStore.saved.set(v.id, { ...v, savedAt });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO saved_videos (id,title,channelId,channelTitle,thumbnailUrl,publishedAt,durationSeconds,description,savedAt)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [v.id, v.title, v.channelId, v.channelTitle, v.thumbnailUrl, v.publishedAt, v.durationSeconds, v.description ?? null, savedAt],
  );
}

export async function unsaveVideo(videoId: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.saved.delete(videoId);
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM saved_videos WHERE id = ?", [videoId]);
}

export type ResumeRow = ResumePosition & {
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
};

export async function listResume(): Promise<ResumeRow[]> {
  if (Platform.OS === "web") {
    return Array.from(webStore.resume.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const db = await getDb();
  return db.getAllAsync<ResumeRow>("SELECT * FROM resume_positions ORDER BY updatedAt DESC LIMIT 24");
}

export async function getResume(videoId: string): Promise<ResumeRow | null> {
  if (Platform.OS === "web") return webStore.resume.get(videoId) ?? null;
  const db = await getDb();
  const row = await db.getFirstAsync<ResumeRow>("SELECT * FROM resume_positions WHERE videoId = ?", [videoId]);
  return row ?? null;
}

export async function upsertResume(v: Video, timestampSeconds: number): Promise<void> {
  const updatedAt = Date.now();
  if (Platform.OS === "web") {
    webStore.resume.set(v.id, {
      videoId: v.id,
      timestampSeconds,
      updatedAt,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnailUrl: v.thumbnailUrl,
      durationSeconds: v.durationSeconds,
    });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO resume_positions (videoId,timestampSeconds,updatedAt,title,channelTitle,thumbnailUrl,durationSeconds)
     VALUES (?,?,?,?,?,?,?)`,
    [v.id, Math.floor(timestampSeconds), updatedAt, v.title, v.channelTitle, v.thumbnailUrl, v.durationSeconds],
  );
}

export async function clearResume(videoId: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.resume.delete(videoId);
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM resume_positions WHERE videoId = ?", [videoId]);
}

export async function listQueues(): Promise<VideoQueue[]> {
  if (Platform.OS === "web") {
    return Array.from(webStore.queues.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; orderedVideoIds: string; updatedAt: number }>(
    "SELECT * FROM queues ORDER BY updatedAt DESC",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    orderedVideoIds: safeParseIds(r.orderedVideoIds),
    updatedAt: r.updatedAt,
  }));
}

function safeParseIds(input: string): string[] {
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function upsertQueue(q: VideoQueue): Promise<void> {
  if (Platform.OS === "web") {
    webStore.queues.set(q.id, { ...q });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO queues (id,name,orderedVideoIds,updatedAt) VALUES (?,?,?,?)",
    [q.id, q.name, JSON.stringify(q.orderedVideoIds), q.updatedAt],
  );
}

export async function deleteQueue(id: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.queues.delete(id);
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM queues WHERE id = ?", [id]);
}

export async function listWatchLater(): Promise<Video[]> {
  if (Platform.OS === "web") {
    return Array.from(webStore.watchLater.values())
      .sort((a, b) => b.addedAt - a.addedAt)
      .map((v) => ({ ...v }));
  }
  const db = await getDb();
  return db.getAllAsync<Video & { addedAt: number }>("SELECT * FROM watch_later ORDER BY addedAt DESC");
}

export async function addWatchLater(v: Video): Promise<void> {
  const addedAt = Date.now();
  if (Platform.OS === "web") {
    webStore.watchLater.set(v.id, { ...v, addedAt });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO watch_later (id,title,channelId,channelTitle,thumbnailUrl,publishedAt,durationSeconds,description,addedAt)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [v.id, v.title, v.channelId, v.channelTitle, v.thumbnailUrl, v.publishedAt, v.durationSeconds, v.description ?? null, addedAt],
  );
}

export async function removeWatchLater(videoId: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.watchLater.delete(videoId);
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM watch_later WHERE id = ?", [videoId]);
}

export async function listFollowedChannels(): Promise<FollowedChannel[]> {
  if (Platform.OS === "web") {
    return Array.from(webStore.channels.values()).sort((a, b) => b.followedAt - a.followedAt);
  }
  const db = await getDb();
  return db.getAllAsync<FollowedChannel>("SELECT * FROM followed_channels ORDER BY followedAt DESC");
}

export async function followChannel(c: FollowedChannel): Promise<void> {
  if (Platform.OS === "web") {
    webStore.channels.set(c.id, { ...c });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO followed_channels (id,title,description,thumbnailUrl,followedAt,source) VALUES (?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       description=excluded.description,
       thumbnailUrl=excluded.thumbnailUrl`,
    [c.id, c.title, c.description ?? null, c.thumbnailUrl, c.followedAt, c.source],
  );
}

export async function followChannels(channels: FollowedChannel[]): Promise<void> {
  if (Platform.OS === "web") {
    channels.forEach((channel) => {
      const existing = webStore.channels.get(channel.id);
      webStore.channels.set(channel.id, existing ? { ...channel, followedAt: existing.followedAt, source: existing.source } : { ...channel });
    });
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const channel of channels) {
      await db.runAsync(
        `INSERT INTO followed_channels (id,title,description,thumbnailUrl,followedAt,source) VALUES (?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title,
           description=excluded.description,
           thumbnailUrl=excluded.thumbnailUrl`,
        [channel.id, channel.title, channel.description ?? null, channel.thumbnailUrl, channel.followedAt, channel.source],
      );
    }
  });
}

export async function unfollowChannel(id: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.channels.delete(id);
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM followed_channels WHERE id = ?", [id]);
}

export async function clearAllData(): Promise<void> {
  if (Platform.OS === "web") {
    webStore.saved.clear();
    webStore.resume.clear();
    webStore.queues.clear();
    webStore.watchLater.clear();
    webStore.channels.clear();
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM saved_videos;
      DELETE FROM resume_positions;
      DELETE FROM queues;
      DELETE FROM watch_later;
      DELETE FROM followed_channels;
    `);
  });
}
