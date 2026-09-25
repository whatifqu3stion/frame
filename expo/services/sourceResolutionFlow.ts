import type { FollowedSourceRepository } from "@/repositories/followedSourceRepository";
import { capabilitiesFor } from "@/domain/capabilities";
import type { AddChannelResult, SourceResolution } from "@/types";

type FollowDependencies = {
  followedSources: Pick<FollowedSourceRepository, "follow" | "listForProfile">;
  reconcile(): void;
  now?: () => number;
  maxSources?: number;
};

/** Shared manual-follow guard for Add Link, Source detail, and Weekly Picks. */
export async function checkSourceCapacity(
  profileId: string,
  sourceId: string,
  followedSources: Pick<FollowedSourceRepository, "listForProfile">,
  maxSources: number = capabilitiesFor(false).sourceLimit,
): Promise<{ allowed: boolean; alreadyFollowed: boolean; message?: string }> {
  const existing = await followedSources.listForProfile(profileId);
  if (existing.some((source) => source.id === sourceId)) return { allowed: true, alreadyFollowed: true };
  if (existing.length >= maxSources) return { allowed: false, alreadyFollowed: false, message: `This profile can follow up to ${maxSources} sources.` };
  return { allowed: true, alreadyFollowed: false };
}

/** Persists a resolved source only after the UI invokes this explicit confirmation boundary. */
export async function confirmSourceFollow(
  profileId: string,
  resolution: SourceResolution,
  dependencies: FollowDependencies,
): Promise<AddChannelResult> {
  const capacity = await checkSourceCapacity(profileId, resolution.source.providerSourceId, dependencies.followedSources, dependencies.maxSources);
  if (capacity.alreadyFollowed) {
    return { ok: true, message: `Already following ${resolution.source.displayName}.` };
  }
  if (!capacity.allowed) return { ok: false, message: capacity.message ?? "Source limit reached." };
  await dependencies.followedSources.follow(profileId, {
    id: resolution.source.providerSourceId,
    title: resolution.source.displayName,
    description: resolution.source.description,
    thumbnailUrl: resolution.source.thumbnailUrl ?? "",
    followedAt: (dependencies.now ?? Date.now)(),
    source: "link",
    fetchedAt: resolution.fetchedAt ?? null,
  });
  dependencies.reconcile();
  return { ok: true, message: `Following ${resolution.source.displayName}.` };
}
