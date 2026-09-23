import { describe, expect, test } from "bun:test";
import { PlaybackControlsService, type PlaybackControlsRepository } from "./PlaybackControlsService";
import {
  DEFAULT_MANAGED_PLAYBACK_CONTROLS,
  INDEFINITE_PAUSE,
  createPlaybackControlsRecord,
  createSessionUsageRecord,
  evaluatePlaybackControls,
  isMinuteInsideWindow,
  reconcileSessionUsage,
  validateManagedPlaybackControls,
} from "./playbackControls";
import type { Profile } from "../models/profile";
import type { ProfilePlaybackControlsRecord, ProfileSessionUsageRecord } from "../models/playbackControls";

const START = new Date(2026, 8, 23, 12, 0, 0).getTime();
const managed: Profile = { id: "managed-a", name: "Managed", role: "managed", sortOrder: 1, createdAt: START, updatedAt: START };
const standard: Profile = { ...managed, id: "standard-a", name: "Standard", role: "standard" };

function memoryRepository(): PlaybackControlsRepository & { controls: Map<string, ProfilePlaybackControlsRecord>; usage: Map<string, ProfileSessionUsageRecord> } {
  return {
    controls: new Map(), usage: new Map(),
    async readControls(profileId) { return this.controls.get(profileId) ?? null; },
    async writeControls(record) { this.controls.set(record.profileId, { ...record }); },
    async readSessionUsage(profileId) { return this.usage.get(profileId) ?? null; },
    async writeSessionUsage(record) { this.usage.set(record.profileId, { ...record }); },
  };
}

describe("Managed playback controls", () => {
  test("handles daytime and overnight windows without treating equal times as all day", () => {
    expect(isMinuteInsideWindow(9 * 60, { startMinute: 7 * 60, endMinute: 20 * 60 })).toBeTrue();
    expect(isMinuteInsideWindow(22 * 60, { startMinute: 21 * 60, endMinute: 7 * 60 })).toBeTrue();
    expect(isMinuteInsideWindow(6 * 60, { startMinute: 21 * 60, endMinute: 7 * 60 })).toBeTrue();
    expect(isMinuteInsideWindow(12 * 60, { startMinute: 21 * 60, endMinute: 7 * 60 })).toBeFalse();
    expect(validateManagedPlaybackControls({ ...DEFAULT_MANAGED_PLAYBACK_CONTROLS, allowedWindow: { startMinute: 600, endMinute: 600 } })).toContain("different");
  });

  test("fails closed for invalid stored controls and honors finite and indefinite pauses", () => {
    const usage = createSessionUsageRecord(managed.id, START);
    expect(evaluatePlaybackControls(managed, { ...DEFAULT_MANAGED_PLAYBACK_CONTROLS, pausedUntil: START + 60_000 }, usage, START).kind).toBe("paused");
    expect(evaluatePlaybackControls(managed, { ...DEFAULT_MANAGED_PLAYBACK_CONTROLS, pausedUntil: INDEFINITE_PAUSE }, usage, START).kind).toBe("paused");
    expect(() => createPlaybackControlsRecord(managed.id, { ...DEFAULT_MANAGED_PLAYBACK_CONTROLS, sessionLimitMinutes: 0 }, START)).toThrow();
  });

  test("resets a continuous session only after the configured break", () => {
    const controls = { ...DEFAULT_MANAGED_PLAYBACK_CONTROLS, sessionLimitMinutes: 30, sessionBreakMinutes: 15 };
    const usage = { ...createSessionUsageRecord(managed.id, START), lastPlaybackAt: START, consumedSeconds: 600 };
    expect(reconcileSessionUsage(usage, controls, START + 14 * 60_000).didReset).toBeFalse();
    expect(reconcileSessionUsage(usage, controls, START + 15 * 60_000).record.consumedSeconds).toBe(0);
  });

  test("persists session use, blocks at the limit, and restores after the break", async () => {
    const repository = memoryRepository();
    const service = new PlaybackControlsService(repository);
    await service.setControls(managed, { ...DEFAULT_MANAGED_PLAYBACK_CONTROLS, sessionLimitMinutes: 1, sessionBreakMinutes: 15 }, START);
    expect((await service.beginPlaying(managed, START)).canPlay).toBeTrue();
    const blocked = await service.checkpoint(START + 60_000);
    expect(blocked.kind).toBe("sessionBreak");
    expect(repository.usage.get(managed.id)?.consumedSeconds).toBe(60);
    expect((await new PlaybackControlsService(repository).getStatus(managed, START + 15 * 60_000)).canPlay).toBeFalse();
    expect((await new PlaybackControlsService(repository).getStatus(managed, START + 16 * 60_000)).canPlay).toBeTrue();
  });

  test("keeps profiles isolated and never applies Managed schedules to Standard profiles", async () => {
    const repository = memoryRepository();
    const service = new PlaybackControlsService(repository);
    await service.setControls(managed, { ...DEFAULT_MANAGED_PLAYBACK_CONTROLS, pausedUntil: INDEFINITE_PAUSE }, START);
    expect((await service.getStatus(managed, START)).canPlay).toBeFalse();
    expect((await service.getStatus(standard, START)).canPlay).toBeTrue();
    expect(repository.controls.has(standard.id)).toBeFalse();
  });
});
