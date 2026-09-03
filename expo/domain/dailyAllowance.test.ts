import { describe, expect, test } from "bun:test";
import { DailyAllowanceService, type DailyAllowanceRepository } from "./DailyAllowanceService";
import {
  createManagedAllowanceRecord,
  getLocalDay,
  reconcileManagedAllowanceRecord,
  statusForProfile,
  validateManagedAllowance,
} from "./dailyAllowance";
import type { ManagedAllowanceRecord } from "../models/dailyAllowance";
import type { Profile } from "../models/profile";

const START = new Date(2026, 8, 3, 12, 0, 0).getTime();
const managed: Profile = { id: "managed-a", name: "Kid", role: "managed", sortOrder: 1, createdAt: START, updatedAt: START };
const managedB: Profile = { ...managed, id: "managed-b", name: "Kid B", sortOrder: 2 };
const owner: Profile = { id: "owner-default", name: "Owner", role: "owner", sortOrder: 0, createdAt: 0, updatedAt: 0 };
const standard: Profile = { ...managed, id: "standard-a", name: "Standard", role: "standard" };

function memoryRepository(initial: ManagedAllowanceRecord[] = []): DailyAllowanceRepository & { records: Map<string, ManagedAllowanceRecord>; writes: number } {
  const repository = {
    records: new Map(initial.map((record) => [record.profileId, { ...record }])),
    writes: 0,
    async read(profileId: string): Promise<ManagedAllowanceRecord | null> { return this.records.get(profileId) ?? null; },
    async write(record: ManagedAllowanceRecord): Promise<void> { this.writes += 1; this.records.set(record.profileId, { ...record }); },
  };
  return repository;
}

describe("Daily Frame allowance domain", () => {
  test("keeps Unlimited explicit and validates positive Daily Limit minutes", () => {
    const unlimited = createManagedAllowanceRecord(managed.id, { mode: "unlimited" }, START);
    const limited = createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, START);
    expect(unlimited.mode).toBe("unlimited");
    expect(unlimited.dailyLimitMinutes).toBeNull();
    expect(limited.mode).toBe("dailyLimit");
    expect(limited.dailyLimitMinutes).toBe(30);
    expect(validateManagedAllowance({ mode: "dailyLimit", minutes: 0 })).not.toBeNull();
  });

  test("blocks missing, malformed allowance, and malformed rollover state", () => {
    expect(statusForProfile(managed, null).kind).toBe("ownerReview");
    const malformed = { ...createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, START), mode: "future-mode" };
    expect(reconcileManagedAllowanceRecord(malformed, START).ok).toBeFalse();
    const brokenClock = { ...createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, START), dayKey: "not-a-day" };
    expect(reconcileManagedAllowanceRecord(brokenClock, START).ok).toBeFalse();
  });

  test("rolls over on a genuine next local day but not after a backward clock", () => {
    const record = { ...createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, START), consumedSeconds: 600 };
    const nextDay = reconcileManagedAllowanceRecord(record, START + 24 * 60 * 60 * 1000);
    expect(nextDay.ok && nextDay.didRollover).toBeTrue();
    if (nextDay.ok) expect(nextDay.record.consumedSeconds).toBe(0);
    const backward = reconcileManagedAllowanceRecord(record, START - 60 * 60 * 1000);
    expect(backward.ok && backward.didRollover).toBeFalse();
    if (backward.ok) expect(backward.record.consumedSeconds).toBe(600);
    expect(getLocalDay(START).key).not.toBe(getLocalDay(START + 24 * 60 * 60 * 1000).key);
  });

  test("does not grant a rollover for a timezone-like calendar jump shorter than twenty hours", () => {
    const day = getLocalDay(START);
    const shiftedRecord = {
      ...createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, START),
      dayKey: "2026-09-02",
      dayStartedAt: day.startedAt - 2 * 60 * 60 * 1000,
      consumedSeconds: 600,
    };
    const result = reconcileManagedAllowanceRecord(shiftedRecord, START + 1_000);
    expect(result.ok && result.didRollover).toBeFalse();
    if (result.ok) expect(result.record.consumedSeconds).toBe(600);
  });
});

describe("central Daily Frame allowance service", () => {
  test("counts only active segments and checkpoints pause, buffering, seeking, background, navigation, and profile switch stops", async () => {
    const repository = memoryRepository([createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, START)]);
    const service = new DailyAllowanceService(repository);
    await service.beginPlaying(managed, START);
    await service.checkpoint(START + 10_000);
    await service.stopPlaying(START + 15_000);
    const afterPause = repository.records.get(managed.id)?.consumedSeconds;
    expect(afterPause).toBe(15);
    await service.stopPlaying(START + 25_000);
    await service.getStatus(managed, START + 30_000);
    expect(repository.records.get(managed.id)?.consumedSeconds).toBe(15);
    for (const offset of [40_000, 50_000, 60_000, 70_000]) {
      await service.beginPlaying(managed, START + offset);
      await service.stopPlaying(START + offset + 2_000);
    }
    expect(repository.records.get(managed.id)?.consumedSeconds).toBe(23);
  });

  test("persists five-minute and one-minute warnings only once and chooses the nearest warning", async () => {
    const fiveRecord = createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 5 }, START);
    const repository = memoryRepository([fiveRecord]);
    const service = new DailyAllowanceService(repository);
    const first = await service.beginPlaying(managed, START);
    expect(first.kind === "limited" ? first.warning : undefined).toBe("fiveMinutes");
    await service.stopPlaying(START);
    const second = await service.beginPlaying(managed, START + 1_000);
    expect(second.kind === "limited" ? second.warning : undefined).toBeUndefined();

    await service.stopPlaying(START + 1_000);
    repository.records.set(managed.id, { ...fiveRecord, consumedSeconds: 250, warnedFive: 0, warnedOne: 0 });
    const nearest = await service.beginPlaying(managed, START + 2_000);
    expect(nearest.kind === "limited" ? nearest.warning : undefined).toBe("oneMinute");
  });

  test("blocks at zero and a recreated service cannot resume until time is added", async () => {
    const record = { ...createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 1 }, START), consumedSeconds: 59 };
    const repository = memoryRepository([record]);
    const service = new DailyAllowanceService(repository);
    await service.beginPlaying(managed, START);
    const complete = await service.checkpoint(START + 2_000);
    expect(complete.kind).toBe("complete");
    const relaunched = new DailyAllowanceService(repository);
    expect((await relaunched.beginPlaying(managed, START + 3_000)).canPlay).toBeFalse();
  });

  test("adds time only for today without changing the recurring allowance", async () => {
    const record = { ...createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 15 }, START), consumedSeconds: 900 };
    const repository = memoryRepository([record]);
    const service = new DailyAllowanceService(repository);
    const status = await service.addTimeForToday(managed, 15, START + 1_000);
    expect(status.kind === "limited" ? status.remainingSeconds : 0).toBe(900);
    expect(repository.records.get(managed.id)?.dailyLimitMinutes).toBe(15);
    expect(repository.records.get(managed.id)?.addedSeconds).toBe(900);
  });

  test("isolates consumed time by profile and leaves Owner and Standard unlimited", async () => {
    const repository = memoryRepository([
      createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, START),
      createManagedAllowanceRecord(managedB.id, { mode: "dailyLimit", minutes: 60 }, START),
    ]);
    const service = new DailyAllowanceService(repository);
    await service.beginPlaying(managed, START);
    await service.stopPlaying(START + 10_000);
    expect(repository.records.get(managed.id)?.consumedSeconds).toBe(10);
    expect(repository.records.get(managedB.id)?.consumedSeconds).toBe(0);
    expect((await service.getStatus(owner, START)).kind).toBe("unlimited");
    expect((await service.getStatus(standard, START)).kind).toBe("unlimited");
  });

  test("does not accumulate time while a Managed profile is explicitly Unlimited", async () => {
    const record = createManagedAllowanceRecord(managed.id, { mode: "unlimited" }, START);
    const repository = memoryRepository([record]);
    const service = new DailyAllowanceService(repository);
    await service.beginPlaying(managed, START);
    await service.stopPlaying(START + 60_000);
    expect(repository.records.get(managed.id)?.consumedSeconds).toBe(0);
  });

  test("charges only the new-day portion when active playback spans local midnight", async () => {
    const beforeMidnight = new Date(2026, 8, 3, 23, 59, 55).getTime();
    const record = createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, beforeMidnight);
    const repository = memoryRepository([record]);
    const service = new DailyAllowanceService(repository);
    await service.beginPlaying(managed, beforeMidnight);
    await service.checkpoint(beforeMidnight + 10_000);
    expect(repository.records.get(managed.id)?.consumedSeconds).toBe(5);
    expect(repository.records.get(managed.id)?.dayKey).toBe(getLocalDay(beforeMidnight + 10_000).key);
  });

  test("changes recurring mode explicitly and repairs malformed state only through an Owner-facing update", async () => {
    const malformed = { ...createManagedAllowanceRecord(managed.id, { mode: "dailyLimit", minutes: 30 }, START), dayKey: "bad" };
    const repository = memoryRepository([malformed]);
    const service = new DailyAllowanceService(repository);
    expect((await service.getStatus(managed, START)).kind).toBe("ownerReview");
    expect((await service.setRecurringAllowance(managed, { mode: "unlimited" }, START)).kind).toBe("unlimited");
    expect(repository.records.get(managed.id)?.mode).toBe("unlimited");
  });
});
