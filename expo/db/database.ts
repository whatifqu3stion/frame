import { PREVIEW_LIBRARY_ENABLED } from "../preview/mode";
import { makePreviewLibrary } from "../preview/library";
import { LIBRARY_OVERFLOW_RULE_SQL, SAVE_SOURCE_RULE_SQL } from "./sourceRuleSql";
import { READ_SESSION_RUN_SQL, SAVE_SESSION_RUN_SQL, RESET_SESSION_RUN_SQL } from "./sessionRunSql";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { defaultTodaySourceRule, LIBRARY_ONLY_UNTIL, getTodayPeriod } from "@/domain/today";
import { normalizeSessionTarget } from "../domain/sessionFlow";
import { emptySessionRun, type SessionRun } from "../domain/sessionTimer";
import { assertLongFormVideo, isLongFormVideo } from "../domain/contentPolicy";
import * as SQLite from "expo-sqlite";
import { SAVE_VIDEO_SQL, UNSAVE_VIDEO_SQL } from "@/db/savedLibrarySql";
import { EXPIRE_TODAY_METADATA_SQL, EXPIRE_LIBRARY_METADATA_SQL, METADATA_MAX_AGE_MS, expireTodayItem, expireVideo, expireChannel, expireResume, isMetadataCurrent } from "@/domain/metadataRetention";
import { Platform } from "react-native";
import { DATABASE_SCHEMA_VERSION, migrateDatabase, profileEntityKey } from "@/db/migrations";
import { DEFAULT_OWNER_PROFILE_ID, DEFAULT_OWNER_PROFILE_NAME, type Profile } from "@/models/profile";
import type { ManagedAllowanceRecord } from "@/models/dailyAllowance";
import type { ProfilePlaybackLimitRecord, ProfilePlaybackUsageRecord } from "@/models/viewingAllowance";
import type { ProfilePlaybackControlsRecord, ProfileSessionUsageRecord } from "@/models/playbackControls";
import type { ManagedApprovalRequest, ManagedApprovedSource, ManagedApprovedVideo, ManagedContentMode, ManagedContentPolicy } from "@/models/managedContentAccess";
import type { FollowedChannel, ResumePosition, Video, VideoQueue, SessionDraft } from "@/types";
import type { CachedTodayCandidate, TodayDisposition, TodaySnapshot, TodaySnapshotItem, TodaySourceRule } from "@/models/today";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const webSessionRuns = new Map<string, SessionRun>();

export async function readSessionRun(profileId: string, sessionId: string): Promise<SessionRun> {
  if (Platform.OS === "web") return { ...(webSessionRuns.get(profileEntityKey(profileId, sessionId)) ?? emptySessionRun()) };
  const db = await getDb();
  const row = await db.getFirstAsync<Omit<SessionRun, "ended"> & { ended: number }>(READ_SESSION_RUN_SQL, [profileId, sessionId]);
  return row ? { ...row, ended: row.ended === 1 } : emptySessionRun();
}

/** A previous run's delayed checkpoint cannot overwrite a newly started session. */
export async function saveSessionRun(profileId: string, sessionId: string, run: SessionRun): Promise<void> {
  if (!Number.isFinite(run.consumedSeconds) || run.consumedSeconds < 0) throw new Error("Invalid session time");
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, sessionId);
    if (!webStore.queues.has(key)) return;
    const previous = webSessionRuns.get(key) ?? emptySessionRun();
    if (previous.runId !== run.runId) return;
    webSessionRuns.set(key, { ...run, consumedSeconds: Math.max(previous.consumedSeconds, run.consumedSeconds), ended: previous.ended || run.ended, finishVideoId: previous.ended || run.ended ? null : previous.finishVideoId ?? run.finishVideoId, lastVideoId: run.consumedSeconds >= previous.consumedSeconds ? run.lastVideoId : previous.lastVideoId });
    return;
  }
  const db = await getDb();
  await db.runAsync(SAVE_SESSION_RUN_SQL, [profileId, sessionId, run.runId, run.consumedSeconds, run.ended ? 1 : 0, run.finishVideoId, run.lastVideoId, profileId, sessionId]);
}

export async function resetSessionRun(profileId: string, sessionId: string): Promise<void> {
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, sessionId);
    if (!webStore.queues.has(key)) throw new Error("Session no longer available");
    const previous = webSessionRuns.get(key) ?? emptySessionRun();
    webSessionRuns.set(key, { ...emptySessionRun(), runId: previous.runId + 1 });
    return;
  }
  const db = await getDb();
  await db.runAsync(RESET_SESSION_RUN_SQL, [profileId, sessionId]);
}

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
        const now = Date.now();
        await scrubStoredMetadata(db, now);
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
  playbackControls: new Map<string, ProfilePlaybackControlsRecord>(),
  sessionUsage: new Map<string, ProfileSessionUsageRecord>(),
  managedContentPolicies: new Map<string, ManagedContentPolicy>(),
  managedApprovedVideos: new Map<string, ManagedApprovedVideo>(),
  managedApprovedSources: new Map<string, ManagedApprovedSource>(),
  managedApprovalRequests: new Map<string, ManagedApprovalRequest>(),
  saved: new Map<string, Video & { savedAt: number }>(),
  resume: new Map<string, ResumeRow>(),
  queues: new Map<string, VideoQueue>(),
  drafts: new Map<string, SessionDraft>(),
  channels: new Map<string, FollowedChannel>(),
  todaySnapshots: new Map<string, TodaySnapshot>(),
  sourceRules: new Map<string, TodaySourceRule>(),
};

function profileValues<T>(store: Map<string, T>, profileId: string): T[] {
  const prefix = `${profileId}:`;
  return Array.from(store.entries()).filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
}

function clearProfileMap<T>(store: Map<string, T>, profileId: string): void {
  const prefix = `${profileId}:`;
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}

let seededPreview = false;
function seedWebPreview(): void {
  if (!PREVIEW_LIBRARY_ENABLED || seededPreview || webStore.channels.size || webStore.saved.size) return;
  seededPreview = true;
  const now = Date.now() - 60_000; // Predates the initial screen clock; never future-dated metadata.
  const profileId = DEFAULT_OWNER_PROFILE_ID;
  const { channels, videos } = makePreviewLibrary(now);
  for (const channel of channels) webStore.channels.set(profileEntityKey(profileId, channel.id), channel);
  channels.forEach((channel, index) => {
    webStore.sourceRules.set(profileEntityKey(profileId, channel.id), { ...defaultTodaySourceRule(profileId, channel.id), favorite: index < 2, mutedUntil: index >= 8 ? LIBRARY_ONLY_UNTIL : null });
  });
  const saved = videos.filter((_, index) => index % 3 === 2).slice(0, 8);
  saved.forEach((video, index) => webStore.saved.set(profileEntityKey(profileId, video.id), { ...video, savedAt: now - index * 3600000 }));
  const session: VideoQueue = { id: "preview-slow-sunday", name: "A slow Sunday", targetMinutes: 45, orderedVideoIds: [saved[0].id, saved[1].id, saved[3].id], currentIndex: 0, updatedAt: now };
  webStore.queues.set(profileEntityKey(profileId, session.id), session);
  const resume = saved[2];
  webStore.resume.set(profileEntityKey(profileId, resume.id), { ...resume, videoId: resume.id, timestampSeconds: 428, sessionId: null, updatedAt: now });
  const period = getTodayPeriod(Date.now());
  const today = [...videos.filter((_, index) => index % 3 === 0 && index < 24), ...videos.filter((_, index) => index % 3 === 1 && index < 12)];
  const snapshot: TodaySnapshot = { profileId, periodKey: period.key, createdAt: now, cacheFetchedAt: now, freshness: "fresh", items: today.map((video, position) => ({ ...video, fetchedAt: now, sourceId: video.channelId, sourceTitle: video.channelTitle, isLivestream: false, isUpcomingPremiere: false, profileId, periodKey: period.key, position, disposition: "pending", dispositionAt: null, snoozedUntil: null })) };
  webStore.todaySnapshots.set(profileEntityKey(profileId, period.key), snapshot);
}

/** Initializes migrations eagerly for device-level smoke tests. */
export async function initializeDatabase(): Promise<void> {
  if (Platform.OS !== "web") await getDb();
  else seedWebPreview();
}

/** Reads non-sensitive database metadata without changing the schema. */
export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const expectedTables = ["followed_channels", "managed_allowances", "managed_approval_requests", "managed_approved_sources", "managed_approved_videos", "managed_content_policies", "profile_playback_controls", "profile_playback_limits", "profile_playback_usage", "profile_session_usage", "profiles", "queues", "session_drafts", "resume_positions", "saved_videos", "source_rules", "today_snapshot_items", "today_snapshots", "watch_later"];
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
      webStore.managedContentPolicies.set(profile.id, { profileId: profile.id, mode: "selectedVideos", updatedAt: profile.updatedAt });
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
      await db.runAsync("INSERT INTO profile_playback_limits (profileId,dailyLimitMinutes,pendingDailyLimitMinutes,pendingActivatesAt,updatedAt,commitment) VALUES (?,?,?,?,?,?)", [profile.id, allowance.mode === "dailyLimit" ? allowance.dailyLimitMinutes : null, null, null, allowance.updatedAt]);
      await db.runAsync("INSERT INTO profile_playback_usage (profileId,dayKey,dayStartedAt,lastSeenAt,timezoneOffsetMinutes,consumedSeconds,warnedFive,warnedOne,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)", [profile.id, allowance.dayKey, allowance.dayStartedAt, allowance.lastSeenAt, allowance.timezoneOffsetMinutes, allowance.consumedSeconds, allowance.warnedFive, allowance.warnedOne, allowance.updatedAt]);
      await db.runAsync("INSERT INTO managed_content_policies (profileId,mode,updatedAt) VALUES (?,?,?)", [profile.id, "selectedVideos", profile.updatedAt]);
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
    clearProfileMap(webSessionRuns, profileId);
    webStore.drafts.delete(profileId);
    clearProfileMap(webStore.channels, profileId);
    clearProfileMap(webStore.todaySnapshots, profileId);
    clearProfileMap(webStore.sourceRules, profileId);
    webStore.allowances.delete(profileId);
    webStore.playbackLimits.delete(profileId);
    webStore.playbackUsage.delete(profileId);
    webStore.playbackControls.delete(profileId);
    webStore.sessionUsage.delete(profileId);
    webStore.managedContentPolicies.delete(profileId);
    clearProfileMap(webStore.managedApprovedVideos, profileId);
    clearProfileMap(webStore.managedApprovedSources, profileId);
    clearProfileMap(webStore.managedApprovalRequests, profileId);
    webStore.profiles.delete(profileId);
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const profile = await db.getFirstAsync<Pick<Profile, "role">>("SELECT role FROM profiles WHERE id = ?", [profileId]);
    if (!profile || profile.role === "owner") throw new Error("Only Standard or Managed profiles can be deleted.");
    for (const table of ["saved_videos", "resume_positions", "queues", "session_drafts", "watch_later", "followed_channels", "today_snapshot_items", "today_snapshots", "source_rules", "managed_allowances", "profile_playback_limits", "profile_playback_usage", "profile_playback_controls", "profile_session_usage", "managed_approval_requests", "managed_approved_videos", "managed_approved_sources", "managed_content_policies"] as const) {
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
  const row = await db.getFirstAsync<Omit<ProfilePlaybackLimitRecord, "commitment"> & { commitment: number }>("SELECT * FROM profile_playback_limits WHERE profileId = ?", [profileId]);
  return row ? { ...row, commitment: row.commitment !== 0 } : null;
}

export async function upsertProfilePlaybackLimit(record: ProfilePlaybackLimitRecord): Promise<void> {
  if (Platform.OS === "web") { webStore.playbackLimits.set(record.profileId, { ...record }); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO profile_playback_limits (profileId,dailyLimitMinutes,pendingDailyLimitMinutes,pendingActivatesAt,updatedAt,commitment) VALUES (?,?,?,?,?,?)
     ON CONFLICT(profileId) DO UPDATE SET dailyLimitMinutes=excluded.dailyLimitMinutes,pendingDailyLimitMinutes=excluded.pendingDailyLimitMinutes,pendingActivatesAt=excluded.pendingActivatesAt,updatedAt=excluded.updatedAt,commitment=excluded.commitment`,
    [record.profileId, record.dailyLimitMinutes, record.pendingDailyLimitMinutes, record.pendingActivatesAt, record.updatedAt, record.commitment === false ? 0 : 1],
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

export async function readProfilePlaybackControls(profileId: string): Promise<ProfilePlaybackControlsRecord | null> {
  if (Platform.OS === "web") return webStore.playbackControls.get(profileId) ?? null;
  const db = await getDb();
  return (await db.getFirstAsync<ProfilePlaybackControlsRecord>("SELECT * FROM profile_playback_controls WHERE profileId = ?", [profileId])) ?? null;
}

export async function upsertProfilePlaybackControls(record: ProfilePlaybackControlsRecord): Promise<void> {
  if (Platform.OS === "web") { webStore.playbackControls.set(record.profileId, { ...record }); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO profile_playback_controls (profileId,allowedStartMinute,allowedEndMinute,quietStartMinute,quietEndMinute,sessionLimitMinutes,sessionBreakMinutes,pausedUntil,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId) DO UPDATE SET allowedStartMinute=excluded.allowedStartMinute,allowedEndMinute=excluded.allowedEndMinute,quietStartMinute=excluded.quietStartMinute,quietEndMinute=excluded.quietEndMinute,sessionLimitMinutes=excluded.sessionLimitMinutes,sessionBreakMinutes=excluded.sessionBreakMinutes,pausedUntil=excluded.pausedUntil,updatedAt=excluded.updatedAt`,
    [record.profileId, record.allowedStartMinute, record.allowedEndMinute, record.quietStartMinute, record.quietEndMinute, record.sessionLimitMinutes, record.sessionBreakMinutes, record.pausedUntil, record.updatedAt],
  );
}

export async function readProfileSessionUsage(profileId: string): Promise<ProfileSessionUsageRecord | null> {
  if (Platform.OS === "web") return webStore.sessionUsage.get(profileId) ?? null;
  const db = await getDb();
  return (await db.getFirstAsync<ProfileSessionUsageRecord>("SELECT * FROM profile_session_usage WHERE profileId = ?", [profileId])) ?? null;
}

export async function upsertProfileSessionUsage(record: ProfileSessionUsageRecord): Promise<void> {
  if (Platform.OS === "web") { webStore.sessionUsage.set(record.profileId, { ...record }); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO profile_session_usage (profileId,lastPlaybackAt,consumedSeconds,lockedUntil,updatedAt) VALUES (?,?,?,?,?)
     ON CONFLICT(profileId) DO UPDATE SET lastPlaybackAt=excluded.lastPlaybackAt,consumedSeconds=excluded.consumedSeconds,lockedUntil=excluded.lockedUntil,updatedAt=excluded.updatedAt`,
    [record.profileId, record.lastPlaybackAt, record.consumedSeconds, record.lockedUntil, record.updatedAt],
  );
}

export async function readManagedContentPolicy(profileId: string): Promise<ManagedContentPolicy | null> {
  if (Platform.OS === "web") return webStore.managedContentPolicies.get(profileId) ?? null;
  const db = await getDb();
  return (await db.getFirstAsync<ManagedContentPolicy>("SELECT * FROM managed_content_policies WHERE profileId = ?", [profileId])) ?? null;
}

export async function upsertManagedContentPolicy(profileId: string, mode: ManagedContentMode, updatedAt: number): Promise<void> {
  const record: ManagedContentPolicy = { profileId, mode, updatedAt };
  if (Platform.OS === "web") { webStore.managedContentPolicies.set(profileId, record); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO managed_content_policies (profileId,mode,updatedAt) VALUES (?,?,?)
     ON CONFLICT(profileId) DO UPDATE SET mode=excluded.mode,updatedAt=excluded.updatedAt`,
    [profileId, mode, updatedAt],
  );
}

export async function listManagedApprovedVideos(profileId: string): Promise<ManagedApprovedVideo[]> {
  if (Platform.OS === "web") return profileValues(webStore.managedApprovedVideos, profileId).sort((a, b) => b.approvedAt - a.approvedAt);
  const db = await getDb();
  const rows = await db.getAllAsync<Omit<ManagedApprovedVideo, "id" | "channelId" | "channelTitle" | "madeForKids"> & { videoId: string; sourceId: string; sourceTitle: string; madeForKids: number | null }>("SELECT * FROM managed_approved_videos WHERE profileId = ? ORDER BY approvedAt DESC", [profileId]);
  return rows.map((row) => ({ ...row, id: row.videoId, channelId: row.sourceId, channelTitle: row.sourceTitle, madeForKids: row.madeForKids === null ? null : row.madeForKids === 1 }));
}

export async function upsertManagedApprovedVideo(record: ManagedApprovedVideo): Promise<void> {
  assertLongFormVideo(record);
  if (Platform.OS === "web") { webStore.managedApprovedVideos.set(profileEntityKey(record.profileId, record.id), { ...record }); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO managed_approved_videos (profileId,videoId,title,sourceId,sourceTitle,thumbnailUrl,publishedAt,durationSeconds,description,madeForKids,fetchedAt,approvedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId,videoId) DO UPDATE SET title=excluded.title,sourceId=excluded.sourceId,sourceTitle=excluded.sourceTitle,thumbnailUrl=excluded.thumbnailUrl,publishedAt=excluded.publishedAt,durationSeconds=excluded.durationSeconds,description=excluded.description,madeForKids=excluded.madeForKids,fetchedAt=excluded.fetchedAt,approvedAt=excluded.approvedAt`,
    [record.profileId, record.id, record.title, record.channelId, record.channelTitle, record.thumbnailUrl, record.publishedAt, record.durationSeconds, record.description ?? "", record.madeForKids === null || record.madeForKids === undefined ? null : record.madeForKids ? 1 : 0, record.fetchedAt ?? null, record.approvedAt],
  );
}

export async function deleteManagedApprovedVideo(profileId: string, videoId: string): Promise<void> {
  if (Platform.OS === "web") { webStore.managedApprovedVideos.delete(profileEntityKey(profileId, videoId)); return; }
  const db = await getDb();
  await db.runAsync("DELETE FROM managed_approved_videos WHERE profileId = ? AND videoId = ?", [profileId, videoId]);
}

export async function listManagedApprovedSources(profileId: string): Promise<ManagedApprovedSource[]> {
  if (Platform.OS === "web") return profileValues(webStore.managedApprovedSources, profileId).sort((a, b) => b.approvedAt - a.approvedAt);
  const db = await getDb();
  const rows = await db.getAllAsync<Omit<ManagedApprovedSource, "id"> & { sourceId: string }>("SELECT * FROM managed_approved_sources WHERE profileId = ? ORDER BY approvedAt DESC", [profileId]);
  return rows.map((row) => ({ ...row, id: row.sourceId }));
}

export async function upsertManagedApprovedSource(record: ManagedApprovedSource): Promise<void> {
  if (Platform.OS === "web") { webStore.managedApprovedSources.set(profileEntityKey(record.profileId, record.id), { ...record }); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO managed_approved_sources (profileId,sourceId,title,description,thumbnailUrl,followedAt,source,fetchedAt,approvedAt)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId,sourceId) DO UPDATE SET title=excluded.title,description=excluded.description,thumbnailUrl=excluded.thumbnailUrl,followedAt=excluded.followedAt,source=excluded.source,fetchedAt=excluded.fetchedAt,approvedAt=excluded.approvedAt`,
    [record.profileId, record.id, record.title, record.description ?? "", record.thumbnailUrl, record.followedAt, record.source, record.fetchedAt ?? null, record.approvedAt],
  );
}

export async function deleteManagedApprovedSource(profileId: string, sourceId: string): Promise<void> {
  if (Platform.OS === "web") { webStore.managedApprovedSources.delete(profileEntityKey(profileId, sourceId)); return; }
  const db = await getDb();
  await db.runAsync("DELETE FROM managed_approved_sources WHERE profileId = ? AND sourceId = ?", [profileId, sourceId]);
}

export async function listManagedApprovalRequests(profileId: string): Promise<ManagedApprovalRequest[]> {
  if (Platform.OS === "web") return profileValues(webStore.managedApprovalRequests, profileId).sort((a, b) => b.requestedAt - a.requestedAt);
  const db = await getDb();
  return db.getAllAsync<ManagedApprovalRequest>("SELECT * FROM managed_approval_requests WHERE profileId = ? ORDER BY requestedAt DESC", [profileId]);
}

export async function upsertManagedApprovalRequest(request: ManagedApprovalRequest): Promise<void> {
  if (Platform.OS === "web") { webStore.managedApprovalRequests.set(profileEntityKey(request.profileId, `${request.kind}:${request.targetId}`), { ...request }); return; }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO managed_approval_requests (profileId,kind,targetId,sourceId,title,sourceTitle,thumbnailUrl,publishedAt,durationSeconds,description,fetchedAt,requestedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId,kind,targetId) DO UPDATE SET sourceId=excluded.sourceId,title=excluded.title,sourceTitle=excluded.sourceTitle,thumbnailUrl=excluded.thumbnailUrl,publishedAt=excluded.publishedAt,durationSeconds=excluded.durationSeconds,description=excluded.description,fetchedAt=excluded.fetchedAt,requestedAt=excluded.requestedAt`,
    [request.profileId, request.kind, request.targetId, request.sourceId, request.title, request.sourceTitle, request.thumbnailUrl, request.publishedAt, request.durationSeconds, request.description, request.fetchedAt, request.requestedAt],
  );
}

export async function deleteManagedApprovalRequest(profileId: string, kind: ManagedApprovalRequest["kind"], targetId: string): Promise<void> {
  if (Platform.OS === "web") { webStore.managedApprovalRequests.delete(profileEntityKey(profileId, `${kind}:${targetId}`)); return; }
  const db = await getDb();
  await db.runAsync("DELETE FROM managed_approval_requests WHERE profileId = ? AND kind = ? AND targetId = ?", [profileId, kind, targetId]);
}

export async function clearManagedApprovalRequests(profileId: string): Promise<void> {
  if (Platform.OS === "web") { clearProfileMap(webStore.managedApprovalRequests, profileId); return; }
  const db = await getDb();
  await db.runAsync("DELETE FROM managed_approval_requests WHERE profileId = ?", [profileId]);
}

export async function listSavedVideos(profileId: string): Promise<Video[]> {
  await expireLocalMetadata();
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
  video = expireVideo(video, Date.now());
  assertLongFormVideo(video);
  await writeSavedVideo(profileId, video, Date.now());
}

async function writeSavedVideo(profileId: string, video: Video, savedAt: number): Promise<void> {
  video = expireVideo(video, Date.now());
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, video.id);
    if (!webStore.saved.has(key)) webStore.saved.set(key, { ...video, savedAt });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    SAVE_VIDEO_SQL,
    [profileId, video.id, video.title, video.channelId, video.channelTitle, video.thumbnailUrl, video.publishedAt, video.durationSeconds, video.description ?? null, savedAt, video.fetchedAt ?? null],
  );
}

/** Returns an Undo receipt for the actual removed row; it cannot restore arbitrary new content. */
export async function unsaveVideo(profileId: string, videoId: string): Promise<() => Promise<void>> {
  let removed: (Video & { savedAt: number }) | null;
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, videoId);
    removed = webStore.saved.get(key) ?? null;
    webStore.saved.delete(key);
  } else {
    const db = await getDb();
    removed = await db.getFirstAsync<Video & { savedAt: number }>("SELECT * FROM saved_videos WHERE profileId = ? AND id = ?", [profileId, videoId]);
    await db.runAsync(UNSAVE_VIDEO_SQL, [profileId, videoId]);
  }
  return async () => {
    // Legacy links may be restored for removal undo; playback still requires current long-form evidence.
    if (removed) await writeSavedVideo(profileId, removed, removed.savedAt);
  };
}

export type ResumeRow = ResumePosition & {
  fetchedAt?: number | null;
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
};

export async function listResume(profileId: string): Promise<ResumeRow[]> {
  await expireLocalMetadata();
  if (Platform.OS === "web") return profileValues(webStore.resume, profileId).sort((a, b) => b.updatedAt - a.updatedAt);
  const db = await getDb();
  return db.getAllAsync<ResumeRow>("SELECT * FROM resume_positions WHERE profileId = ? ORDER BY updatedAt DESC LIMIT 24", [profileId]);
}

export async function getResume(profileId: string, videoId: string): Promise<ResumeRow | null> {
  await expireLocalMetadata();
  if (Platform.OS === "web") return webStore.resume.get(profileEntityKey(profileId, videoId)) ?? null;
  const db = await getDb();
  return (await db.getFirstAsync<ResumeRow>("SELECT * FROM resume_positions WHERE profileId = ? AND videoId = ?", [profileId, videoId])) ?? null;
}

export async function upsertResume(profileId: string, video: Video, timestampSeconds: number, sessionId: string | null = null): Promise<void> {
  if (!isLongFormVideo(video)) return;
  video = expireVideo(video, Date.now());
  const row: ResumeRow = {
    sessionId,
    videoId: video.id,
    fetchedAt: video.fetchedAt ?? null,
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
    `INSERT INTO resume_positions (profileId,videoId,timestampSeconds,updatedAt,title,channelTitle,thumbnailUrl,durationSeconds,fetchedAt,sessionId)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId,videoId) DO UPDATE SET timestampSeconds=excluded.timestampSeconds,updatedAt=excluded.updatedAt,title=excluded.title,channelTitle=excluded.channelTitle,thumbnailUrl=excluded.thumbnailUrl,durationSeconds=excluded.durationSeconds,fetchedAt=excluded.fetchedAt,sessionId=excluded.sessionId`,
    [profileId, row.videoId, row.timestampSeconds, row.updatedAt, row.title ?? null, row.channelTitle ?? null, row.thumbnailUrl ?? null, row.durationSeconds ?? null, row.fetchedAt ?? null, row.sessionId ?? null],
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
  if (Platform.OS === "web") return profileValues(webStore.queues, profileId).sort((a, b) => b.updatedAt - a.updatedAt).map((queue) => ({ ...queue, orderedVideoIds: [...queue.orderedVideoIds] }));
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; orderedVideoIds: string; updatedAt: number; currentIndex: number; targetMinutes: number | null }>(
    "SELECT id,name,orderedVideoIds,updatedAt,currentIndex,targetMinutes FROM queues WHERE profileId = ? ORDER BY updatedAt DESC",
    [profileId],
  );
  return rows.map((row) => { const orderedVideoIds = safeParseIds(row.orderedVideoIds); return { ...row, orderedVideoIds, currentIndex: Math.max(0, Math.min(row.currentIndex, orderedVideoIds.length)) }; });
}

export async function upsertQueue(profileId: string, queue: VideoQueue): Promise<void> {
  queue = { ...queue, targetMinutes: normalizeSessionTarget(queue.targetMinutes) };
  if (Platform.OS === "web") {
    webStore.queues.set(profileEntityKey(profileId, queue.id), { ...queue, orderedVideoIds: [...queue.orderedVideoIds] });
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO queues (profileId,id,name,orderedVideoIds,updatedAt,currentIndex,targetMinutes) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(profileId,id) DO UPDATE SET name=excluded.name,orderedVideoIds=excluded.orderedVideoIds,updatedAt=excluded.updatedAt,currentIndex=excluded.currentIndex,targetMinutes=excluded.targetMinutes`,
    [profileId, queue.id, queue.name, JSON.stringify(queue.orderedVideoIds), queue.updatedAt, queue.currentIndex, queue.targetMinutes ?? null],
  );
}

/** Advances only the cursor; a concurrently edited tray cannot be overwritten by playback. */
export async function setQueuePosition(profileId: string, id: string, expectedVideoId: string, atIndex: number, nextIndex: number): Promise<boolean> {
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, id);
    const queue = webStore.queues.get(key);
    if (!queue || queue.orderedVideoIds[atIndex] !== expectedVideoId || nextIndex < 0 || nextIndex > queue.orderedVideoIds.length) return false;
    webStore.queues.set(key, { ...queue, currentIndex: nextIndex, updatedAt: Date.now() });
    return true;
  }
  const db = await getDb();
  const queue = await db.getFirstAsync<{ orderedVideoIds: string }>("SELECT orderedVideoIds FROM queues WHERE profileId=? AND id=?", [profileId, id]);
  const ids = safeParseIds(queue?.orderedVideoIds ?? "");
  if (ids[atIndex] !== expectedVideoId || nextIndex < 0 || nextIndex > ids.length) return false;
  const result = await db.runAsync("UPDATE queues SET currentIndex=?,updatedAt=? WHERE profileId=? AND id=? AND orderedVideoIds=?", [nextIndex, Date.now(), profileId, id, queue?.orderedVideoIds ?? ""]);
  return result.changes === 1;
}

/** Keeps one unfinished composition per profile; the web preview is session-only. */
export async function readSessionDraft(profileId: string): Promise<SessionDraft | null> {
  if (Platform.OS === "web") { const draft = webStore.drafts.get(profileId); return draft ? { ...draft, orderedVideoIds: [...draft.orderedVideoIds] } : null; }
  const db = await getDb();
  const row = await db.getFirstAsync<{ name: string; orderedVideoIds: string; updatedAt: number; targetMinutes: number | null }>("SELECT name,orderedVideoIds,updatedAt,targetMinutes FROM session_drafts WHERE profileId=?", [profileId]);
  return row ? { name: row.name, orderedVideoIds: safeParseIds(row.orderedVideoIds), updatedAt: row.updatedAt, targetMinutes: normalizeSessionTarget(row.targetMinutes) } : null;
}

export async function writeSessionDraft(profileId: string, draft: SessionDraft): Promise<void> {
  draft = { ...draft, targetMinutes: normalizeSessionTarget(draft.targetMinutes) };
  if (Platform.OS === "web") { webStore.drafts.set(profileId, { ...draft, orderedVideoIds: [...draft.orderedVideoIds] }); return; }
  const db = await getDb();
  await db.runAsync("INSERT INTO session_drafts (profileId,name,orderedVideoIds,updatedAt,targetMinutes) VALUES (?,?,?,?,?) ON CONFLICT(profileId) DO UPDATE SET name=excluded.name,orderedVideoIds=excluded.orderedVideoIds,updatedAt=excluded.updatedAt,targetMinutes=excluded.targetMinutes", [profileId, draft.name, JSON.stringify(draft.orderedVideoIds), draft.updatedAt, draft.targetMinutes ?? null]);
}

export async function deleteSessionDraft(profileId: string): Promise<void> {
  if (Platform.OS === "web") { webStore.drafts.delete(profileId); return; }
  const db = await getDb();
  await db.runAsync("DELETE FROM session_drafts WHERE profileId=?", [profileId]);
}

export async function deleteQueue(profileId: string, id: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore.queues.delete(profileEntityKey(profileId, id));
    webSessionRuns.delete(profileEntityKey(profileId, id));
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM queues WHERE profileId = ? AND id = ?", [profileId, id]);
}

export async function listFollowedChannels(profileId: string): Promise<FollowedChannel[]> {
  await expireLocalMetadata();
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
  channel = expireChannel(channel, Date.now());
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, channel.id);
    const existing = webStore.channels.get(key);
    if (!existing) {
      const participating = profileValues(webStore.channels, profileId).filter((source) => (webStore.sourceRules.get(profileEntityKey(profileId, source.id))?.mutedUntil ?? 0) <= Date.now());
      if (participating.length >= PRODUCT_LIMITS.sourceFeedMaxSources) webStore.sourceRules.set(key, { ...defaultTodaySourceRule(profileId, channel.id), mutedUntil: LIBRARY_ONLY_UNTIL });
    }
    webStore.channels.set(key, existing ? { ...channel, followedAt: existing.followedAt, source: existing.source } : { ...channel });
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
  const existing = await db.getFirstAsync("SELECT id FROM followed_channels WHERE profileId=? AND id=?", [profileId, channel.id]);
  await db.runAsync(
    `INSERT INTO followed_channels (profileId,id,title,description,thumbnailUrl,followedAt,source,fetchedAt) VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(profileId,id) DO UPDATE SET title=excluded.title,description=excluded.description,thumbnailUrl=excluded.thumbnailUrl,fetchedAt=excluded.fetchedAt`,
    [profileId, channel.id, channel.title, channel.description ?? null, channel.thumbnailUrl, channel.followedAt, channel.source, channel.fetchedAt ?? null],
  );
  if (!existing) await keepOverflowSourceInLibrary(db, profileId, channel.id);
  });
}

async function keepOverflowSourceInLibrary(db: SQLite.SQLiteDatabase, profileId: string, sourceId: string): Promise<void> {
  await db.runAsync(LIBRARY_OVERFLOW_RULE_SQL, [profileId, sourceId, LIBRARY_ONLY_UNTIL, Date.now(), profileId, Date.now(), PRODUCT_LIMITS.sourceFeedMaxSources]);
}

export async function followChannels(profileId: string, channels: FollowedChannel[]): Promise<void> {
  channels = channels.map((channel) => expireChannel(channel, Date.now()));
  if (Platform.OS === "web") {
    for (const channel of channels) await followChannel(profileId, channel);
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const channel of channels) {
      const existing = await db.getFirstAsync("SELECT id FROM followed_channels WHERE profileId=? AND id=?", [profileId, channel.id]);
      await db.runAsync(
        `INSERT INTO followed_channels (profileId,id,title,description,thumbnailUrl,followedAt,source,fetchedAt) VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(profileId,id) DO UPDATE SET title=excluded.title,description=excluded.description,thumbnailUrl=excluded.thumbnailUrl,fetchedAt=excluded.fetchedAt`,
        [profileId, channel.id, channel.title, channel.description ?? null, channel.thumbnailUrl, channel.followedAt, channel.source, channel.fetchedAt ?? null],
      );
      if (!existing) await keepOverflowSourceInLibrary(db, profileId, channel.id);
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

let retentionWork: Promise<void> | null = null;

async function scrubStoredMetadata(db: SQLite.SQLiteDatabase, now: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const statement of [EXPIRE_TODAY_METADATA_SQL, ...EXPIRE_LIBRARY_METADATA_SQL]) {
      await db.runAsync(statement, [now - METADATA_MAX_AGE_MS, now]);
    }
  });
}

/** Coalesces cleanup across parallel library reads, preserving every personal action. */
export async function expireLocalMetadata(now: number = Date.now()): Promise<void> {
  if (retentionWork) return retentionWork;
  retentionWork = scrubLocalMetadata(now).finally(() => { retentionWork = null; });
  return retentionWork;
}

/** Compatibility boundary for existing Today callers. */
export const expireLocalTodayMetadata = expireLocalMetadata;

async function scrubLocalMetadata(now: number): Promise<void> {
  if (Platform.OS === "web") {
    for (const [key, value] of webStore.saved) webStore.saved.set(key, expireVideo(value, now));
    for (const [key, value] of webStore.resume) webStore.resume.set(key, expireResume(value, now));
    for (const [key, value] of webStore.channels) webStore.channels.set(key, expireChannel(value, now));
    for (const [key, snapshot] of webStore.todaySnapshots) {
      webStore.todaySnapshots.set(key, { ...snapshot, items: snapshot.items.map((item) => expireTodayItem(item, now)) });
    }
    return;
  }
  const db = await getDb();
  await scrubStoredMetadata(db, now);
}

/** Refresh existing library records only; never follows, saves or resets progress. */
export async function refreshStoredLibraryMetadata(profileId: string, videos: readonly Video[], channel?: FollowedChannel): Promise<void> {
  const now = Date.now();
  const fresh = videos.filter((video) => isMetadataCurrent(video.fetchedAt, now)).slice(0, 20);
  const freshChannel = channel && isMetadataCurrent(channel.fetchedAt, now) ? channel : undefined;
  if (Platform.OS === "web") {
    for (const video of fresh) {
      const key = profileEntityKey(profileId, video.id);
      for (const [snapshotKey, snapshot] of webStore.todaySnapshots) {
        if (snapshot.profileId === profileId) webStore.todaySnapshots.set(snapshotKey, { ...snapshot, items: snapshot.items.map((item) => item.id === video.id && item.fetchedAt <= (video.fetchedAt ?? 0) ? { ...item, ...video, sourceId: video.channelId, sourceTitle: video.channelTitle, fetchedAt: video.fetchedAt ?? 0 } : item) });
      }
      const saved = webStore.saved.get(key);
      if (saved && (saved.fetchedAt ?? 0) <= (video.fetchedAt ?? 0)) webStore.saved.set(key, { ...saved, ...video, savedAt: saved.savedAt });
      const resume = webStore.resume.get(key);
      if (resume && (resume.fetchedAt ?? 0) <= (video.fetchedAt ?? 0)) webStore.resume.set(key, { ...resume, title: video.title, channelTitle: video.channelTitle, thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds, fetchedAt: video.fetchedAt });
    }
    if (freshChannel) {
      const key = profileEntityKey(profileId, freshChannel.id);
      const existing = webStore.channels.get(key);
      if (existing && (existing.fetchedAt ?? 0) <= (freshChannel.fetchedAt ?? 0)) webStore.channels.set(key, { ...existing, title: freshChannel.title, description: freshChannel.description, thumbnailUrl: freshChannel.thumbnailUrl, fetchedAt: freshChannel.fetchedAt });
    }
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const video of fresh) {
      for (const table of ["saved_videos", "watch_later"]) {
        await db.runAsync(`UPDATE ${table} SET title=?,channelTitle=?,thumbnailUrl=?,publishedAt=?,durationSeconds=?,description=?,fetchedAt=? WHERE profileId=? AND id=? AND (fetchedAt IS NULL OR fetchedAt<=?)`, [video.title,video.channelTitle,video.thumbnailUrl,video.publishedAt,video.durationSeconds,video.description ?? "",video.fetchedAt ?? null,profileId,video.id,video.fetchedAt ?? 0]);
      }
      await db.runAsync("UPDATE today_snapshot_items SET title=?,sourceTitle=?,thumbnailUrl=?,publishedAt=?,durationSeconds=?,description=?,fetchedAt=? WHERE profileId=? AND mediaId=? AND fetchedAt<=?", [video.title,video.channelTitle,video.thumbnailUrl,video.publishedAt,video.durationSeconds,video.description ?? "",video.fetchedAt ?? 0,profileId,video.id,video.fetchedAt ?? 0]);
      await db.runAsync("UPDATE resume_positions SET title=?,channelTitle=?,thumbnailUrl=?,durationSeconds=?,fetchedAt=? WHERE profileId=? AND videoId=? AND (fetchedAt IS NULL OR fetchedAt<=?)", [video.title,video.channelTitle,video.thumbnailUrl,video.durationSeconds,video.fetchedAt ?? null,profileId,video.id,video.fetchedAt ?? 0]);
    }
    if (freshChannel) await db.runAsync("UPDATE followed_channels SET title=?,description=?,thumbnailUrl=?,fetchedAt=? WHERE profileId=? AND id=? AND (fetchedAt IS NULL OR fetchedAt<=?)", [freshChannel.title,freshChannel.description ?? "",freshChannel.thumbnailUrl,freshChannel.fetchedAt ?? null,profileId,freshChannel.id,freshChannel.fetchedAt ?? 0]);
  });
}

type TodaySnapshotRow = Omit<TodaySnapshot, "items">;
type TodayItemRow = Omit<TodaySnapshotItem, "id" | "channelId" | "channelTitle" | "isLivestream" | "isUpcomingPremiere" | "madeForKids"> & {
  mediaId: string;
  madeForKids: number | null;
  isLivestream: number;
  isUpcomingPremiere: number;
};

export async function readTodaySnapshot(profileId: string, periodKey: string): Promise<TodaySnapshot | null> {
  await expireLocalTodayMetadata();
  if (Platform.OS === "web") {
    const snapshot = webStore.todaySnapshots.get(profileEntityKey(profileId, periodKey));
    return snapshot ? { ...snapshot, items: snapshot.items.map((item) => ({ ...item })) } : null;
  }
  const db = await getDb();
  const header = await db.getFirstAsync<TodaySnapshotRow>("SELECT profileId,periodKey,createdAt,cacheFetchedAt,freshness FROM today_snapshots WHERE profileId = ? AND periodKey = ?", [profileId, periodKey]);
  if (!header) return null;
  const rows = await db.getAllAsync<TodayItemRow>("SELECT * FROM today_snapshot_items WHERE profileId = ? AND periodKey = ? ORDER BY position ASC", [profileId, periodKey]);
  return { ...header, items: rows.map((row) => expireTodayItem(mapTodayItemRow(row), Date.now())) };
}

/** Commits an immutable Today membership and order in one local transaction. */
export async function finalizeTodaySnapshot(snapshot: TodaySnapshot): Promise<TodaySnapshot> {
  snapshot = { ...snapshot, items: snapshot.items.map((item) => expireTodayItem(item, Date.now())) };
  const existing = await readTodaySnapshot(snapshot.profileId, snapshot.periodKey);
  if (existing) return existing;
  if (snapshot.items.length > 12 || snapshot.items.some((item, index) => item.position !== index || item.profileId !== snapshot.profileId || item.periodKey !== snapshot.periodKey)) {
    throw new Error("Invalid Today snapshot membership.");
  }
  if (Platform.OS === "web") {
    webStore.todaySnapshots.set(profileEntityKey(snapshot.profileId, snapshot.periodKey), { ...snapshot, items: snapshot.items.map((item) => ({ ...item })) });
    return snapshot;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{ periodKey: string }>("SELECT periodKey FROM today_snapshots WHERE profileId = ? AND periodKey = ?", [snapshot.profileId, snapshot.periodKey]);
    if (current) return;
    await db.runAsync("INSERT INTO today_snapshots (profileId,periodKey,createdAt,cacheFetchedAt,freshness) VALUES (?,?,?,?,?)", [snapshot.profileId, snapshot.periodKey, snapshot.createdAt, snapshot.cacheFetchedAt, snapshot.freshness]);
    for (const item of snapshot.items) {
      await db.runAsync(
        `INSERT INTO today_snapshot_items (profileId,periodKey,mediaId,sourceId,sourceTitle,title,thumbnailUrl,publishedAt,durationSeconds,description,madeForKids,isLivestream,isUpcomingPremiere,fetchedAt,position,disposition,dispositionAt,snoozedUntil)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [item.profileId, item.periodKey, item.id, item.sourceId, item.sourceTitle, item.title, item.thumbnailUrl, item.publishedAt, item.durationSeconds, item.description ?? null, item.madeForKids === null || item.madeForKids === undefined ? null : item.madeForKids ? 1 : 0, item.isLivestream ? 1 : 0, item.isUpcomingPremiere ? 1 : 0, item.fetchedAt, item.position, item.disposition, item.dispositionAt, item.snoozedUntil],
      );
    }
  });
  return (await readTodaySnapshot(snapshot.profileId, snapshot.periodKey)) ?? snapshot;
}

export async function listTodayHistory(profileId: string): Promise<TodaySnapshotItem[]> {
  await expireLocalTodayMetadata();
  if (Platform.OS === "web") return profileValues(webStore.todaySnapshots, profileId).flatMap((snapshot) => snapshot.items.map((item) => ({ ...item })));
  const db = await getDb();
  const rows = await db.getAllAsync<TodayItemRow>("SELECT * FROM today_snapshot_items WHERE profileId = ? ORDER BY periodKey DESC, position ASC", [profileId]);
  return rows.map((row) => expireTodayItem(mapTodayItemRow(row), Date.now()));
}

export async function updateTodayDisposition(profileId: string, periodKey: string, mediaId: string, disposition: TodayDisposition, dispositionAt: number, snoozedUntil: number | null = null, expected?: TodayDisposition): Promise<boolean> {
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, periodKey);
    const snapshot = webStore.todaySnapshots.get(key);
    if (!snapshot) return false;
    const item = snapshot.items.find((candidate) => candidate.id === mediaId);
    if (!item || (expected && item.disposition !== expected)) return false;
    webStore.todaySnapshots.set(key, { ...snapshot, items: snapshot.items.map((candidate) => candidate.id === mediaId ? { ...candidate, disposition, dispositionAt, snoozedUntil } : candidate) });
    return true;
  }
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE today_snapshot_items SET disposition = ?, dispositionAt = ?, snoozedUntil = ? WHERE profileId = ? AND periodKey = ? AND mediaId = ?${expected ? " AND disposition = ?" : ""}`,
    expected ? [disposition, dispositionAt, snoozedUntil, profileId, periodKey, mediaId, expected] : [disposition, dispositionAt, snoozedUntil, profileId, periodKey, mediaId],
  );
  return result.changes === 1;
}

/** Revalidates only existing members; it never changes membership or order. */
export async function refreshTodaySnapshotMetadata(profileId: string, periodKey: string, candidates: readonly CachedTodayCandidate[], unavailableSourceIds: ReadonlySet<string>, freshness: "fresh" | "stale", cacheFetchedAt: number | null): Promise<void> {
  candidates = candidates.filter((item) => isMetadataCurrent(item.fetchedAt, Date.now()));
  const byId = new Map(candidates.map((item) => [item.id, item]));
  if (Platform.OS === "web") {
    const key = profileEntityKey(profileId, periodKey);
    const snapshot = webStore.todaySnapshots.get(key);
    if (!snapshot) return;
    webStore.todaySnapshots.set(key, {
      ...snapshot,
      freshness,
      cacheFetchedAt,
      items: snapshot.items.map((item) => unavailableSourceIds.has(item.sourceId) ? { ...item, disposition: "unavailable", dispositionAt: Date.now() } : byId.has(item.id) ? { ...item, ...byId.get(item.id), profileId, periodKey, position: item.position, disposition: item.disposition, dispositionAt: item.dispositionAt, snoozedUntil: item.snoozedUntil } : item),
    });
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE today_snapshots SET freshness = ?, cacheFetchedAt = ? WHERE profileId = ? AND periodKey = ?", [freshness, cacheFetchedAt, profileId, periodKey]);
    for (const item of candidates) {
      await db.runAsync(
        `UPDATE today_snapshot_items SET sourceTitle=?,title=?,thumbnailUrl=?,publishedAt=?,durationSeconds=?,description=?,madeForKids=?,isLivestream=?,isUpcomingPremiere=?,fetchedAt=? WHERE profileId=? AND periodKey=? AND mediaId=?`,
        [item.sourceTitle, item.title, item.thumbnailUrl, item.publishedAt, item.durationSeconds, item.description ?? null, item.madeForKids === null || item.madeForKids === undefined ? null : item.madeForKids ? 1 : 0, item.isLivestream ? 1 : 0, item.isUpcomingPremiere ? 1 : 0, item.fetchedAt, profileId, periodKey, item.id],
      );
    }
    for (const sourceId of unavailableSourceIds) {
      await db.runAsync("UPDATE today_snapshot_items SET disposition='unavailable', dispositionAt=? WHERE profileId=? AND periodKey=? AND sourceId=? AND disposition IN ('pending','snoozed')", [Date.now(), profileId, periodKey, sourceId]);
    }
  });
}

export async function getLatestTodayVideo(profileId: string, mediaId: string): Promise<Video | null> {
  const history = await listTodayHistory(profileId);
  const item = history.find((candidate) => candidate.id === mediaId && isMetadataCurrent(candidate.fetchedAt, Date.now()));
  return item ? { id: item.id, title: item.title, channelId: item.sourceId, channelTitle: item.sourceTitle, thumbnailUrl: item.thumbnailUrl, publishedAt: item.publishedAt, durationSeconds: item.durationSeconds, description: item.description, madeForKids: item.madeForKids, fetchedAt: item.fetchedAt } : null;
}

export async function listTodaySourceRules(profileId: string): Promise<TodaySourceRule[]> {
  if (Platform.OS === "web") return profileValues(webStore.sourceRules, profileId).map((rule) => ({ ...rule }));
  const db = await getDb();
  const rows = await db.getAllAsync<Omit<TodaySourceRule, "hideLivestreams" | "hideUpcomingPremieres" | "favorite"> & { hideLivestreams: number; hideUpcomingPremieres: number; favorite: number }>("SELECT * FROM source_rules WHERE profileId = ?", [profileId]);
  return rows.map((row) => ({ ...row, favorite: row.favorite === 1, hideLivestreams: row.hideLivestreams === 1, hideUpcomingPremieres: row.hideUpcomingPremieres === 1 }));
}

export async function upsertTodaySourceRule(rule: TodaySourceRule): Promise<void> {
  if (Platform.OS === "web") {
    const activeOthers = profileValues(webStore.channels, rule.profileId).filter((source) => source.id !== rule.sourceId && (webStore.sourceRules.get(profileEntityKey(rule.profileId, source.id))?.mutedUntil ?? 0) <= Date.now()).length;
    if ((rule.mutedUntil ?? 0) <= Date.now() && activeOthers >= PRODUCT_LIMITS.sourceFeedMaxSources) throw new Error("Today already includes 100 sources. Set another source to Library only first.");
    webStore.sourceRules.set(profileEntityKey(rule.profileId, rule.sourceId), { ...rule }); return;
  }
  const db = await getDb();
  const result = await db.runAsync(
    SAVE_SOURCE_RULE_SQL,
    [rule.profileId, rule.sourceId, rule.minimumDurationSeconds, rule.hideLivestreams ? 1 : 0, rule.hideUpcomingPremieres ? 1 : 0, rule.todayContributionLimit, rule.mutedUntil, rule.updatedAt, rule.favorite ? 1 : 0, rule.mutedUntil ?? 0, Date.now(), rule.profileId, rule.sourceId, Date.now(), PRODUCT_LIMITS.sourceFeedMaxSources],
  );
  if (!result.changes) throw new Error("Today already includes 100 sources. Set another source to Library only first.");
}

function mapTodayItemRow(row: TodayItemRow): TodaySnapshotItem {
  return {
    ...row,
    id: row.mediaId,
    channelId: row.sourceId,
    channelTitle: row.sourceTitle,
    madeForKids: row.madeForKids === null ? null : row.madeForKids === 1,
    isLivestream: row.isLivestream === 1,
    isUpcomingPremiere: row.isUpcomingPremiere === 1,
  };
}

/** Clears only the active profile's local content; profiles and allowance state remain intact. */
export async function clearAllData(profileId: string): Promise<void> {
  if (Platform.OS === "web") {
    clearProfileMap(webStore.saved, profileId);
    clearProfileMap(webStore.resume, profileId);
    clearProfileMap(webStore.queues, profileId);
    clearProfileMap(webSessionRuns, profileId);
    webStore.drafts.delete(profileId);
    clearProfileMap(webStore.channels, profileId);
    clearProfileMap(webStore.todaySnapshots, profileId);
    clearProfileMap(webStore.sourceRules, profileId);
    clearProfileMap(webStore.managedApprovedVideos, profileId);
    clearProfileMap(webStore.managedApprovedSources, profileId);
    clearProfileMap(webStore.managedApprovalRequests, profileId);
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of ["saved_videos", "resume_positions", "queues", "session_drafts", "watch_later", "followed_channels", "today_snapshot_items", "today_snapshots", "source_rules", "managed_approval_requests", "managed_approved_videos", "managed_approved_sources"] as const) {
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
    webStore.playbackControls.clear();
    webStore.sessionUsage.clear();
    webStore.managedContentPolicies.clear();
    webStore.managedApprovedVideos.clear();
    webStore.managedApprovedSources.clear();
    webStore.managedApprovalRequests.clear();
    webStore.saved.clear();
    webStore.resume.clear();
    webStore.queues.clear();
    webSessionRuns.clear();
    webStore.drafts.clear();
    webStore.channels.clear();
    webStore.todaySnapshots.clear();
    webStore.sourceRules.clear();
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of ["saved_videos", "resume_positions", "queues", "session_drafts", "watch_later", "followed_channels", "today_snapshot_items", "today_snapshots", "source_rules", "managed_allowances", "profile_playback_limits", "profile_playback_usage", "profile_playback_controls", "profile_session_usage", "managed_approval_requests", "managed_approved_videos", "managed_approved_sources", "managed_content_policies"] as const) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    await db.runAsync("DELETE FROM profiles");
    await db.runAsync("INSERT INTO profiles (id,name,role,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?)", [webOwner.id, webOwner.name, webOwner.role, webOwner.sortOrder, webOwner.createdAt, webOwner.updatedAt]);
  });
}

