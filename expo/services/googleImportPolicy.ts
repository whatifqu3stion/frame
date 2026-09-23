import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";
import type { FollowedChannel } from "../types";

/** Automatic following is intentionally disabled until selective import is designed. */
export function isAutomaticGoogleFollowingEnabled(): boolean {
  return FOUNDATION_CAPABILITIES.automaticGoogleFollowing;
}

export function isSelectiveGoogleImportEnabled(): boolean {
  return FOUNDATION_CAPABILITIES.googleSelectiveImport;
}

export type GoogleImportPlan = {
  channels: FollowedChannel[];
  alreadyFollowedCount: number;
  duplicateCount: number;
  overflowCount: number;
};

/** Enforces profile source limits without ever choosing subscriptions for the user. */
export function planSelectiveGoogleImport(
  selected: readonly FollowedChannel[],
  existingSourceIds: ReadonlySet<string>,
  maximumSources: number,
): GoogleImportPlan {
  const unique = new Map<string, FollowedChannel>();
  let duplicateCount = 0;
  for (const channel of selected) {
    if (unique.has(channel.id)) duplicateCount += 1;
    else unique.set(channel.id, { ...channel, source: "google" });
  }
  const newChannels = [...unique.values()].filter((channel) => !existingSourceIds.has(channel.id));
  const alreadyFollowedCount = unique.size - newChannels.length;
  const availableSlots = Math.max(0, maximumSources - existingSourceIds.size);
  return {
    channels: newChannels.slice(0, availableSlots),
    alreadyFollowedCount,
    duplicateCount,
    overflowCount: Math.max(0, newChannels.length - availableSlots),
  };
}
