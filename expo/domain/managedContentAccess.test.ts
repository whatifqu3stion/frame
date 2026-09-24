import { describe, expect, test } from "bun:test";
import { buildManagedApprovalRequest, defaultManagedContentPolicy, evaluateManagedContentAccess, validateManagedApprovalRequest } from "./managedContentAccess";
import type { Profile } from "../models/profile";
import type { Video } from "../types";

const managed: Profile = { id: "managed", name: "Managed", role: "managed", sortOrder: 1, createdAt: 1, updatedAt: 1 };
const standard: Profile = { ...managed, id: "standard", name: "Standard", role: "standard" };
const video: Video = { id: "abcdefghijk", title: "A video", channelId: "source-a", channelTitle: "Source A", thumbnailUrl: "thumb", publishedAt: "2026-09-24", durationSeconds: 120, description: "Description", fetchedAt: 10 };

describe("Managed content access", () => {
  test("defaults new Managed profiles to fail-closed Selected Videos", () => {
    expect(defaultManagedContentPolicy(managed.id, 12)).toEqual({ profileId: managed.id, mode: "selectedVideos", updatedAt: 12 });
    expect(evaluateManagedContentAccess(managed, defaultManagedContentPolicy(managed.id), video, new Set(), new Set()).kind).toBe("videoApprovalRequired");
  });

  test("does not apply Managed restrictions to Standard profiles", () => {
    expect(evaluateManagedContentAccess(standard, defaultManagedContentPolicy(standard.id), video, new Set(), new Set())).toEqual({ kind: "allowed", canPlay: true });
  });

  test("allows only exact selected videos in Selected Videos mode", () => {
    const policy = defaultManagedContentPolicy(managed.id);
    expect(evaluateManagedContentAccess(managed, policy, video, new Set([video.id]), new Set()).canPlay).toBeTrue();
    expect(evaluateManagedContentAccess(managed, policy, { ...video, id: "zzzzzzzzzzz" }, new Set([video.id]), new Set()).canPlay).toBeFalse();
  });

  test("allows only exact source IDs in Approved Sources mode", () => {
    const policy = { ...defaultManagedContentPolicy(managed.id), mode: "approvedSources" as const };
    expect(evaluateManagedContentAccess(managed, policy, video, new Set(), new Set([video.channelId])).canPlay).toBeTrue();
    expect(evaluateManagedContentAccess(managed, policy, { ...video, channelId: "" }, new Set(), new Set([video.channelId])).kind).toBe("sourceApprovalRequired");
  });

  test("builds local requests for the active mode without private account data", () => {
    const selected = buildManagedApprovalRequest(managed.id, "selectedVideos", video, 50);
    expect(selected).toMatchObject({ profileId: managed.id, kind: "video", targetId: video.id, requestedAt: 50 });
    expect(validateManagedApprovalRequest(selected)).toBeNull();
    const source = buildManagedApprovalRequest(managed.id, "approvedSources", video, 60);
    expect(source).toMatchObject({ kind: "source", targetId: video.channelId, sourceId: video.channelId, requestedAt: 60 });
    expect(validateManagedApprovalRequest({ ...source, sourceId: "", targetId: "" })).toBe("That request is incomplete.");
  });
});
