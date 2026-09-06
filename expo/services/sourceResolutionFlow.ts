import type { FollowedSourceRepository } from "@/repositories/followedSourceRepository";
import type { AddChannelResult, SourceResolution } from "@/types";

type FollowDependencies = {
  followedSources: Pick<FollowedSourceRepository, "follow">;
  reconcile(): void;
  now?: () => number;
};

/** Persists a resolved source only after the UI invokes this explicit confirmation boundary. */
export async function confirmSourceFollow(
  profileId: string,
  resolution: SourceResolution,
  dependencies: FollowDependencies,
): Promise<AddChannelResult> {
  await dependencies.followedSources.follow(profileId, {
    id: resolution.source.providerSourceId,
    title: resolution.source.displayName,
    description: resolution.source.description,
    thumbnailUrl: resolution.source.thumbnailUrl ?? "",
    followedAt: (dependencies.now ?? Date.now)(),
    source: "link",
  });
  dependencies.reconcile();
  return { ok: true, message: `Following ${resolution.source.displayName}.` };
}
