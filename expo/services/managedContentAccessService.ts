import {
  clearManagedApprovalRequests,
  deleteManagedApprovalRequest,
  deleteManagedApprovedSource,
  deleteManagedApprovedVideo,
  listManagedApprovalRequests,
  listManagedApprovedSources,
  listManagedApprovedVideos,
  readManagedContentPolicy,
  upsertManagedApprovalRequest,
  upsertManagedApprovedSource,
  upsertManagedApprovedVideo,
  upsertManagedContentPolicy,
} from "@/db/database";
import {
  buildManagedApprovalRequest,
  defaultManagedContentPolicy,
  evaluateManagedContentAccess,
  validateManagedApprovalRequest,
} from "@/domain/managedContentAccess";
import type {
  ManagedApprovalRequest,
  ManagedApprovedSource,
  ManagedContentAccessStatus,
  ManagedContentMode,
  ManagedContentOverview,
} from "@/models/managedContentAccess";
import type { Profile } from "@/models/profile";
import type { FollowedChannel, Video } from "@/types";

async function policyFor(profile: Profile): Promise<ManagedContentOverview["policy"]> {
  const existing = await readManagedContentPolicy(profile.id);
  if (existing) return existing;
  const policy = defaultManagedContentPolicy(profile.id);
  await upsertManagedContentPolicy(policy.profileId, policy.mode, policy.updatedAt);
  return policy;
}

export const managedContentAccessService = {
  async getOverview(profile: Profile): Promise<ManagedContentOverview> {
    if (profile.role !== "managed") throw new Error("Managed profile unavailable.");
    const [policy, approvedVideos, approvedSources, requests] = await Promise.all([
      policyFor(profile),
      listManagedApprovedVideos(profile.id),
      listManagedApprovedSources(profile.id),
      listManagedApprovalRequests(profile.id),
    ]);
    return { policy, approvedVideos, approvedSources, requests };
  },

  async setMode(profile: Profile, mode: ManagedContentMode): Promise<ManagedContentOverview> {
    if (profile.role !== "managed") throw new Error("Managed profile unavailable.");
    const existing = await policyFor(profile);
    if (existing.mode !== mode) {
      await upsertManagedContentPolicy(profile.id, mode, Date.now());
      await clearManagedApprovalRequests(profile.id);
    }
    return managedContentAccessService.getOverview(profile);
  },

  async getAccess(profile: Profile, video: Video): Promise<ManagedContentAccessStatus> {
    if (profile.role !== "managed") return { kind: "allowed", canPlay: true };
    const overview = await managedContentAccessService.getOverview(profile);
    return evaluateManagedContentAccess(
      profile,
      overview.policy,
      video,
      new Set(overview.approvedVideos.map((item) => item.id)),
      new Set(overview.approvedSources.map((item) => item.id)),
    );
  },

  async request(profile: Profile, video: Video): Promise<ManagedApprovalRequest> {
    if (profile.role !== "managed") throw new Error("Only Managed profiles use approval requests.");
    const policy = await policyFor(profile);
    const request = buildManagedApprovalRequest(profile.id, policy.mode, video);
    const validation = validateManagedApprovalRequest(request);
    if (validation) throw new Error(validation);
    await upsertManagedApprovalRequest(request);
    return request;
  },

  async approveRequest(profile: Profile, request: ManagedApprovalRequest): Promise<ManagedApprovedSource | null> {
    if (profile.role !== "managed" || request.profileId !== profile.id) throw new Error("That approval request is no longer available.");
    const validation = validateManagedApprovalRequest(request);
    if (validation) throw new Error(validation);
    const policy = await policyFor(profile);
    const expectedKind = policy.mode === "selectedVideos" ? "video" : "source";
    if (request.kind !== expectedKind) throw new Error("That request belongs to an earlier content access mode.");
    const now = Date.now();
    let approvedSource: ManagedApprovedSource | null = null;
    if (request.kind === "video") {
      await upsertManagedApprovedVideo({
        profileId: profile.id,
        id: request.targetId,
        title: request.title,
        channelId: request.sourceId,
        channelTitle: request.sourceTitle,
        thumbnailUrl: request.thumbnailUrl,
        publishedAt: request.publishedAt,
        durationSeconds: request.durationSeconds,
        description: request.description,
        madeForKids: null,
        fetchedAt: request.fetchedAt,
        approvedAt: now,
      });
    } else {
      approvedSource = {
        profileId: profile.id,
        id: request.sourceId,
        title: request.sourceTitle || request.title,
        description: "",
        thumbnailUrl: "",
        followedAt: now,
        source: "manual",
        fetchedAt: request.fetchedAt,
        approvedAt: now,
      };
      await upsertManagedApprovedSource(approvedSource);
    }
    await deleteManagedApprovalRequest(profile.id, request.kind, request.targetId);
    return approvedSource;
  },

  async approveVideo(profile: Profile, video: Video): Promise<ManagedApprovedSource | null> {
    const policy = await policyFor(profile);
    const request = buildManagedApprovalRequest(profile.id, policy.mode, video);
    return this.approveRequest(profile, request);
  },

  async approveSource(profile: Profile, channel: FollowedChannel): Promise<void> {
    if (profile.role !== "managed" || !channel.id) throw new Error("Managed source unavailable.");
    await upsertManagedApprovedSource({ ...channel, profileId: profile.id, approvedAt: Date.now() });
  },

  async rejectRequest(profile: Profile, request: ManagedApprovalRequest): Promise<void> {
    if (profile.role !== "managed" || request.profileId !== profile.id) throw new Error("That approval request is no longer available.");
    await deleteManagedApprovalRequest(profile.id, request.kind, request.targetId);
  },

  async revokeVideo(profile: Profile, videoId: string): Promise<void> {
    if (profile.role !== "managed") throw new Error("Managed profile unavailable.");
    await deleteManagedApprovedVideo(profile.id, videoId);
  },

  async revokeSource(profile: Profile, sourceId: string): Promise<void> {
    if (profile.role !== "managed") throw new Error("Managed profile unavailable.");
    await deleteManagedApprovedSource(profile.id, sourceId);
  },
};
