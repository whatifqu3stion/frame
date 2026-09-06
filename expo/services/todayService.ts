import { getTodayPeriod, selectTodayItems } from "@/domain/today";
import type { TodayLoadResult, TodaySnapshot, TodaySourceRule } from "@/models/today";
import type { TodayRepository } from "@/repositories/todayRepository";
import type { SourceFeedClientResult } from "@/services/sourceFeedClient";

export type TodayFeedReader = { getCachedFeeds(sourceIds: readonly string[]): Promise<SourceFeedClientResult> };

export type LoadTodayOptions = {
  profileId: string;
  followedSourceIds: readonly string[];
  now?: number;
  refreshExisting?: boolean;
};

export function createTodayService(repository: TodayRepository, feedReader: TodayFeedReader) {
  return {
    async load(options: LoadTodayOptions): Promise<TodayLoadResult> {
      const now = options.now ?? Date.now();
      const period = getTodayPeriod(now);
      const existing = await repository.readSnapshot(options.profileId, period.key);
      if (existing && !options.refreshExisting) return { state: existing.items.length > 0 ? "ready" : "empty", snapshot: existing };
      if (options.followedSourceIds.length === 0) return { state: "no_sources", snapshot: existing };

      const feedResult = await feedReader.getCachedFeeds(options.followedSourceIds);
      if (feedResult.status !== "success") {
        const state = feedResult.status === "network_error" ? "network_error" : feedResult.status === "missing_configuration" ? "unavailable" : "unavailable";
        return { state, snapshot: existing ? { ...existing, freshness: "offline" } : null, message: state === "network_error" ? "Frame couldn’t reach the shared cache. Your local inbox was not changed." : "Frame’s cached media service is unavailable right now." };
      }

      const response = feedResult.response;
      if (existing) {
        if (response.state === "unavailable") return { state: "ready", snapshot: { ...existing, freshness: "offline" }, message: response.message };
        await repository.refreshMetadata(
          options.profileId,
          period.key,
          feedResult.candidates,
          new Set(response.unavailableSourceIds),
          response.state === "fresh" ? "fresh" : "stale",
          response.fetchedAt ? Date.parse(response.fetchedAt) : null,
        );
        const refreshed = await repository.readSnapshot(options.profileId, period.key);
        return { state: refreshed && refreshed.items.length > 0 ? "ready" : "empty", snapshot: refreshed ?? existing };
      }

      if (response.state === "unavailable") {
        return { state: "no_cache", snapshot: null, message: response.message };
      }

      const [history, rules, handled] = await Promise.all([
        repository.listHistory(options.profileId),
        repository.listRules(options.profileId),
        repository.listHandledLibraryIds(options.profileId),
      ]);
      const ruleMap = new Map<string, TodaySourceRule>(rules.map((rule) => [rule.sourceId, rule]));
      const selected = selectTodayItems({
        profileId: options.profileId,
        period,
        now,
        candidates: feedResult.candidates,
        followedSourceIds: new Set(options.followedSourceIds),
        rules: ruleMap,
        savedMediaIds: handled.saved,
        sessionMediaIds: handled.sessions,
        resumeMediaIds: handled.resume,
        history,
      });
      const snapshot: TodaySnapshot = {
        profileId: options.profileId,
        periodKey: period.key,
        createdAt: now,
        cacheFetchedAt: response.fetchedAt ? Date.parse(response.fetchedAt) : null,
        freshness: response.state === "fresh" ? "fresh" : "stale",
        items: selected,
      };
      const finalized = await repository.finalizeSnapshot(snapshot);
      return { state: finalized.items.length > 0 ? "ready" : "empty", snapshot: finalized };
    },
  };
}

