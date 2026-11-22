import { describe, expect, test } from "bun:test";
import { ViewingAllowanceService, type ViewingAllowanceRepository } from "./ViewingAllowanceService";
import { createUsageRecord, getLocalDay, OWNER_RELAXATION_DELAY_MS } from "./viewingAllowance";
import type { ProfilePlaybackLimitRecord, ProfilePlaybackUsageRecord } from "../models/viewingAllowance";
import type { Profile } from "../models/profile";

const START = new Date(2026, 8, 4, 12, 0, 0).getTime();
const owner: Profile = { id: "owner-default", name: "Owner", role: "owner", sortOrder: 0, createdAt: 0, updatedAt: 0 };
const standardA: Profile = { id: "standard-a", name: "A", role: "standard", sortOrder: 1, createdAt: START, updatedAt: START };
const standardB: Profile = { ...standardA, id: "standard-b", name: "B", sortOrder: 2 };

function limit(profileId: string, minutes: number | null): ProfilePlaybackLimitRecord {
  return { profileId, dailyLimitMinutes: minutes, pendingDailyLimitMinutes: null, pendingActivatesAt: null, updatedAt: START };
}

function memoryRepository(limits: ProfilePlaybackLimitRecord[] = [], usage: ProfilePlaybackUsageRecord[] = []): ViewingAllowanceRepository & { limits: Map<string, ProfilePlaybackLimitRecord>; usage: Map<string, ProfilePlaybackUsageRecord> } {
  return {
    limits: new Map(limits.map((item) => [item.profileId, { ...item }])),
    usage: new Map(usage.map((item) => [item.profileId, { ...item }])),
    async readLimit(profileId: string) { return this.limits.get(profileId) ?? null; },
    async writeLimit(record: ProfilePlaybackLimitRecord) { this.limits.set(record.profileId, { ...record }); },
    async readUsage(profileId: string) { return this.usage.get(profileId) ?? null; },
    async writeUsage(record: ProfilePlaybackUsageRecord) { this.usage.set(record.profileId, { ...record }); },
  };
}

describe("per-profile viewing allowance", () => {
  test("keeps usage isolated by stable profile id", async () => {
    const repository = memoryRepository([limit(standardA.id, 30), limit(standardB.id, 30)]);
    const service = new ViewingAllowanceService(repository);
    await service.beginPlaying(standardA, START);
    await service.stopPlaying(START + 12_000);
    expect(repository.usage.get(standardA.id)?.consumedSeconds).toBe(12);
    expect(repository.usage.get(standardB.id)?.consumedSeconds ?? 0).toBe(0);
  });

  test("counts only active playback", async () => {
    const repository = memoryRepository([limit(standardA.id, 30)]);
    const service = new ViewingAllowanceService(repository);
    await service.getStatus(standardA, START);
    await service.beginPlaying(standardA, START + 5_000);
    await service.checkpoint(START + 20_000);
    expect(repository.usage.get(standardA.id)?.consumedSeconds).toBe(15);
  });

  test("persists once on pause, background, player exit, and repeated stop events", async () => {
    const repository = memoryRepository([limit(standardA.id, 30)]);
    const service = new ViewingAllowanceService(repository);
    await service.beginPlaying(standardA, START);
    await service.stopPlaying(START + 7_000);
    await service.stopPlaying(START + 9_000);
    expect(repository.usage.get(standardA.id)?.consumedSeconds).toBe(7);
    await service.beginPlaying(standardA, START + 20_000);
    await service.stopPlaying(START + 23_000);
    expect(repository.usage.get(standardA.id)?.consumedSeconds).toBe(10);
  });

  test("resets on a forward local day and never resets on a backward date", async () => {
    const prior = { ...createUsageRecord(standardA.id, START), consumedSeconds: 600 };
    const repository = memoryRepository([limit(standardA.id, 30)], [prior]);
    const service = new ViewingAllowanceService(repository);
    await service.getStatus(standardA, START - 24 * 60 * 60_000);
    expect(repository.usage.get(standardA.id)?.consumedSeconds).toBe(600);
    await service.getStatus(standardA, START + 24 * 60 * 60_000);
    expect(repository.usage.get(standardA.id)?.consumedSeconds).toBe(0);
    expect(repository.usage.get(standardA.id)?.dayKey).toBe(getLocalDay(START + 24 * 60 * 60_000).key);
  });

  test("blocks playback at zero across service restarts", async () => {
    const used = { ...createUsageRecord(standardA.id, START), consumedSeconds: 60 };
    const repository = memoryRepository([limit(standardA.id, 1)], [used]);
    expect((await new ViewingAllowanceService(repository).beginPlaying(standardA, START)).canPlay).toBeFalse();
    expect((await new ViewingAllowanceService(repository).getStatus(standardA, START + 1_000)).kind).toBe("complete");
  });

  test("claims five-minute and one-minute warnings only once per local day", async () => {
    const repository = memoryRepository([limit(standardA.id, 5)]);
    const service = new ViewingAllowanceService(repository);
    const first = await service.beginPlaying(standardA, START);
    expect(first.kind === "limited" ? first.warning : undefined).toBe("fiveMinutes");
    await service.stopPlaying(START);
    const second = await service.beginPlaying(standardA, START + 1_000);
    expect(second.kind === "limited" ? second.warning : undefined).toBeUndefined();
    await service.stopPlaying(START + 1_000);
    const usage = repository.usage.get(standardA.id);
    if (!usage) throw new Error("usage missing");
    repository.usage.set(standardA.id, { ...usage, consumedSeconds: 4 * 60, warnedOne: 0 });
    const one = await service.beginPlaying(standardA, START + 2_000);
    expect(one.kind === "limited" ? one.warning : undefined).toBe("oneMinute");
  });

  test("delays only Owner increases and disabling for 24 hours", async () => {
    const repository = memoryRepository();
    const service = new ViewingAllowanceService(repository);
    expect((await service.setAllowance(owner, { mode: "dailyLimit", minutes: 30 }, START)).kind).toBe("limited");
    const pending = await service.setAllowance(owner, { mode: "dailyLimit", minutes: 60 }, START + 1_000);
    expect(pending.kind === "limited" ? pending.allowanceMinutes : 0).toBe(30);
    expect(repository.limits.get(owner.id)?.pendingActivatesAt).toBe(START + 1_000 + OWNER_RELAXATION_DELAY_MS);
    expect((await service.getStatus(owner, START + OWNER_RELAXATION_DELAY_MS)).kind).toBe("limited");
    expect((await service.getStatus(owner, START + 1_000 + OWNER_RELAXATION_DELAY_MS)).kind).toBe("limited");
    expect(repository.limits.get(owner.id)?.dailyLimitMinutes).toBe(60);
    const disabling = await service.setAllowance(owner, { mode: "unlimited" }, START + 2_000 + OWNER_RELAXATION_DELAY_MS);
    expect(disabling.kind).toBe("limited");
  });

  test("applies Standard changes immediately and leaves unlimited profiles unchanged", async () => {
    const repository = memoryRepository();
    const service = new ViewingAllowanceService(repository);
    expect((await service.getStatus(standardA, START)).kind).toBe("unlimited");
    await service.beginPlaying(standardA, START);
    await service.stopPlaying(START + 60_000);
    expect(repository.usage.has(standardA.id)).toBeFalse();
    expect((await service.setAllowance(standardA, { mode: "dailyLimit", minutes: 45 }, START)).kind).toBe("limited");
    expect(repository.limits.get(standardA.id)?.dailyLimitMinutes).toBe(45);
    expect((await service.setAllowance(standardA, { mode: "unlimited" }, START + 1_000)).kind).toBe("unlimited");
  });
});

test("a new flexible Owner limit changes immediately while existing commitments cannot be bypassed", async () => {
  const repository = memoryRepository();
  const service = new ViewingAllowanceService(repository);
  await service.setAllowance(owner, { mode: "dailyLimit", minutes: 30, commitment: false }, START);
  const changed = await service.setAllowance(owner, { mode: "dailyLimit", minutes: 60, commitment: false }, START + 1000);
  expect(changed).toMatchObject({ kind: "limited", allowanceMinutes: 60, commitment: false });
  expect(changed.kind === "limited" && changed.pendingChange).toBeUndefined();
  expect((await service.setAllowance(owner, { mode: "unlimited" }, START + 2000)).kind).toBe("unlimited");
  repository.limits.set(owner.id, limit(owner.id, 30)); // Pre-upgrade commitment, no flag.
  const protectedChange = await service.setAllowance(owner, { mode: "dailyLimit", minutes: 60, commitment: false }, START + 3000);
  expect(protectedChange).toMatchObject({ kind: "limited", allowanceMinutes: 30, commitment: true, pendingChange: { activatesAt: START + 3000 + OWNER_RELAXATION_DELAY_MS } });
});
