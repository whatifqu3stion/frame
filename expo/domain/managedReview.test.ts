import { describe, expect, test } from "bun:test";
import { managedReviewUrl, refreshedManagedRequest } from "./managedReview";
import { METADATA_MAX_AGE_MS } from "./metadataRetention";
import type { ManagedApprovalRequest } from "../models/managedContentAccess";
import type { SourceResolution } from "../types";

const now = Date.UTC(2026, 9, 1);
const sourceId = `UC${"a".repeat(22)}`;
const request: ManagedApprovalRequest = { profileId: "managed", kind: "video", targetId: "abcdefghijk", sourceId, title: "Old title", sourceTitle: "Creator", thumbnailUrl: "", publishedAt: "", durationSeconds: 30, description: "", fetchedAt: 1, requestedAt: 42 };
const resolution: SourceResolution = {
  source: { provider: "youtube", providerSourceId: sourceId, displayName: "Creator", handle: null, description: "Source description", thumbnailUrl: null },
  video: { provider: "youtube", providerMediaId: request.targetId, title: "Current title", description: "Current details", thumbnailUrl: null, publishedAt: null, durationSeconds: 90, isLivestream: false, isUpcomingPremiere: false, madeForKids: null },
  provenance: "cache", fetchedAt: now - 100,
};

describe("Owner request evidence", () => {
  test("canonical preview links cannot redirect to arbitrary sites", () => {
    expect(managedReviewUrl(request)).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(managedReviewUrl({ ...request, kind: "source", targetId: sourceId })).toBe(`https://www.youtube.com/channel/${sourceId}`);
    expect(() => managedReviewUrl({ ...request, targetId: "https://elsewhere.invalid" })).toThrow();
    expect(() => managedReviewUrl({ ...request, kind: "source", targetId: `UC${"b".repeat(22)}` })).toThrow();
  });
  test("refresh keeps profile, scope, target, and request ordering", () => {
    const updated = refreshedManagedRequest(request, resolution, now);
    expect(updated).toMatchObject({ profileId: request.profileId, kind: "video", targetId: request.targetId, requestedAt: 42, title: "Current title", durationSeconds: 90, fetchedAt: now - 100 });
    expect(request.title).toBe("Old title");
  });
  test("missing, expired, and future provider timestamps never refresh the clock", () => {
    for (const fetchedAt of [null, 0, now - METADATA_MAX_AGE_MS, now + 1]) expect(() => refreshedManagedRequest(request, { ...resolution, fetchedAt }, now)).toThrow();
  });
  test("cannot replace a request with another source or video", () => {
    expect(() => refreshedManagedRequest(request, { ...resolution, source: { ...resolution.source, providerSourceId: `UC${"b".repeat(22)}` } }, now)).toThrow();
    expect(() => refreshedManagedRequest(request, { ...resolution, video: { ...resolution.video!, providerMediaId: "zzzzzzzzzzz" } }, now)).toThrow();
    expect(() => refreshedManagedRequest(request, { ...resolution, video: undefined }, now)).toThrow();
  });
  test("source refresh uses source evidence and clears old video runtime", () => {
    expect(refreshedManagedRequest({ ...request, kind: "source", targetId: sourceId }, resolution, now)).toMatchObject({ kind: "source", targetId: sourceId, title: "Creator", description: "Source description", durationSeconds: 0, publishedAt: "", requestedAt: 42 });
  });
});
