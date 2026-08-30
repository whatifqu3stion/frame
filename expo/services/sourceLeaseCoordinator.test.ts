import { describe, expect, test } from "bun:test";
import type { FollowedSourceIdentity } from "../repositories/followedSourceRepository";
import {
  createSourceLeaseCoordinator,
  createSourceLeaseStateStore,
  SOURCE_LEASE_RENEWAL_INTERVAL_MS,
  type SourceLeaseMetadata,
} from "./sourceLeaseCoordinator";
import type { SourceLeaseClient, SourceLeaseClientResult, SourceLeaseRequestItem } from "./sourceLeaseClient";
import type { SourceLeaseTokenStore } from "../storage/sourceLeaseTokenStorage";
import type { KeyValueStorage } from "../storage/profileStorage";

const source: FollowedSourceIdentity = { provider: "youtube", providerSourceId: "UC-shared" };

class MemoryKeyValueStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async removeItem(key: string): Promise<void> { this.values.delete(key); }
}

class MemoryTokenStore implements SourceLeaseTokenStore {
  readonly values = new Map<string, string>();
  generated = 0;
  failRead = false;
  failWrite = false;
  failRemove = false;
  async generate(): Promise<string> {
    this.generated += 1;
    return this.generated.toString(16).padStart(64, "0");
  }
  async get(value: FollowedSourceIdentity): Promise<string | null> {
    if (this.failRead) throw new Error("protected storage unavailable");
    return this.values.get(key(value)) ?? null;
  }
  async set(value: FollowedSourceIdentity, token: string): Promise<void> {
    if (this.failWrite) throw new Error("protected storage unavailable");
    this.values.set(key(value), token);
  }
  async remove(value: FollowedSourceIdentity): Promise<void> {
    if (this.failRemove) throw new Error("protected storage unavailable");
    this.values.delete(key(value));
  }
}

class ProfileFollowRepository {
  readonly follows = new Map<string, Set<string>>();
  async follow(profileId: string, providerSourceId: string): Promise<void> {
    const ids = this.follows.get(profileId) ?? new Set<string>();
    ids.add(providerSourceId);
    this.follows.set(profileId, ids);
  }
  async unfollow(profileId: string, providerSourceId: string): Promise<void> {
    this.follows.get(profileId)?.delete(providerSourceId);
  }
  async listDistinctSources(): Promise<FollowedSourceIdentity[]> {
    const ids = new Set<string>();
    for (const profileIds of this.follows.values()) for (const id of profileIds) ids.add(id);
    return [...ids].sort().map((providerSourceId) => ({ provider: "youtube", providerSourceId }));
  }
}

class RecordingClient implements SourceLeaseClient {
  readonly calls: { action: "sync" | "release"; sources: readonly SourceLeaseRequestItem[] }[] = [];
  status: "normal" | "disabled" | "unknown" | "offline" = "normal";
  async reconcile(action: "sync" | "release", sources: readonly SourceLeaseRequestItem[]): Promise<SourceLeaseClientResult> {
    this.calls.push({ action, sources });
    if (this.status === "offline") return { status: "network_error" };
    return {
      status: "success",
      results: sources.map((item) => ({
        provider: item.provider,
        providerSourceId: item.providerSourceId,
        status: this.status === "disabled" ? "disabled" : this.status === "unknown" ? "unknown_source" : action === "sync" ? "synced" : "released",
      })),
    };
  }
}

function key(value: FollowedSourceIdentity): string {
  return `${value.provider}\n${value.providerSourceId}`;
}

function setup(nowValue: { current: number } = { current: Date.parse("2026-08-30T00:00:00.000Z") }) {
  const follows = new ProfileFollowRepository();
  const storage = new MemoryKeyValueStorage();
  const stateStore = createSourceLeaseStateStore(storage);
  const tokenStore = new MemoryTokenStore();
  const client = new RecordingClient();
  const coordinator = createSourceLeaseCoordinator({
    followedSources: follows,
    stateStore,
    tokenStore,
    client,
    now: () => nowValue.current,
  });
  return { follows, storage, stateStore, tokenStore, client, coordinator, nowValue };
}

describe("Round 3B local source lease coordination", () => {
  test("multiple local profiles produce one source lease and one protected token", async () => {
    const fixture = setup();
    await fixture.follows.follow("owner", source.providerSourceId);
    await fixture.follows.follow("child", source.providerSourceId);
    await fixture.coordinator.reconcile("local_change");

    expect(fixture.client.calls).toHaveLength(1);
    expect(fixture.client.calls[0]?.sources).toHaveLength(1);
    expect(fixture.tokenStore.generated).toBe(1);
    const persisted = [...fixture.storage.values.values()].join("\n");
    expect(persisted).not.toContain(fixture.client.calls[0]?.sources[0]?.leaseToken ?? "missing-token");
    expect(await fixture.stateStore.read()).toEqual([{
      ...source,
      lastSuccessfulSync: fixture.nowValue.current,
      pending: null,
    }]);
  });

  test("releases only after the final local profile unfollows", async () => {
    const fixture = setup();
    await fixture.follows.follow("owner", source.providerSourceId);
    await fixture.follows.follow("standard", source.providerSourceId);
    await fixture.coordinator.reconcile("local_change");

    await fixture.follows.unfollow("owner", source.providerSourceId);
    await fixture.coordinator.reconcile("local_change");
    expect(fixture.client.calls.map((call) => call.action)).toEqual(["sync"]);

    await fixture.follows.unfollow("standard", source.providerSourceId);
    await fixture.coordinator.reconcile("local_change");
    expect(fixture.client.calls.map((call) => call.action)).toEqual(["sync", "release"]);
    expect(await fixture.stateStore.read()).toEqual([]);
    expect(fixture.tokenStore.values.size).toBe(0);
  });

  test("offline local actions succeed and pending work survives restart", async () => {
    const fixture = setup();
    fixture.client.status = "offline";
    await expect(fixture.follows.follow("owner", source.providerSourceId)).resolves.toBeUndefined();
    await fixture.coordinator.reconcile("local_change");
    expect((await fixture.stateStore.read())[0]?.pending).toBe("sync");

    const restartedClient = new RecordingClient();
    const restarted = createSourceLeaseCoordinator({
      followedSources: fixture.follows,
      stateStore: fixture.stateStore,
      tokenStore: fixture.tokenStore,
      client: restartedClient,
      now: () => fixture.nowValue.current + 60_000,
    });
    await restarted.reconcile("launch");
    expect(restartedClient.calls).toHaveLength(1);
    expect((await fixture.stateStore.read())[0]?.pending).toBeNull();
  });

  test("protected-storage failures never send an unrecoverable token or discard a release", async () => {
    const syncFixture = setup();
    syncFixture.tokenStore.failWrite = true;
    await syncFixture.follows.follow("owner", source.providerSourceId);
    await syncFixture.coordinator.reconcile("local_change");
    expect(syncFixture.client.calls).toHaveLength(0);
    expect((await syncFixture.stateStore.read())[0]?.pending).toBe("sync");

    const releaseFixture = setup();
    await releaseFixture.follows.follow("owner", source.providerSourceId);
    await releaseFixture.coordinator.reconcile("local_change");
    await releaseFixture.follows.unfollow("owner", source.providerSourceId);
    releaseFixture.tokenStore.failRead = true;
    await releaseFixture.coordinator.reconcile("local_change");
    expect(releaseFixture.client.calls.map((call) => call.action)).toEqual(["sync"]);
    expect((await releaseFixture.stateStore.read())[0]?.pending).toBe("release");
  });

  test("renews no more than once every seven days", async () => {
    const fixture = setup();
    await fixture.follows.follow("owner", source.providerSourceId);
    await fixture.coordinator.reconcile("launch");
    fixture.nowValue.current += SOURCE_LEASE_RENEWAL_INTERVAL_MS - 1;
    await fixture.coordinator.reconcile("foreground");
    expect(fixture.client.calls).toHaveLength(1);

    fixture.nowValue.current += 1;
    await fixture.coordinator.reconcile("foreground");
    expect(fixture.client.calls).toHaveLength(2);
    expect(fixture.tokenStore.generated).toBe(1);
  });

  test("coalesces concurrent reconciliation", async () => {
    const fixture = setup();
    await fixture.follows.follow("owner", source.providerSourceId);
    const pendingRequest: { resolve?: (result: SourceLeaseClientResult) => void } = {};
    fixture.client.reconcile = (action, sources) => {
      fixture.client.calls.push({ action, sources });
      return new Promise<SourceLeaseClientResult>((resolve) => { pendingRequest.resolve = resolve; });
    };

    const first = fixture.coordinator.reconcile("launch");
    while (fixture.client.calls.length === 0) await Promise.resolve();
    const second = fixture.coordinator.reconcile("foreground");
    expect(second).toBe(first);
    expect(pendingRequest.resolve).toBeDefined();
    pendingRequest.resolve?.({ status: "success", results: [{ ...source, status: "synced" }] });
    await Promise.all([first, second]);
    expect(fixture.client.calls).toHaveLength(1);
  });

  test("unknown sources stay pending without another attempt in the same session", async () => {
    const fixture = setup();
    fixture.client.status = "unknown";
    await fixture.follows.follow("owner", source.providerSourceId);
    await fixture.coordinator.reconcile("local_change");
    await fixture.coordinator.reconcile("local_change");
    expect(fixture.client.calls).toHaveLength(1);
    expect((await fixture.stateStore.read())[0]?.pending).toBe("sync");
  });

  test("disabled and unavailable service states never reject local reconciliation", async () => {
    for (const status of ["disabled", "offline"] as const) {
      const fixture = setup();
      fixture.client.status = status;
      await fixture.follows.follow("owner", source.providerSourceId);
      await expect(fixture.coordinator.reconcile("local_change")).resolves.toBeUndefined();
      const state: SourceLeaseMetadata | undefined = (await fixture.stateStore.read())[0];
      expect(state?.pending).toBe("sync");
    }
  });
});
