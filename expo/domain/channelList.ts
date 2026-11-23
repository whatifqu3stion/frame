import { PRODUCT_LIMITS } from "../constants/productConfig";
import { isMetadataCurrent } from "./metadataRetention";
import type { FollowedChannel } from "../types";

export const CHANNEL_LIST_MAX_BYTES = 1024 * 1024;
export const channelListId = /^UC[A-Za-z0-9_-]{22}$/;
const entry = /^- \[((?:\\.|[^\]\\])*)\]\(https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})\)(?: <!-- fetched:(\d{1,16}) -->)?$/;
export class ChannelListError extends Error {}

function label(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 256);
}

export function exportChannelList(name: string, sources: readonly FollowedChannel[], now = Date.now()): string {
  const lines = sources.filter(s => channelListId.test(s.id)).map(s => {
    const current = isMetadataCurrent(s.fetchedAt, now);
    const title = label(current ? s.title : s.id).replace(/[\\\[\]]/g, "\\$&");
    return `- [${title}](https://www.youtube.com/channel/${s.id})${current ? ` <!-- fetched:${s.fetchedAt} -->` : ""}`;
  });
  if (!lines.length) throw new ChannelListError("Follow a YouTube channel to export a list.");
  return [`# ${label(name)}’s channels`, "", ...lines, ""].join("\n");
}

export function parseChannelList(text: string, now = Date.now()): FollowedChannel[] {
  if (text.length > CHANNEL_LIST_MAX_BYTES) throw new ChannelListError("Choose a channel list under 1 MB.");
  const sources = new Map<string, FollowedChannel>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = entry.exec(line);
    if (!match) throw new ChannelListError("Choose a Markdown channel list exported from Frame.");
    const [, title, id, timestamp] = match;
    if (sources.has(id)) continue;
    const fetched = Number(timestamp);
    sources.set(id, { id, title: label(title.replace(/\\(.)/g, "$1")) || id, thumbnailUrl: "", source: "link", followedAt: now, fetchedAt: isMetadataCurrent(fetched, now) ? fetched : null });
    if (sources.size > PRODUCT_LIMITS.futureSourcesPerProfile) throw new ChannelListError(`A list can contain up to ${PRODUCT_LIMITS.futureSourcesPerProfile} channels.`);
  }
  if (!sources.size) throw new ChannelListError("This file has no channel links. Choose a list exported from Frame.");
  return [...sources.values()];
}
