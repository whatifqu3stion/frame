import type { ResumePosition, Video } from "../types";

export type SavedViewingFilter = "all" | "inProgress";

export type SavedLibraryItem = {
  video: Video;
  progressSeconds: number;
};

export type SavedFilterCriteria = {
  profileId: string;
  query: string;
  filter: SavedViewingFilter;
};

/** Prevents one profile's transient search text or filter from appearing under another profile. */
export function resolveSavedCriteria(criteria: SavedFilterCriteria, activeProfileId: string): Omit<SavedFilterCriteria, "profileId"> {
  return criteria.profileId === activeProfileId ? { query: criteria.query, filter: criteria.filter } : { query: "", filter: "all" };
}

const MEANINGFUL_PROGRESS_SECONDS = 5;

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Filters already-loaded profile data only; it performs no persistence or network work. */
export function filterSavedLibrary(
  videos: readonly Video[],
  resumePositions: readonly ResumePosition[],
  query: string,
  filter: SavedViewingFilter,
): SavedLibraryItem[] {
  const progressByVideoId = new Map<string, number>();
  for (const resume of resumePositions) {
    if (!Number.isFinite(resume.timestampSeconds)) continue;
    progressByVideoId.set(resume.videoId, Math.max(0, Math.floor(resume.timestampSeconds)));
  }

  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  return videos.flatMap((video) => {
    const progressSeconds = progressByVideoId.get(video.id) ?? 0;
    const isInProgress = progressSeconds > MEANINGFUL_PROGRESS_SECONDS;
    if (filter === "inProgress" && !isInProgress) return [];

    const searchable = normalizeSearchText(`${video.title} ${video.channelTitle}`);
    if (!terms.every((term) => searchable.includes(term))) return [];
    return [{ video, progressSeconds }];
  });
}

