import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { DATABASE_SCHEMA_VERSION, migrateDatabase, profileEntityKey } from "@/db/migrations";
import { DEFAULT_OWNER_PROFILE_ID, DEFAULT_OWNER_PROFILE_NAME, type Profile } from "@/models/profile";
import type { ManagedAllowanceRecord } from "@/models/dailyAllowance";
import type { ProfilePlaybackLimitRecord, ProfilePlaybackUsageRecord } from "@/models/viewingAllowance";
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

const webOwner: Profile = {
  id: DEFAULT_OWNER_PROFILE_ID,
  name: DEFAULT_OWNER_PROFILE_NAME,
  role: "owner",
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
};

const webStore = {
  profiles: new Map<string, Profile>([[webOwner.id, webOwner]]),
  allowances: new Map<string, ManagedAllowanceRecord>(),
  playbackLimits: new Map<string, ProfilePlaybackLimitRecord>(),
  playbackUsage: new Map<string, ProfilePlaybackUsageRecord>(),
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
  const expectedTables = ["followed_channels", "managed_allowances", "profile_playback_limits", "profile_playback_usage", "profiles", "queues", "resume_positions", "saved_videos", "watch_later"];
  if (Platform.OS === "web") return { storage: "memory-web-preview", version: DATABASE_SCHEMA_VERSION, tables: expectedTables };
  const db = await getDb();
  const versionRow = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const tableRows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return { storage: "sqlite", version: versionRow?.user_version ?? 0, tables: tableRows.map((row) => row.name) };
}

export async function listProfiles(): Promise<Profile[]> {
  if (Platform.OS === "web") return Array.from(webStore.profiles.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  const db = await getDb();
  return db.getAllAsync<Profile>("SELECT * FROM profiles ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, sortOrder ASC, createdAt ASC");
}

/** Adds a local Standard or Managed profile without copying another profile's records. */
export async function insertLocalProfile(profile: Profile, allowance?: ManagedAllowanceRecord): Promise<void> {
  if (profile.role === "owner") throw new Error("The Owner profile already exists.");
  if ((profile.role === "managed") !== Boolean(allowance)) throw new Error("Managed profiles require an explicit viewing allowance.");
  if (Platform.OS === "web") {
    if (webStore.profiles.has(profile.id)) throw new Error("That profile already exists.");
    webStore.profiles.set(profile.id, { ...profile });
    if (allowance) {
      webStore.allowances.set(profile.id, { ...allowance });
      webStore.playbackLimits.set(profile.id, { profileId: profile.id, dailyLimitMinutes: allowance.mode === "dailyLimit" ? allowance.dailyLimitMinutes : null, pendingDailyLimitMinutes: null, pendingActivatesAt: null, updatedAt: allowance.updatedAt });
      webStore.playbackUsage.set(profile.id, { profileId: profile.id, dayKey: allowance.dayKey, dayStartedAt: allowance.dayStartedAt, lastSeenAt: allowance.lastSeenAt, timezoneOffsetMinutes: allowance.timezoneOffsetMinutes, consumedSeconds: allowance.consumedSeconds, warnedFive: allowance.warnedFive, warnedOne: allowance.warnedOne, updatedAt: allowance.updatedAt });
    }
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?)",
      [profile.id, profile.name, profile.role, profile.sortOrder, profile.createdAt, profile.updatedAt],
    );
    if (allowance) {
      await writeManagedAllowanceRecord(allowance, db);
      await db.runAsync("INSERT INTO profile_playback_limits (profileId,dailyLimitMinutes,pendingDailyLimitMinutes,pendingActivatesAt,updatedAt) VALUES (?,?,?,?,?)", [profile.id, allowance.mode === "dailyLimit" ? allowance.dailyLimitMinutes : null, null, null, allowance.updatedAt]);
      await db.runAsync("INSERT INTO profile_playback_usage (profileId,dayKey,dayStartedAt,lastSeenAt,timezoneOffsetMinutes,consumedSeconds,warnedFive,warnedOne,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)", [profile.id, allowance.dayKey, allowance.dayStartedAt, allowance.lastSeenAt, allowance.timezoneOffsetMinutes, allowance.consumedSeconds, allowance.warnedFive, allowance.warnedOne, allowance.updatedAt]);
    }
  });
}

/** Renames an existing non-Owner profile while preserving its stable identity. */
export async function updateLocalProfileName(profileId: string, name: string, updatedAt: number): Promise<void> {
  if (Platform.OS === "web") {
    const profile = webStore.profiles.get(profileId);
    if (!profile || profile.role === "owner") throw new Error("The Owner profile cannot be renamed here.");
    webStore.profiles.set(profileId, { ...profile, name, updatedAt });
    return;
  }
  const db = await getDb();
  const result = await db.runAsync(
    "UPDATE profiles SET name = ?, updatedAt = ? WHERE id = ? AND role != 'owner'",
    [name, updatedAt, profileId],
  );
  if (result.changes !== 1) throw new Error("The Owner profile cannot be renamed here.");
}

/** Persists the complete profile order while keeping the Owner first. */
export async function updateProfileOrder(orderedProfileIds: readonly string[]): Promise<void> {
  if (Platform.OS === "web") {
    orderedProfileIds.forEach((id, index) => {
      const profile = webStore.profiles.get(id);
      if (profile && profile.role !== "owner") webStore.profiles.set(id, { ...profile, sortOrder: index + 1, updatedAt: Date.now() });
    });
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const [index, id] of orderedProfileIds.entries()) {
      await db.runAsync("UPDATE profiles SET sortOrder = ?, updatedAt = ? WHERE id = ? AND role != 'owner'", [index + 1, Date.now(), id]);
    }
  });
}

/** Deletes one non-Owner profile and all profile-owned local rows atomically. */
export async function deleteLocalProfileRecords(profileId: string): Promise<void> {
  if (profileId === DEFAULT_OWNER_PROFILE_ID) throw new Error("The Owner profile cannot be deleted.");
  if (Platform.OS === "web") {
    const profile = webStore.profiles.get(profileId);
    if (!profile || profile.role === "owner") throw new Error("Only Standard or Managed profiles can be deleted.");
    clearProfileMap(webStore.saved, profileId);
    clearProfileMap(webStore.resume, profileId);
    clearProfileMap(webStore.queues, profileId);
    clearProfileMap(webStore.watchLater, profileId);
    clearProfileMap(webStore.channels, profileId);
    webStore.allowances.delete(profileId);
    webStore.playbackLimits.delete(profileId);
    webStore.playbackUsage.delete(profileId);
    webStore.profiles.delete(profileId);
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const profile = await db.getFirstAsync<Pick<Profile, "role">>("SELECT role FROM profiles WHERE id = ?", [profileId]);
    if (!profile || profile.role === "owner") throw new Error("Only Standard or Managed profiles can be deleted.");
    for (const table of ["saved_videos", "resume_positions", "queues", "watch_later", "followed_channels", "managed_allowances", "profile_playback_limits", "profile_playback_usage"] as const) {
      await db.runAsync(`DELETE FROM ${table} WHERE profileId = ?`, [profileId]);
    }
    await db.runAsync("DELETE FROM profiles WHERE id = ? AND role != 'owner'", [profileId]);
  });
}

export async function readManagedAllowanceRecord(profileId: string): Promise<ManagedAllowanceRecord | null> {
  if (Platform.OS === "web") return webStore.allowances.get(profileId) ?? null;
  const db = await getDb();
  return (await db.getFirstAsync<ManagedAllowanceRecord>("SELECT * FROM managed_allowances WHERE profileId = ?", [profileId])) ?? null;
}

async function writeManagedAllowanceRecord(record: ManagedAllowanceRecord, database?: SQLite.SQLiteDatabase): Promise<void> {
  if (Platform.OS === "web") {
    webStore.allowances.set(record.profileId, { ...record });
    return;
  }
  const db = database ?? await getDb();
  await db.runAsync(
    `INSERT INTO managed_allowances (profileId,mode,dailyLimitMinutes,dayKey,dayStartedAt,lastSeenAt,timezoneOffsetMinutes,consumedSeconds,addedSeconds,warnedFive,warnedOne,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId) DO UPDATE SET mode=excluded.mode,dailyLimitMinutes=excluded.dailyLimitMinutes,dayKey=excluded.dayKey,dayStartedAt=excluded.dayStartedAt,lastSeenAt=excluded.lastSeenAt,timezoneOffsetMinutes=excluded.timezoneOffsetMinutes,consumedSeconds=excluded.consumedSeconds,addedSeconds=excluded.addedSeconds,warnedFive=excluded.warnedFive,warnedOne=excluded.warnedOne,updatedAt=excluded.updatedAt`,
    [record.profileId, record.mode, record.dailyLimitMinutes, record.dayKey, record.dayStartedAt, record.lastSeenAt, record.timezoneOffsetMinutes, record.consumedSeconds, record.addedSeconds, record.warnedFive, record.warnedOne, record.updatedAt],
  );
}

export async function upsertManagedAllowanceRecord(record: ManagedAllowanceRecord): Promise<void> {
  await writeManagedAllowanceRecord(record);
}

export async function readProfilePlaybackLimit(profileId: string): Promise<ProfilePlaybackLimitRecord | null> {
  if (Platform.OS === "web") return webStore.playbackLimits.get(profileId) ?? null;
  const db = await getDb();
  return (await db.getFirstAsync<ProfilePlaybackLimitRecord>("SELECT * FROM profile_playback_limits WHERE profileId = ?", [profileId])) ?? null;
}

export async function upsertProfilePlaybackLimit(record: ProfilePlaybackLimitRecord): Promise<void> {
  if (Platform.OS === "web") { webStore.playbackLimits.set(record.profileId, { ...record }); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO profile_playback_limits (profileId,dailyLimitMinutes,pendingDailyLimitMinutes,pendingActivatesAt,updatedAt) VALUES (?,?,?,?,?)
     ON CONFLICT(profileId) DO UPDATE SET dailyLimitMinutes=excluded.dailyLimitMinutes,pendingDailyLimitMinutes=excluded.pendingDailyLimitMinutes,pendingActivatesAt=excluded.pendingActivatesAt,updatedAt=excluded.updatedAt`,
    [record.profileId, record.dailyLimitMinutes, record.pendingDailyLimitMinutes, record.pendingActivatesAt, record.updatedAt],
  );
}

export async function readProfilePlaybackUsage(profileId: string): Promise<ProfilePlaybackUsageRecord | null> {
  if (Platform.OS === "web") return webStore.playbackUsage.get(profileId) ?? null;
  const db = await getDb();
  return (await db.getFirstAsync<ProfilePlaybackUsageRecord>("SELECT * FROM profile_playback_usage WHERE profileId = ?", [profileId])) ?? null;
}

export async function upsertProfilePlaybackUsage(record: ProfilePlaybackUsageRecord): Promise<void> {
  if (Platform.OS === "web") { webStore.playbackUsage.set(record.profileId, { ...record }); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO profile_playback_usage (profileId,dayKey,dayStartedAt,lastSeenAt,timezoneOffsetMinutes,consumedSeconds,warnedFive,warnedOne,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId) DO UPDATE SET dayKey=excluded.dayKey,dayStartedAt=excluded.dayStartedAt,lastSeenAt=excluded.lastSeenAt,timezoneOffsetMinutes=excluded.timezoneOffsetMinutes,consumedSeconds=excluded.consumedSeconds,warnedFive=excluded.warnedFive,warnedOne=excluded.warnedOne,updatedAt=excluded.updatedAt`,
    [record.profileId, record.dayKey, record.dayStartedAt, record.lastSeenAt, record.timezoneOffsetMinutes, record.consumedSeconds, record.warnedFive, record.warnedOne, record.updatedAt],
  );
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

/** Reads the device-wide distinct source union without exposing local profile ownership. */
export async function listDistinctFollowedChannelIds(): Promise<string[]> {
  if (Platform.OS === "web") return [...new Set(Array.from(webStore.channels.values(), (channel) => channel.id))].sort();
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>("SELECT DISTINCT id FROM followed_channels ORDER BY id ASC");
  return rows.map((row) => row.id);
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

/** Clears only the active profile's local content; profiles and allowance state remain intact. */
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

/** Irreversibly restores the local database to one clean Owner profile. */
export async function resetAllFrameDatabaseData(): Promise<void> {
  if (Platform.OS === "web") {
    webStore.profiles.clear();
    webStore.profiles.set(webOwner.id, { ...webOwner });
    webStore.allowances.clear();
    webStore.playbackLimits.clear();
    webStore.playbackUsage.clear();
    webStore.saved.clear();
    webStore.resume.clear();
    webStore.queues.clear();
    webStore.watchLater.clear();
    webStore.channels.clear();
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of ["saved_videos", "resume_positions", "queues", "watch_later", "followed_channels", "managed_allowances", "profile_playback_limits", "profile_playback_usage"] as const) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    await db.runAsync("DELETE FROM profiles");
    await db.runAsync("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?)", [webOwner.id, webOwner.name, webOwner.role, webOwner.sortOrder, webOwner.createdAt, webOwner.updatedAt]);
  });
}
