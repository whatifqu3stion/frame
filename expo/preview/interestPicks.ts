import type { DiscoveryResult, WeeklyPickSourceSuggestion } from "../types";
import { makePreviewLibrary } from "./library";
import { weeklyDiscoveryPeriodKey } from "../services/discovery";

const sampleTopics = ["science", "making", "design", "design", "cooking", "travel", "music", "science", "history", "making"];
export function sampleVideoTopic(id: string) {
  if (!/^mockv\d{6}$/.test(id)) return undefined;
  return sampleTopics[Math.floor(Number(id.slice(5)) / 3)];
}

const sampleReasons = [
  "Tree rings give you a way to read a forest’s past, from wet years to drought.",
  "See how working slowly changes the choices a maker makes about materials and finish.",
  "See how the placement of a window changes the light, mood, and use of a room.",
  "Try looking at one painting for longer, following its colors and details before reading the label.",
  "Follow the timing and small decisions that bring a shared meal together.",
  "Explore how a walking route reveals details of a landscape you might otherwise pass by.",
  "Listen for the repetition and variation that make a melody feel familiar.",
  "Find a question about everyday motion that you can try investigating yourself.",
  "Look at the objects people kept and what they tell us about ordinary life in another time.",
  "Follow a garden through the seasons to see how timing shapes what grows.",
];

export function sampleInterestPicks(ids: readonly string[], now: number): DiscoveryResult {
  const { channels, videos } = makePreviewLibrary(now);
  const start = weeklyDiscoveryPeriodKey(now);
  const end = new Date(Date.parse(start) + 6 * 86400000).toISOString().slice(0, 10);
  const groups = ids.map((id) => channels.flatMap((channel, index): WeeklyPickSourceSuggestion[] => {
    if (sampleTopics[index] !== id) return [];
    const video = videos.find((entry) => entry.channelId === channel.id)!;
    return [{ provider: "youtube", providerSourceId: channel.id, displayName: channel.title, thumbnailUrl: channel.thumbnailUrl, handle: null, description: channel.description ?? "", interestId: id, recommendationReason: sampleReasons[index], fetchedAt: now, publicationPeriod: { start, end }, featuredMedia: { provider: "youtube", providerMediaId: video.id, title: video.title, thumbnailUrl: video.thumbnailUrl, description: "", durationSeconds: video.durationSeconds, publishedAt: video.publishedAt, isLivestream: false, isUpcomingPremiere: false } }];
  }));
  const items = Array.from({ length: Math.max(0, ...groups.map((group) => group.length)) }, (_, position) => groups.flatMap((group) => group[position] ?? [])).flat();
  return { status: "success", items, ...(items.length ? {} : { reason: "empty" as const }) };
}
