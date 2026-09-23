import {
  controlsFromRecord,
  createPlaybackControlsRecord,
  createSessionUsageRecord,
  evaluatePlaybackControls,
  reconcileSessionUsage,
} from "@/domain/playbackControls";
import type { Profile } from "@/models/profile";
import type {
  ManagedPlaybackControls,
  PlaybackControlStatus,
  ProfilePlaybackControlsRecord,
  ProfileSessionUsageRecord,
} from "@/models/playbackControls";

export type PlaybackControlsRepository = {
  readControls(profileId: string): Promise<ProfilePlaybackControlsRecord | null>;
  writeControls(record: ProfilePlaybackControlsRecord): Promise<void>;
  readSessionUsage(profileId: string): Promise<ProfileSessionUsageRecord | null>;
  writeSessionUsage(record: ProfileSessionUsageRecord): Promise<void>;
};

/** Enforces Managed-profile windows, quiet hours, pauses, and durable session breaks. */
export class PlaybackControlsService {
  private operation: Promise<unknown> = Promise.resolve();
  private active: { profile: Profile; controls: ManagedPlaybackControls; usage: ProfileSessionUsageRecord; startedAt: number } | null = null;

  constructor(private readonly repository: PlaybackControlsRepository) {}

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.operation.then(work, work);
    this.operation = result.catch(() => undefined);
    return result;
  }

  getControls(profile: Profile): Promise<ManagedPlaybackControls> {
    return this.enqueue(async () => controlsFromRecord(await this.repository.readControls(profile.id)));
  }

  setControls(profile: Profile, controls: ManagedPlaybackControls, now: number = Date.now()): Promise<PlaybackControlStatus> {
    return this.enqueue(async () => {
      if (profile.role !== "managed") throw new Error("Time controls are available only for Managed profiles.");
      if (this.active?.profile.id === profile.id) await this.stopInternal(now);
      await this.repository.writeControls(createPlaybackControlsRecord(profile.id, controls, now));
      let usage = await this.repository.readSessionUsage(profile.id);
      if (!usage || controls.sessionLimitMinutes === null) {
        usage = createSessionUsageRecord(profile.id, now);
        await this.repository.writeSessionUsage(usage);
      }
      return evaluatePlaybackControls(profile, controls, usage, now);
    });
  }

  getStatus(profile: Profile, now: number = Date.now()): Promise<PlaybackControlStatus> {
    return this.enqueue(async () => {
      if (profile.role !== "managed") return { kind: "available", canPlay: true };
      const controls = controlsFromRecord(await this.repository.readControls(profile.id));
      let usage = await this.repository.readSessionUsage(profile.id) ?? createSessionUsageRecord(profile.id, now);
      const reconciled = reconcileSessionUsage(usage, controls, now);
      usage = reconciled.record;
      if (reconciled.didReset) await this.repository.writeSessionUsage(usage);
      return evaluatePlaybackControls(profile, controls, usage, now);
    });
  }

  beginPlaying(profile: Profile, now: number = Date.now()): Promise<PlaybackControlStatus> {
    return this.enqueue(async () => {
      await this.stopInternal(now);
      if (profile.role !== "managed") return { kind: "available", canPlay: true };
      const controls = controlsFromRecord(await this.repository.readControls(profile.id));
      let usage = await this.repository.readSessionUsage(profile.id) ?? createSessionUsageRecord(profile.id, now);
      const reconciled = reconcileSessionUsage(usage, controls, now);
      usage = reconciled.record;
      if (reconciled.didReset) await this.repository.writeSessionUsage(usage);
      const status = evaluatePlaybackControls(profile, controls, usage, now);
      if (status.canPlay) this.active = { profile, controls, usage, startedAt: now };
      return status;
    });
  }

  checkpoint(now: number = Date.now()): Promise<PlaybackControlStatus> {
    return this.enqueue(() => this.checkpointInternal(now, false));
  }

  stopPlaying(now: number = Date.now()): Promise<PlaybackControlStatus | null> {
    return this.enqueue(() => this.stopInternal(now));
  }

  private async checkpointInternal(now: number, stop: boolean): Promise<PlaybackControlStatus> {
    const active = this.active;
    if (!active) return { kind: "available", canPlay: true };
    const elapsed = Math.max(0, Math.floor((now - active.startedAt) / 1_000));
    let usage: ProfileSessionUsageRecord = {
      ...active.usage,
      consumedSeconds: active.usage.consumedSeconds + elapsed,
      lastPlaybackAt: now,
      updatedAt: now,
    };
    const limitSeconds = active.controls.sessionLimitMinutes === null ? null : active.controls.sessionLimitMinutes * 60;
    if (limitSeconds !== null && usage.consumedSeconds >= limitSeconds) {
      usage = {
        ...usage,
        consumedSeconds: limitSeconds,
        lockedUntil: now + active.controls.sessionBreakMinutes * 60_000,
      };
    }
    await this.repository.writeSessionUsage(usage);
    const status = evaluatePlaybackControls(active.profile, active.controls, usage, now);
    this.active = stop || !status.canPlay ? null : { ...active, usage, startedAt: now };
    return status;
  }

  private async stopInternal(now: number): Promise<PlaybackControlStatus | null> {
    if (!this.active) return null;
    return this.checkpointInternal(now, true);
  }
}
