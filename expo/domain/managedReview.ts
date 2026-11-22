import { isMetadataCurrent } from "./metadataRetention";
import type { ManagedApprovalRequest } from "../models/managedContentAccess";
import type { SourceResolution } from "../types";

/** Only canonical provider identifiers can become an Owner review destination. */
export function managedReviewUrl(request: ManagedApprovalRequest): string {
  if (request.kind === "video" && /^[A-Za-z0-9_-]{11}$/.test(request.targetId)) return `https://www.youtube.com/watch?v=${request.targetId}`;
  if (request.kind === "source" && /^UC[A-Za-z0-9_-]{22}$/.test(request.targetId) && request.targetId === request.sourceId) return `https://www.youtube.com/channel/${request.targetId}`;
  throw new Error("This request has no valid preview link.");
}

/** Refresh evidence, never the request's identity, scope, or original timestamp. */
export function refreshedManagedRequest(request: ManagedApprovalRequest, resolution: SourceResolution, now = Date.now()): ManagedApprovalRequest {
  if (resolution.source.providerSourceId !== request.sourceId || (request.kind === "source" && request.targetId !== request.sourceId)) throw new Error("The refreshed source does not match this request.");
  if (!isMetadataCurrent(resolution.fetchedAt, now)) throw new Error("Current details are not available yet. Try refreshing later. This request is still pending.");
  if (request.kind === "video") {
    const video = resolution.video;
    if (!video || video.providerMediaId !== request.targetId) throw new Error("The refreshed video does not match this request.");
    return { ...request, title: video.title, sourceTitle: resolution.source.displayName, thumbnailUrl: video.thumbnailUrl ?? "", description: video.description, publishedAt: video.publishedAt ?? "", durationSeconds: video.durationSeconds ?? 0, fetchedAt: resolution.fetchedAt ?? null };
  }
  return { ...request, title: resolution.source.displayName, sourceTitle: resolution.source.displayName, thumbnailUrl: resolution.source.thumbnailUrl ?? "", description: resolution.source.description, publishedAt: "", durationSeconds: 0, fetchedAt: resolution.fetchedAt ?? null };
}
