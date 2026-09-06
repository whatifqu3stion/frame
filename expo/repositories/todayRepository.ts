import {
  finalizeTodaySnapshot,
  getLatestTodayVideo,
  listQueues,
  listResume,
  listSavedVideos,
  listTodayHistory,
  listTodaySourceRules,
  readTodaySnapshot,
  refreshTodaySnapshotMetadata,
  updateTodayDisposition,
} from "@/db/database";
import type { CachedTodayCandidate, TodayDisposition, TodaySnapshot, TodaySnapshotItem, TodaySourceRule } from "@/models/today";
import type { Video } from "@/types";

export type TodayRepository = {
  readSnapshot(profileId: string, periodKey: string): Promise<TodaySnapshot | null>;
  finalizeSnapshot(snapshot: TodaySnapshot): Promise<TodaySnapshot>;
  listHistory(profileId: string): Promise<TodaySnapshotItem[]>;
  listRules(profileId: string): Promise<TodaySourceRule[]>;
  listHandledLibraryIds(profileId: string): Promise<{ saved: Set<string>; sessions: Set<string>; resume: Set<string> }>;
  setDisposition(profileId: string, periodKey: string, mediaId: string, disposition: TodayDisposition, dispositionAt: number, snoozedUntil?: number | null, expected?: TodayDisposition): Promise<boolean>;
  refreshMetadata(profileId: string, periodKey: string, candidates: readonly CachedTodayCandidate[], unavailableSourceIds: ReadonlySet<string>, freshness: "fresh" | "stale", cacheFetchedAt: number | null): Promise<void>;
  getVideo(profileId: string, mediaId: string): Promise<Video | null>;
};

export const todayRepository: TodayRepository = {
  readSnapshot: readTodaySnapshot,
  finalizeSnapshot: finalizeTodaySnapshot,
  listHistory: listTodayHistory,
  listRules: listTodaySourceRules,
  async listHandledLibraryIds(profileId) {
    const [saved, queues, resume] = await Promise.all([listSavedVideos(profileId), listQueues(profileId), listResume(profileId)]);
    return {
      saved: new Set(saved.map((video) => video.id)),
      sessions: new Set(queues.flatMap((queue) => queue.orderedVideoIds)),
      resume: new Set(resume.filter((position) => position.timestampSeconds > 5).map((position) => position.videoId)),
    };
  },
  setDisposition: updateTodayDisposition,
  refreshMetadata: refreshTodaySnapshotMetadata,
  getVideo: getLatestTodayVideo,
};
