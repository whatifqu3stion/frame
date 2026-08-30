import type { KeyValueStorage } from "@/storage/profileStorage";
import type { FollowedSourceIdentity, FollowedSourceRepository } from "@/repositories/followedSourceRepository";
import {
  SOURCE_LEASE_REQUEST_LIMIT,
  type SourceLeaseAction,
  type SourceLeaseClient,
  type SourceLeaseRequestItem,
  type SourceLeaseResult,
} from "@/services/sourceLeaseClient";
import type { SourceLeaseTokenStore } from "@/storage/sourceLeaseTokenStorage";

export const SOURCE_LEASE_RENEWAL_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const SOURCE_LEASE_STATE_KEY = "frame.sourceLeases.state.v1";

export type SourceLeasePendingAction = SourceLeaseAction | null;
export type SourceLeaseMetadata = FollowedSourceIdentity & {
  lastSuccessfulSync: number | null;
  pending: SourceLeasePendingAction;
};

export type SourceLeaseStateStore = {
  read(): Promise<SourceLeaseMetadata[]>;
  write(entries: readonly SourceLeaseMetadata[]): Promise<void>;
};

export type SourceLeaseReconciliationReason = "launch" | "foreground" | "local_change";

export type SourceLeaseCoordinator = {
  reconcile(reason: SourceLeaseReconciliationReason): Promise<void>;
};

type CoordinatorOptions = {
  followedSources: Pick<FollowedSourceRepository, "listDistinctSources">;
  stateStore: SourceLeaseStateStore;
  tokenStore: SourceLeaseTokenStore;
  client: SourceLeaseClient;
  now?: () => number;
};

/** Persists only source identity, cadence, and pending-operation metadata. */
export function createSourceLeaseStateStore(storage: KeyValueStorage): SourceLeaseStateStore {
  return {
    async read(): Promise<SourceLeaseMetadata[]> {
      try {
        const raw = await storage.getItem(SOURCE_LEASE_STATE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed) || !Array.isArray(parsed.leases)) return [];
        return parsed.leases.flatMap(parseMetadata);
      } catch {
        return [];
      }
    },
    async write(entries: readonly SourceLeaseMetadata[]): Promise<void> {
      await storage.setItem(SOURCE_LEASE_STATE_KEY, JSON.stringify({ leases: entries }));
    },
  };
}

/** Coordinates one anonymous lease per distinct followed source across all local profiles. */
export function createSourceLeaseCoordinator(options: CoordinatorOptions): SourceLeaseCoordinator {
  const now = options.now ?? Date.now;
  const blockedOperations = new Set<string>();
  let inFlight: Promise<void> | null = null;
  let queuedLocalChange = false;
  let consecutiveFailures = 0;
  let nextRetryAt = 0;

  const reconcile = (reason: SourceLeaseReconciliationReason): Promise<void> => {
    if (inFlight) {
      if (reason === "local_change") queuedLocalChange = true;
      return inFlight;
    }

    inFlight = (async (): Promise<void> => {
      let currentReason = reason;
      do {
        queuedLocalChange = false;
        await reconcileOnce(currentReason);
        currentReason = "local_change";
      } while (queuedLocalChange);
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const reconcileOnce = async (reason: SourceLeaseReconciliationReason): Promise<void> => {
    const reconciliationTime = now();
    if (reason !== "local_change" && reconciliationTime < nextRetryAt) return;

    let followed: FollowedSourceIdentity[];
    let stored: SourceLeaseMetadata[];
    try {
      [followed, stored] = await Promise.all([
        options.followedSources.listDistinctSources(),
        options.stateStore.read(),
      ]);
    } catch {
      registerFailure(reconciliationTime);
      return;
    }

    const desired = new Map<string, FollowedSourceIdentity>();
    for (const source of followed) desired.set(identityKey(source), source);
    const entries = new Map<string, SourceLeaseMetadata>();
    for (const entry of stored) entries.set(identityKey(entry), entry);

    for (const [key, source] of desired) {
      const existing = entries.get(key);
      if (!existing) {
        entries.set(key, { ...source, lastSuccessfulSync: null, pending: "sync" });
      } else if (existing.pending === "release" || existing.lastSuccessfulSync === null
        || reconciliationTime - existing.lastSuccessfulSync >= SOURCE_LEASE_RENEWAL_INTERVAL_MS) {
        entries.set(key, { ...existing, pending: "sync" });
      }
    }
    for (const [key, entry] of entries) {
      if (!desired.has(key)) entries.set(key, { ...entry, pending: "release" });
    }

    await persist(entries, options.stateStore);

    let encounteredFailure = false;
    for (const action of ["sync", "release"] as const) {
      const pending = [...entries.values()].filter((entry) => entry.pending === action && !blockedOperations.has(operationKey(action, entry)));
      for (const batch of chunks(pending, SOURCE_LEASE_REQUEST_LIMIT)) {
        const prepared: SourceLeaseRequestItem[] = [];
        for (const entry of batch) {
          let leaseToken: string | null = null;
          let tokenAccessFailed = false;
          try {
            leaseToken = await options.tokenStore.get(entry);
            if (!leaseToken && action === "sync") {
              const generatedToken = await options.tokenStore.generate();
              await options.tokenStore.set(entry, generatedToken);
              leaseToken = generatedToken;
            }
          } catch {
            tokenAccessFailed = true;
            leaseToken = null;
            encounteredFailure = true;
          }

          if (!leaseToken) {
            if (action === "release" && !tokenAccessFailed) entries.delete(identityKey(entry));
            else encounteredFailure = true;
            continue;
          }
          prepared.push({ provider: entry.provider, providerSourceId: entry.providerSourceId, leaseToken });
        }

        if (prepared.length === 0) continue;
        const response = await options.client.reconcile(action, prepared);
        if (response.status !== "success") {
          encounteredFailure = true;
          continue;
        }

        for (const result of response.results) {
          const key = identityKey(result);
          const entry = entries.get(key);
          if (!entry || entry.pending !== action) continue;
          const outcome = await applyResult(action, entry, result, entries, options.tokenStore, reconciliationTime, blockedOperations);
          if (outcome === "failure") encounteredFailure = true;
        }
      }
    }

    await persist(entries, options.stateStore);
    if (encounteredFailure) registerFailure(reconciliationTime);
    else {
      consecutiveFailures = 0;
      nextRetryAt = 0;
    }
  };

  const registerFailure = (failureTime: number): void => {
    consecutiveFailures += 1;
    const delay = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.min(consecutiveFailures - 1, 7));
    nextRetryAt = failureTime + delay;
  };

  return { reconcile };
}

async function applyResult(
  action: SourceLeaseAction,
  entry: SourceLeaseMetadata,
  result: SourceLeaseResult,
  entries: Map<string, SourceLeaseMetadata>,
  tokenStore: SourceLeaseTokenStore,
  now: number,
  blockedOperations: Set<string>,
): Promise<"success" | "failure"> {
  const key = identityKey(entry);
  if (result.status === "synced" && action === "sync") {
    entries.set(key, { ...entry, lastSuccessfulSync: now, pending: null });
    return "success";
  }
  if (result.status === "released" && action === "release") {
    try {
      await tokenStore.remove(entry);
      entries.delete(key);
      return "success";
    } catch {
      return "failure";
    }
  }
  if (result.status === "unknown_source") {
    if (action === "release") {
      try {
        await tokenStore.remove(entry);
        entries.delete(key);
        return "success";
      } catch {
        return "failure";
      }
    }
    blockedOperations.add(operationKey(action, entry));
    return "success";
  }
  if (result.status === "invalid_request") {
    blockedOperations.add(operationKey(action, entry));
    return "success";
  }
  return "failure";
}

async function persist(entries: Map<string, SourceLeaseMetadata>, stateStore: SourceLeaseStateStore): Promise<void> {
  await stateStore.write([...entries.values()].sort((left, right) => identityKey(left).localeCompare(identityKey(right))));
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

function parseMetadata(value: unknown): SourceLeaseMetadata[] {
  if (!isRecord(value) || !Object.keys(value).every((key) => ["provider", "providerSourceId", "lastSuccessfulSync", "pending"].includes(key))) return [];
  if (value.provider !== "youtube" || typeof value.providerSourceId !== "string" || value.providerSourceId.length === 0) return [];
  if (value.lastSuccessfulSync !== null && (typeof value.lastSuccessfulSync !== "number" || !Number.isFinite(value.lastSuccessfulSync))) return [];
  if (value.pending !== null && value.pending !== "sync" && value.pending !== "release") return [];
  return [{
    provider: value.provider,
    providerSourceId: value.providerSourceId,
    lastSuccessfulSync: value.lastSuccessfulSync,
    pending: value.pending,
  }];
}

function operationKey(action: SourceLeaseAction, source: FollowedSourceIdentity): string {
  return `${action}:${identityKey(source)}`;
}

function identityKey(source: FollowedSourceIdentity): string {
  return JSON.stringify([source.provider, source.providerSourceId]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
