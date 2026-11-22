import type { FollowedChannel, Video } from "@/types";

export type ManagedContentMode = "selectedVideos" | "approvedSources";

export type ManagedContentPolicy = {
  profileId: string;
  mode: ManagedContentMode;
  updatedAt: number;
};

export type ManagedApprovedVideo = Video & {
  profileId: string;
  approvedAt: number;
};

export type ManagedApprovedSource = FollowedChannel & {
  profileId: string;
  approvedAt: number;
};

export type ManagedApprovalRequest = {
  profileId: string;
  kind: "video" | "source";
  targetId: string;
  sourceId: string;
  title: string;
  sourceTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number;
  description: string;
  fetchedAt: number | null;
  requestedAt: number;
};

export type ManagedContentOverview = {
  policy: ManagedContentPolicy;
  approvedVideos: ManagedApprovedVideo[];
  approvedSources: ManagedApprovedSource[];
  requests: ManagedApprovalRequest[];
};

export type ManagedContentAccessStatus =
  | { kind: "allowed"; canPlay: true }
  | { kind: "videoApprovalRequired"; canPlay: false; reason: string }
  | { kind: "sourceApprovalRequired"; canPlay: false; reason: string }
  | { kind: "ownerReview"; canPlay: false; reason: string };
