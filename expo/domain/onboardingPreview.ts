import type { DiscoveryResult, WeeklyPickSourceSuggestion } from "../types";

/** Keep the edition's editorial order, giving its first watchable, explained pick the feature. */
export function featureFirstPick(pool: readonly WeeklyPickSourceSuggestion[]) {
  const index = pool.findIndex((pick) => pick.featuredMedia && pick.fetchedAt && pick.recommendationReason?.trim());
  if (index <= 0) return pool;
  return [pool[index], ...pool.slice(0, index), ...pool.slice(index + 1)];
}

/** Page through a fixed publication; following never silently backfills a batch. */
export function onboardingPreviewPage(pool: readonly WeeklyPickSourceSuggestion[], followedIds: readonly string[], requestedPage: number) {
  const followed = new Set(followedIds);
  const pageCount = Math.ceil(pool.length / 3);
  const page = Math.max(0, Math.min(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0, Math.max(0, pageCount - 1)));
  const available = (index: number) => pool.slice(index * 3, index * 3 + 3).filter((pick) => !followed.has(pick.providerSourceId));
  const pages = Array.from({ length: pageCount }, (_, index) => index).filter((index) => available(index).length > 0);
  return {
    page,
    items: available(page),
    nextPage: pages.find((index) => index > page) ?? null,
    previousPage: pages.filter((index) => index < page).at(-1) ?? null,
    exhausted: pool.length > 0 && pages.length === 0,
  };
}

export function onboardingPreviewStatus(input: { enabled: boolean; loading: boolean; failed: boolean; result?: DiscoveryResult }) {
  if (!input.enabled) return { kind: "unavailable", retry: false, message: "Source suggestions aren’t available in this build. You can still bring a favorite below." } as const;
  if (input.loading) return { kind: "loading", retry: false, message: "Finding sources for your interests…" } as const;
  if (input.failed || !input.result) return { kind: "unavailable", retry: true, message: "Suggestions couldn’t load. Try again, or bring a favorite below." } as const;
  const { result } = input;
  if (result.reason === "configuration") return { kind: "unavailable", retry: false, message: "Prepare this week’s suggestions above, or add a creator you already know." } as const;
  if (result.reason === "maintenance") return { kind: "unavailable", retry: true, message: "Source suggestions are paused while the next publication is prepared. Check again later, or bring a favorite below." } as const;
  if (result.status !== "success" && result.status !== "cached_success") return { kind: "unavailable", retry: true, message: result.reason === "offline" ? "Suggestions need a connection. Try again when you’re connected, or continue with sources you already follow." : "The suggestion service is unavailable. Try again, or bring a favorite below." } as const;
  if (!result.items.length) return { kind: "empty", retry: false, message: "No sources qualified for this edition. You can try the available recovery option above or add a creator you know." } as const;
  return { kind: "ready", retry: false, message: result.status === "cached_success" ? "Showing your saved weekly edition." : "" } as const;
}
