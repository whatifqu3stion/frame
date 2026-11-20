import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { getTodayPeriod, selectTodayItems } from "@/domain/today";
import type { TodayLoadResult, TodaySnapshot, TodaySourceRule } from "@/models/today";
import type { TodayRepository } from "@/repositories/todayRepository";
import type { SourceFeedClientResult } from "@/services/sourceFeedClient";

export type TodayFeedReader = { getCachedFeeds(sourceIds: readonly string[], refresh?: boolean): Promise<SourceFeedClientResult> };

export type LoadTodayOptions = {
  maxItems?: number;
  profileId: string;
  followedSourceIds: readonly string[];
  now?: number;
  periodAt?: number;
  refreshExisting?: boolean;
};

export function createTodayService(repository: TodayRepository, feedReader: TodayFeedReader, clock = Date.now) {
  return {
    async load(options: LoadTodayOptions): Promise<TodayLoadResult> {
      const now = options.now ?? clock();
      const period = getTodayPeriod(options.periodAt ?? now);
      const existing = await repository.readSnapshot(options.profileId, period.key);

      if (existing && !options.refreshExisting) return { state: existing.items.length > 0 ? "ready" : "empty", snapshot: existing };
      if (options.followedSourceIds.length === 0) return { state: "no_sources", snapshot: existing };

      const rules = await repository.listRules(options.profileId);
      const ruleMap = new Map<string, TodaySourceRule>(rules.map((rule) => [rule.sourceId, rule]));
      const participatingIds = options.followedSourceIds.filter((id) => {
        const mutedUntil = ruleMap.get(id)?.mutedUntil;
        return mutedUntil == null || mutedUntil <= now;
      });
      if (participatingIds.length > PRODUCT_LIMITS.sourceFeedMaxSources) return { state: "source_limit", snapshot: existing, message: "Choose up to 100 sources for Today. Keep the others in your library." };
      if (!participatingIds.length) return { state: "no_sources", snapshot: existing, message: "Your sources are library only. Include a source in Today from its channel page." };
      const feedResult = await feedReader.getCachedFeeds(participatingIds, !existing && options.refreshExisting === true);
      if (feedResult.status !== "success") {
        const state = feedResult.status === "network_error" ? "network_error" : "unavailable";
        return { state, snapshot: existing ? { ...existing, freshness: "offline" } : null, message: feedResult.message ?? (state === "network_error" ? "Frame couldn’t reach YouTube. Your local inbox was not changed." : "Video data is unavailable. Check your YouTube key and quota in Settings → YouTube & Gemini.") };
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

      const [history, handled] = await Promise.all([
        repository.listHistory(options.profileId),
        repository.listHandledLibraryIds(options.profileId),
      ]);
      // Live feeds timestamp their items after the network request completes.
      const selectedAt = options.now ?? clock();
      const selected = selectTodayItems({
        maxItems: options.maxItems,
        profileId: options.profileId,
        period,
        now: selectedAt,
        candidates: feedResult.candidates,
        followedSourceIds: new Set(options.followedSourceIds),
        rules: ruleMap,
        savedMediaIds: handled.saved,
        sessionMediaIds: handled.sessions,
        resumeMediaIds: handled.resume,
        history,
      });
      if (!selected.length && !history.length) {
        return { state: "empty", snapshot: null, message: "No recent uploads match your Today settings yet. Follow another source or check again." };
      }
      const snapshot: TodaySnapshot = {
        profileId: options.profileId,
        periodKey: period.key,
        createdAt: selectedAt,
        cacheFetchedAt: response.fetchedAt ? Date.parse(response.fetchedAt) : null,
        freshness: response.state === "fresh" ? "fresh" : "stale",
        items: selected,
      };
      const finalized = await repository.finalizeSnapshot(snapshot);
      return { state: finalized.items.length > 0 ? "ready" : "empty", snapshot: finalized };
    },
  };
}


