import { describe, expect, test } from "bun:test";
import { filterSavedLibrary, resolveSavedCriteria, type SavedViewingFilter } from "./savedLibrary";
import type { ResumePosition, Video } from "../types";

const videos: Video[] = [
  { id: "one", title: "Café Science", channelId: "alpha", channelTitle: "Open Lab", thumbnailUrl: "", publishedAt: "", durationSeconds: 600 },
  { id: "two", title: "Quiet Woodworking", channelId: "beta", channelTitle: "Makers House", thumbnailUrl: "", publishedAt: "", durationSeconds: 900 },
  { id: "three", title: "Video details expired", channelId: "gamma", channelTitle: "YouTube source", thumbnailUrl: "", publishedAt: "", durationSeconds: 0 },
];
const resume: ResumePosition[] = [
  { videoId: "one", timestampSeconds: 120, updatedAt: 1 },
  { videoId: "two", timestampSeconds: 5, updatedAt: 2 },
  { videoId: "other-profile-video", timestampSeconds: 90, updatedAt: 3 },
];

function ids(query: string, filter: SavedViewingFilter): string[] {
  return filterSavedLibrary(videos, resume, query, filter).map((item) => item.video.id);
}

describe("local Saved library filtering", () => {
  test("searches title and source case-insensitively without changing order", () => {
    expect(ids("science", "all")).toEqual(["one"]);
    expect(ids("MAKERS", "all")).toEqual(["two"]);
    expect(ids("open café", "all")).toEqual(["one"]);
    expect(ids("  quiet   house ", "all")).toEqual(["two"]);
    expect(ids("", "all")).toEqual(["one", "two", "three"]);
  });

  test("treats progress over five seconds as in progress and keeps progress attached", () => {
    expect(ids("", "inProgress")).toEqual(["one"]);
    expect(filterSavedLibrary(videos, resume, "", "all").map((item) => item.progressSeconds)).toEqual([120, 5, 0]);
  });

  test("combines search and status without mutating the local inputs", () => {
    const videosBefore = structuredClone(videos);
    const resumeBefore = structuredClone(resume);
    expect(ids("lab", "inProgress")).toEqual(["one"]);
    expect(ids("house", "inProgress")).toEqual([]);
    expect(videos).toEqual(videosBefore);
    expect(resume).toEqual(resumeBefore);
  });

  test("does not expose another profile's transient search or filter during a switch", () => {
    const ownerCriteria = { profileId: "owner", query: "private title", filter: "inProgress" } as const;
    expect(resolveSavedCriteria(ownerCriteria, "owner")).toEqual({ query: "private title", filter: "inProgress" });
    expect(resolveSavedCriteria(ownerCriteria, "standard")).toEqual({ query: "", filter: "all" });
  });

  test("completed videos with cleared resume remain in All, not In progress", () => {
    expect(filterSavedLibrary(videos, [], "", "all").map((item) => item.video.id)).toEqual(["one", "two", "three"]);
    expect(filterSavedLibrary(videos, [], "", "inProgress")).toEqual([]);
  });

  test("ignores invalid progress and never introduces resume-only videos", () => {
    const malformed: ResumePosition[] = [
      { videoId: "one", timestampSeconds: Number.NaN, updatedAt: 1 },
      { videoId: "two", timestampSeconds: -10, updatedAt: 2 },
      { videoId: "not-saved", timestampSeconds: 100, updatedAt: 3 },
    ];
    expect(filterSavedLibrary(videos, malformed, "", "inProgress")).toEqual([]);
    expect(filterSavedLibrary(videos, malformed, "", "all").map((item) => item.video.id)).toEqual(["one", "two", "three"]);
  });
});
