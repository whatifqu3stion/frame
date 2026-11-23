import { ChannelListError, CHANNEL_LIST_MAX_BYTES, exportChannelList, parseChannelList } from "./channelList";
import { validDiscoveryBrief } from "./discoveryBrief";
import { interestTopicFromId, interestTopics, isCustomInterest } from "./interests";
import type { FollowedChannel, InterestTopic } from "../types";

export type ProfileTransfer = { channels: FollowedChannel[]; interests: InterestTopic[]; brief: string | null };
const marker = "<!-- Frame profile v1 -->";
const invalid = () => new ChannelListError("Choose a profile or channel list exported from Frame.");

export function exportProfile(name: string, channels: FollowedChannel[], interests: InterestTopic[], brief: string) {
  const label = name.replace(/[\r\n]+/g, " ").trim();
  const settings = { interests: interests.map(topic => topic.id), discoveryBrief: brief };
  const links = channels.length ? exportChannelList(name, channels).split("\n").slice(2).join("\n") : "";
  return [marker, `# ${label}’s Frame profile`, "", "## Discovery", "```json", JSON.stringify(settings), "```", "", "## Channels", links].join("\n");
}

export function parseProfile(text: string): ProfileTransfer {
  if (text.length > CHANNEL_LIST_MAX_BYTES) throw new ChannelListError("Choose a Markdown file under 1 MB.");
  const lines = text.trim().split(/\r?\n/);
  if (lines[0] !== marker) {
    if (lines[0].startsWith("<!-- Frame profile")) throw new ChannelListError("This file uses a different profile format. Check for a Frame update.");
    return { channels: parseChannelList(text), interests: [], brief: null };
  }
  const start = lines.indexOf("```json");
  if (start < 1 || lines[start + 2] !== "```" || lines[start + 4] !== "## Channels") throw invalid();
  let data;
  try { data = JSON.parse(lines[start + 1]); } catch { throw invalid(); }
  if (!data || !Array.isArray(data.interests) || data.interests.length > 500 ||
      data.interests.some((id: unknown) => typeof id !== "string" || !interestTopicFromId(id)) ||
      typeof data.discoveryBrief !== "string" || !validDiscoveryBrief(data.discoveryBrief)) throw invalid();
  const links = lines.slice(start + 5).join("\n").trim();
  return { channels: links ? parseChannelList(links) : [], interests: interestTopics(data.interests), brief: data.discoveryBrief.trim() };
}

export function addedInterests(existing: InterestTopic[], incoming: InterestTopic[]) {
  const names = new Set(existing.map(topic => topic.name.toLowerCase()));
  const added = interestTopics(incoming).filter(topic => !names.has(topic.name.toLowerCase()));
  return { standard: added.filter(topic => !isCustomInterest(topic.id)), custom: added.filter(topic => isCustomInterest(topic.id)) };
}
