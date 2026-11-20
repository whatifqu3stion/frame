import { DISCOVERY_QUALITY, type DiscoverySample } from "../domain/discoveryQuality";
import { isLongFormVideo, isShortsLink, SHORT_FORM_MESSAGE, UNVERIFIED_DURATION_MESSAGE } from "../domain/contentPolicy";
import { SOURCE_FEED_CANDIDATES_PER_SOURCE, SOURCE_FEED_MAX_SOURCES } from "../constants/productConfig";
import { parseSourceInput } from "../domain/sourceInput";
import type { Channel, Video, ResolvedSource, ResolvedVideo, ServiceResult, SourceResolution } from "../types";
import type { ProviderKeyStore } from "../storage/providerKeys";
import { ProviderError, type ProviderTransport } from "./providerRequest";
import { isSourceFeedResponse, mapCandidates, type SourceFeedClientResult, type SourceFeedResponse } from "./sourceFeedClient";

const channelPattern = /^UC[A-Za-z0-9_-]{22}$/;
const videoPattern = /^[A-Za-z0-9_-]{11}$/;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const string = (value: unknown, max = 500): string => typeof value === "string" ? value.slice(0, max) : "";
function items(value: unknown): RecordValue[] {
  const list = record(value).items;
  if (!Array.isArray(list) || list.length > 50) throw new ProviderError("invalid_response");
  return list.map(record);
}
function thumbnail(value: unknown): string | null {
  const thumbnails = record(value);
  for (const size of ["medium", "default", "high"]) {
    const candidate = string(record(thumbnails[size]).url, 2048);
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && /(^|\.)(ytimg\.com|ggpht\.com|googleusercontent\.com)$/.test(url.hostname)) return url.toString();
    } catch { /* Untrusted provider URL; omit it. */ }
  }
  return null;
}
function channel(value: RecordValue): ResolvedSource {
  const snippet = record(value.snippet);
  const id = string(value.id);
  const title = string(snippet.title, 160);
  if (!channelPattern.test(id) || !title) throw new ProviderError("invalid_response");
  return { provider: "youtube", providerSourceId: id, displayName: title, handle: string(snippet.customUrl, 100) || null, description: string(snippet.description, 5000), thumbnailUrl: thumbnail(snippet.thumbnails) };
}
function video(value: RecordValue): ResolvedVideo {
  const snippet = record(value.snippet);
  const content = record(value.contentDetails);
  const status = record(value.status);
  const id = string(value.id);
  const title = string(snippet.title);
  if (!videoPattern.test(id) || !title) throw new ProviderError("invalid_response");
  const duration = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(string(content.duration));
  const publishedAt = string(snippet.publishedAt);
  return {
    provider: "youtube", providerMediaId: id, title, description: string(snippet.description, 5000), thumbnailUrl: thumbnail(snippet.thumbnails),
    publishedAt: Number.isFinite(Date.parse(publishedAt)) ? publishedAt : null,
    durationSeconds: duration ? Number(duration[1] ?? 0) * 3600 + Number(duration[2] ?? 0) * 60 + Number(duration[3] ?? 0) : null,
    isLivestream: snippet.liveBroadcastContent === "live", isUpcomingPremiere: snippet.liveBroadcastContent === "upcoming",
    madeForKids: typeof status.madeForKids === "boolean" ? status.madeForKids : null,
  };
}

export type ChannelBrowseOptions = { query?: string; pageToken?: string; duration?: "any" | "medium" | "long"; recent?: boolean };
export type ChannelPage = { channel: Channel; videos: Video[]; nextPageToken: string | null };
function nextPage(value: unknown): string | null {
  const token = record(value).nextPageToken;
  if (token === undefined) return null;
  if (typeof token !== "string" || !/^[A-Za-z0-9_=-]{1,512}$/.test(token)) throw new ProviderError("invalid_response");
  return token;
}
function searchItems(value: unknown): RecordValue[] {
  const result = items(value);
  if (result.length > 20) throw new ProviderError("invalid_response");
  return result;
}
function queryText(query: string): string {
  const text = query.trim();
  if (!text || text.length > 120) throw new ProviderError("invalid_response");
  return text;
}
function channelView(source: ResolvedSource, fetchedAt: number): Channel {
  return { id: source.providerSourceId, title: source.displayName, description: source.description ?? "", thumbnailUrl: source.thumbnailUrl ?? "", fetchedAt };
}

export function createByokYouTube(transport: ProviderTransport, keys: ProviderKeyStore, now = Date.now) {
  type Feed = SourceFeedResponse["feeds"][number];
  const cache = new Map<string, { expires: number; feed: Feed }>();
  const pending = new Map<string, Promise<Feed | null>>();
  keys.subscribe(() => { cache.clear(); pending.clear(); });
  async function loadFeed(id: string): Promise<Feed | null> {
    const revision = keys.revision();
    const entries = items(await transport.youtube("channels", { part: "snippet,contentDetails", id }));
    if (!entries.length) return null;
    const source = channel(entries[0]);
    if (source.providerSourceId !== id) throw new ProviderError("invalid_response");
    const playlistId = string(record(record(entries[0].contentDetails).relatedPlaylists).uploads);
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(playlistId)) throw new ProviderError("invalid_response");
    const uploads = items(await transport.youtube("playlistItems", { part: "contentDetails", playlistId, maxResults: String(SOURCE_FEED_CANDIDATES_PER_SOURCE) }));
    const ids = [...new Set(uploads.map((entry) => string(record(entry.contentDetails).videoId)).filter((value) => videoPattern.test(value)))].slice(0, SOURCE_FEED_CANDIDATES_PER_SOURCE);
    const videos = ids.length ? items(await transport.youtube("videos", { part: "snippet,contentDetails,status", id: ids.join(",") })) : [];
    const fetchedAt = new Date(now()).toISOString();
    const feed: Feed = { source: { provider: "youtube", providerSourceId: id, displayName: source.displayName, handle: source.handle, thumbnailUrl: source.thumbnailUrl, fetchedAt }, freshness: "fresh", items: videos.filter((entry) => ids.includes(string(entry.id)) && record(entry.snippet).channelId === id).map((entry) => ({ ...video(entry), fetchedAt })).filter(isLongFormVideo) };
    if (keys.revision() !== revision) throw new ProviderError("cancelled");
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(id, { expires: now() + 15 * 60_000, feed });
    return feed;
  }
  function feedFor(id: string, refresh: boolean): Promise<Feed | null> {
    const cached = cache.get(id);
    if (!refresh && cached && cached.expires > now()) return Promise.resolve(cached.feed);
    const running = pending.get(id);
    if (running) return running;
    const request = loadFeed(id).finally(() => { if (pending.get(id) === request) pending.delete(id); });
    pending.set(id, request);
    return request;
  }
  return {
    // No unconstrained video-search entry point exists. Channel identity is verified again
    // on hydrated videos, even when the provider search response contains unexpected IDs.
    async searchChannels(query: string, signal?: AbortSignal): Promise<Channel[]> {
      const revision = keys.revision();
      const results = searchItems(await transport.youtube("search", { part: "snippet", type: "channel", q: queryText(query), maxResults: "20", safeSearch: "strict" }, signal));
      const ids = [...new Set(results.map((entry) => string(record(entry.id).channelId)).filter((id) => channelPattern.test(id)))];
      if (!ids.length) return [];
      const verified = items(await transport.youtube("channels", { part: "snippet", id: ids.join(",") }, signal));
      if (revision !== keys.revision() || signal?.aborted) throw new ProviderError("cancelled");
      const sources = new Map(verified.filter((entry) => ids.includes(string(entry.id))).map((entry) => { const source = channel(entry); return [source.providerSourceId, channelView(source, now())]; }));
      return ids.flatMap((id) => sources.has(id) ? [sources.get(id)!] : []);
    },
    async browseChannel(id: string, options: ChannelBrowseOptions = {}, signal?: AbortSignal): Promise<ChannelPage> {
      if (!channelPattern.test(id) || (options.pageToken && !/^[A-Za-z0-9_=-]{1,512}$/.test(options.pageToken))) throw new ProviderError("invalid_response");
      const revision = keys.revision();
      const entries = items(await transport.youtube("channels", { part: "snippet,contentDetails", id }, signal));
      if (!entries.length) throw new ProviderError("invalid_response");
      const source = channel(entries[0]);
      if (source.providerSourceId !== id) throw new ProviderError("invalid_response");
      let response: unknown;
      let ids: string[];
      const page: Record<string, string> = options.pageToken ? { pageToken: options.pageToken } : {};
      if (options.query) {
        if (options.duration && !["any", "medium", "long"].includes(options.duration)) throw new ProviderError("invalid_response");
        response = await transport.youtube("search", { part: "snippet", type: "video", channelId: id, q: queryText(options.query), maxResults: "20", safeSearch: "strict", order: "relevance", ...page, ...(options.duration && options.duration !== "any" ? { videoDuration: options.duration } : {}), ...(options.recent ? { publishedAfter: new Date(now() - 365 * 86_400_000).toISOString() } : {}) }, signal);
        ids = searchItems(response).filter((entry) => record(entry.snippet).channelId === id).map((entry) => string(record(entry.id).videoId));
      } else {
        const playlistId = string(record(record(entries[0].contentDetails).relatedPlaylists).uploads);
        if (!/^[A-Za-z0-9_-]{10,100}$/.test(playlistId)) throw new ProviderError("invalid_response");
        response = await transport.youtube("playlistItems", { part: "contentDetails", playlistId, maxResults: "50", ...page }, signal);
        ids = items(response).map((entry) => string(record(entry.contentDetails).videoId));
      }
      ids = [...new Set(ids.filter((value) => videoPattern.test(value)))];
      const hydrated = ids.length ? items(await transport.youtube("videos", { part: "snippet,contentDetails,status", id: ids.join(",") }, signal)) : [];
      const fetchedAt = now();
      const videos = new Map(hydrated.filter((entry) => ids.includes(string(entry.id)) && record(entry.snippet).channelId === id).map((entry) => {
        const item = video(entry);
        return [item.providerMediaId, item];
      }));
      if (revision !== keys.revision() || signal?.aborted) throw new ProviderError("cancelled");
      return { channel: channelView(source, fetchedAt), nextPageToken: nextPage(response), videos: ids.flatMap((videoId) => {
        const item = videos.get(videoId);
        return !item || !isLongFormVideo(item) || item.isLivestream || item.isUpcomingPremiere ? [] : [{ id: item.providerMediaId, title: item.title, channelId: id, channelTitle: source.displayName, thumbnailUrl: item.thumbnailUrl ?? "", publishedAt: item.publishedAt ?? "", durationSeconds: item.durationSeconds ?? 0, description: item.description, madeForKids: item.madeForKids, fetchedAt }];
      }) };
    },
    /** A bounded sample of recent upload pages, including short/unknown entries so the reviewer cannot cherry-pick a Shorts-heavy source. */
    async inspectDiscoverySource(id: string, signal?: AbortSignal): Promise<DiscoverySample> {
      if (!channelPattern.test(id)) throw new ProviderError("invalid_response");
      const revision = keys.revision();
      const entries = items(await transport.youtube("channels", { part: "contentDetails", id }, signal));
      if (entries.length !== 1 || entries[0].id !== id) throw new ProviderError("invalid_response");
      const playlistId = string(record(record(entries[0].contentDetails).relatedPlaylists).uploads);
      if (!/^[A-Za-z0-9_-]{10,100}$/.test(playlistId)) throw new ProviderError("invalid_response");
      const found = new Map<string, ResolvedVideo>();
      let sampledCount = 0;
      let pageToken: string | undefined;
      const visited = new Set<string>();
      do {
        const response = await transport.youtube("playlistItems", { part: "contentDetails", playlistId, maxResults: String(DISCOVERY_QUALITY.initialSampleSize), ...(pageToken ? { pageToken } : {}) }, signal);
        const uploads = items(response);
        if (uploads.length > DISCOVERY_QUALITY.initialSampleSize) throw new ProviderError("invalid_response");
        sampledCount += uploads.length;
        const ids = [...new Set(uploads.map((entry) => string(record(entry.contentDetails).videoId)).filter((value) => videoPattern.test(value)))];
        const hydrated = ids.length ? items(await transport.youtube("videos", { part: "snippet,contentDetails,status", id: ids.join(",") }, signal)) : [];
        for (const entry of hydrated) if (ids.includes(string(entry.id)) && record(entry.snippet).channelId === id) found.set(string(entry.id), video(entry));
        if (revision !== keys.revision() || signal?.aborted) throw new ProviderError("cancelled");
        const eligibleCount = [...found.values()].filter((v) => isLongFormVideo(v) && !v.isLivestream && !v.isUpcomingPremiere).length;
        if (eligibleCount >= 6 || sampledCount >= DISCOVERY_QUALITY.sampleSize) break;
        const token = record(response).nextPageToken;
        pageToken = typeof token === "string" && token.length <= 512 && token && !visited.has(token) ? token : undefined;
        if (pageToken) visited.add(pageToken);
      } while (pageToken && visited.size < 3);
      return { sourceId: id, sampledCount, fetchedAt: now(), videos: [...found.values()] };
    },
    async validateKey(key: string, signal?: AbortSignal) {
      items(await transport.youtube("channels", { part: "id", id: "UC_x5XG1OV2P6uZZ5FSM9Ttw" }, signal, key));
    },
    async resolve(input: string, signal?: AbortSignal): Promise<ServiceResult<SourceResolution>> {
      if (isShortsLink(input)) return { status: "invalid_request", message: SHORT_FORM_MESSAGE };
      const parsed = parseSourceInput(input);
      if (parsed.kind === "unknown") return { status: "invalid_request", message: "Use a channel ID, @handle, or individual video link." };
      try {
        let resolvedVideo: ResolvedVideo | undefined;
        let filter: Record<string, string>;
        if (parsed.kind === "video") {
          const entries = items(await transport.youtube("videos", { part: "snippet,contentDetails,status", id: parsed.value }, signal));
          if (!entries.length) return { status: "not_found", message: "That video is unavailable or private." };
          resolvedVideo = video(entries[0]);
          if (!isLongFormVideo(resolvedVideo)) return { status: "invalid_request", message: resolvedVideo.durationSeconds ? SHORT_FORM_MESSAGE : UNVERIFIED_DURATION_MESSAGE };
          if (resolvedVideo.providerMediaId !== parsed.value) throw new ProviderError("invalid_response");
          const id = string(record(entries[0].snippet).channelId);
          if (!channelPattern.test(id)) throw new ProviderError("invalid_response");
          filter = { id };
        } else filter = parsed.kind === "handle" ? { forHandle: parsed.value } : { id: parsed.value };
        const entries = items(await transport.youtube("channels", { part: "snippet", ...filter }, signal));
        if (!entries.length) return { status: "not_found", message: "No source was found for that link or handle." };
        const source = channel(entries[0]);
        if (filter.id && source.providerSourceId !== filter.id) throw new ProviderError("invalid_response");
        return { status: "success", data: { source, ...(resolvedVideo ? { video: resolvedVideo } : {}), provenance: "provider", fetchedAt: now() } };
      } catch (error) {
        return { status: error instanceof ProviderError ? error.kind === "quota" ? "quota_exhausted" : error.kind === "access" || error.kind === "missing_key" ? "unauthorized" : error.kind === "network" ? "network_error" : "temporarily_unavailable" : "temporarily_unavailable", message: error instanceof ProviderError ? error.message : "Secure key storage is unavailable. Try again on your device." };
      }
    },
    async getCachedFeeds(sourceIds: readonly string[], refresh = false): Promise<SourceFeedClientResult> {
      const ids = [...new Set(sourceIds)];
      if (!ids.length || ids.length > SOURCE_FEED_MAX_SOURCES || ids.some((id) => !channelPattern.test(id))) return { status: "invalid_request" };
      try {
        if (!await keys.read("youtube")) return { status: "missing_configuration", message: new ProviderError("missing_key", "youtube").message };
        const revision = keys.revision();
        const feeds: Feed[] = [];
        const unavailableSourceIds: string[] = [];
        // Bounded concurrency avoids a burst of requests against the user's quota.
        for (let start = 0; start < ids.length; start += 3) {
          const batch = ids.slice(start, start + 3);
          const results = await Promise.all(batch.map((id) => feedFor(id, refresh)));
          results.forEach((feed, index) => { if (feed) feeds.push(feed); else unavailableSourceIds.push(batch[index]); });
          if (keys.revision() !== revision) throw new ProviderError("cancelled");
        }
        const response: SourceFeedResponse = { state: feeds.length ? "fresh" : "unavailable", feeds, unavailableSourceIds, fetchedAt: new Date(now()).toISOString(), message: feeds.length ? "Loaded with your YouTube key." : "YouTube could not find these followed channels." };
        if (!isSourceFeedResponse(response, ids)) return { status: "invalid_response" };
        return { status: "success", response, candidates: mapCandidates(response) };
      } catch (error) {
        return { status: error instanceof ProviderError && error.kind === "network" ? "network_error" : error instanceof ProviderError && error.kind === "missing_key" ? "missing_configuration" : "http_unavailable", message: error instanceof ProviderError ? error.message : undefined };
      }
    },
  };
}
