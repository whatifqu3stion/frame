import type { Profile } from "@/models/profile";
import type {
  ManagedApprovalRequest,
  ManagedContentAccessStatus,
  ManagedContentMode,
  ManagedContentPolicy,
} from "@/models/managedContentAccess";
import type { Video } from "@/types";

export const DEFAULT_MANAGED_CONTENT_MODE: ManagedContentMode = "selectedVideos";

export function defaultManagedContentPolicy(profileId: string, now: number = Date.now()): ManagedContentPolicy {
  return { profileId, mode: DEFAULT_MANAGED_CONTENT_MODE, updatedAt: now };
}

export function evaluateManagedContentAccess(
  profile: Profile,
  policy: ManagedContentPolicy,
  video: Pick<Video, "id" | "channelId">,
  approvedVideoIds: ReadonlySet<string>,
  approvedSourceIds: ReadonlySet<string>,
): ManagedContentAccessStatus {
  if (profile.role !== "managed") return { kind: "allowed", canPlay: true };
  if (policy.profileId !== profile.id) {
    return { kind: "ownerReview", canPlay: false, reason: "Managed content settings need Owner review." };
  }
  if (policy.mode === "selectedVideos") {
    return approvedVideoIds.has(video.id)
      ? { kind: "allowed", canPlay: true }
      : { kind: "videoApprovalRequired", canPlay: false, reason: "This video has not been selected for this Managed profile." };
  }
  if (!video.channelId) {
    return { kind: "sourceApprovalRequired", canPlay: false, reason: "Frame cannot verify this video's source. Ask the Owner to review it." };
  }
  return approvedSourceIds.has(video.channelId)
    ? { kind: "allowed", canPlay: true }
    : { kind: "sourceApprovalRequired", canPlay: false, reason: "This source has not been approved for this Managed profile." };
}

export function buildManagedApprovalRequest(
  profileId: string,
  mode: ManagedContentMode,
  video: Video,
  now: number = Date.now(),
): ManagedApprovalRequest {
  const kind = mode === "selectedVideos" ? "video" : "source";
  return {
    profileId,
    kind,
    targetId: kind === "video" ? video.id : video.channelId,
    sourceId: video.channelId,
    title: kind === "video" ? video.title : video.channelTitle || "Video source",
    sourceTitle: video.channelTitle,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    durationSeconds: Math.max(0, Math.floor(video.durationSeconds)),
    description: video.description ?? "",
    fetchedAt: video.fetchedAt ?? null,
    requestedAt: now,
  };
}

export function validateManagedApprovalRequest(request: ManagedApprovalRequest): string | null {
  if (!request.profileId || !request.targetId) return "That request is incomplete.";
  if (request.kind === "source" && !request.sourceId) return "Frame cannot verify this video's source.";
  if (request.kind === "video" && !/^[A-Za-z0-9_-]{11}$/.test(request.targetId)) return "That video identifier is invalid.";
  return null;
}
