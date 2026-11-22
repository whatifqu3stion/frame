import { DiscoverySetupError, type DiscoveryProgress, type DiscoveryStage } from "./byokWeeklyPicks";
import { ProviderError } from "./providerRequest";
import type { WeeklyPicksClientResult } from "./weeklyPicksClient";

type Client = {
  generate(ids: readonly string[], signal: AbortSignal, profileId: string, stage: (stage: DiscoveryStage) => void, progress: (progress: DiscoveryProgress) => void): Promise<void>;
  getWeeklyPicks(ids: readonly string[], profileId: string): Promise<WeeklyPicksClientResult>;
};
export type DiscoveryRunSnapshot = {
  profileId: string | null; interestKey: string; status: "idle" | "running" | "complete" | "stopped" | "failed";
  stage: DiscoveryStage; reviewedCount: number; available: boolean; startedAt: number;
  revision: number; message: string;
};

/** App-owned work survives navigation, but never a cancel, profile/key change, or app suspension. */
export function createDiscoveryRun(client: Client, now = Date.now) {
  let snapshot: DiscoveryRunSnapshot = { profileId: null, interestKey: "", status: "idle", stage: "setup", reviewedCount: 0, available: false, startedAt: 0, revision: 0, message: "" };
  let operation: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: Partial<DiscoveryRunSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancel() { operation?.abort(); },
    async start(profileId: string, ids: readonly string[]) {
      if (operation) return;
      const controller = new AbortController(); operation = controller;
      publish({ profileId, interestKey: [...ids].sort().join(","), status: "running", stage: "setup", reviewedCount: 0, available: false, startedAt: now(), message: "" });
      try {
        await client.generate(ids, controller.signal, profileId,
          stage => { if (!controller.signal.aborted) publish({ stage }); },
          progress => { if (!controller.signal.aborted) publish({ ...progress, revision: snapshot.revision + (progress.available ? 1 : 0) }); });
        if (controller.signal.aborted) throw new ProviderError("cancelled");
        const result = await client.getWeeklyPicks(ids, profileId);
        if (controller.signal.aborted) throw new ProviderError("cancelled");
        if (result.status !== "success") throw new DiscoverySetupError("storage");
        const reviewedCount = result.response.interests.reduce((sum, group) => sum + group.picks.length, 0);
        publish({ status: "complete", reviewedCount, available: reviewedCount > 0, stage: "save", revision: snapshot.revision + 1, message: result.response.message ?? "Your selection is ready." });
      } catch (error) {
        const stopped = controller.signal.aborted || (error instanceof ProviderError && error.kind === "cancelled");
        const detail = error instanceof ProviderError || error instanceof DiscoverySetupError ? error.message : "Frame couldn’t finish the search. Try again later.";
        publish({ status: stopped ? "stopped" : "failed", revision: snapshot.revision + 1,
          message: stopped ? snapshot.available ? "Search stopped. Your reviewed picks are saved." : "Search stopped. Requests already sent may count toward your quota."
            : `${snapshot.available ? "Your reviewed picks are saved. " : ""}${detail}` });
      } finally { if (operation === controller) operation = null; }
    },
  };
}
