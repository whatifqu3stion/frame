import {
  claimAllowanceWarning,
  createManagedAllowanceRecord,
  reconcileManagedAllowanceRecord,
  statusForProfile,
  updateRecurringAllowance,
} from "@/domain/dailyAllowance";
import type { DailyAllowanceStatus, ManagedAllowance, ManagedAllowanceRecord } from "@/models/dailyAllowance";
import type { Profile } from "@/models/profile";

export type DailyAllowanceRepository = {
  read(profileId: string): Promise<ManagedAllowanceRecord | null>;
  write(record: ManagedAllowanceRecord): Promise<void>;
};

/** Single local boundary for Managed playback authorization, accounting, warnings, and rollover. */
export class DailyAllowanceService {
  private operation: Promise<unknown> = Promise.resolve();
  private active: { profile: Profile; record: ManagedAllowanceRecord; startedAt: number } | null = null;

  constructor(private readonly repository: DailyAllowanceRepository) {}

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.operation.then(work, work);
    this.operation = result.catch(() => undefined);
    return result;
  }

  private async loadManaged(profile: Profile, now: number): Promise<{ record: ManagedAllowanceRecord; status: DailyAllowanceStatus } | { status: DailyAllowanceStatus }> {
    const stored = await this.repository.read(profile.id);
    if (!stored) return { status: statusForProfile(profile, null) };
    const reconciled = reconcileManagedAllowanceRecord(stored, now);
    if (!reconciled.ok) return { status: { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: reconciled.reason } };
    if (reconciled.didRollover || reconciled.record.lastSeenAt !== stored.lastSeenAt) await this.repository.write(reconciled.record);
    return { record: reconciled.record, status: statusForProfile(profile, reconciled.record) };
  }

  getStatus(profile: Profile, now: number = Date.now()): Promise<DailyAllowanceStatus> {
    return this.enqueue(async () => {
      if (profile.role !== "managed") return { kind: "unlimited", canPlay: true };
      return (await this.loadManaged(profile, now)).status;
    });
  }

  beginPlaying(profile: Profile, now: number = Date.now()): Promise<DailyAllowanceStatus> {
    return this.enqueue(async () => {
      await this.stopInternal(now);
      if (profile.role !== "managed") return { kind: "unlimited", canPlay: true };
      const loaded = await this.loadManaged(profile, now);
      if (!("record" in loaded) || !loaded.status.canPlay || loaded.status.kind === "unlimited") return loaded.status;
      const claimed = claimAllowanceWarning(loaded.record, loaded.status);
      const record = { ...claimed.record, updatedAt: now };
      if (claimed.warning) await this.repository.write(record);
      this.active = { profile, record, startedAt: now };
      return loaded.status.kind === "limited" && claimed.warning
        ? { ...loaded.status, warning: claimed.warning }
        : loaded.status;
    });
  }

  checkpoint(now: number = Date.now()): Promise<DailyAllowanceStatus> {
    return this.enqueue(() => this.checkpointInternal(now, false));
  }

  stopPlaying(now: number = Date.now()): Promise<DailyAllowanceStatus | null> {
    return this.enqueue(() => this.stopInternal(now));
  }

  private async checkpointInternal(now: number, stop: boolean): Promise<DailyAllowanceStatus> {
    const active = this.active;
    if (!active) return { kind: "unlimited", canPlay: true };
    const reconciled = reconcileManagedAllowanceRecord(active.record, now);
    if (!reconciled.ok) {
      this.active = null;
      return { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: reconciled.reason };
    }
    const elapsedStart = reconciled.didRollover ? Math.max(active.startedAt, reconciled.record.dayStartedAt) : active.startedAt;
    const elapsed = Math.max(0, Math.floor((now - elapsedStart) / 1000));
    let record = {
      ...reconciled.record,
      consumedSeconds: reconciled.record.consumedSeconds + elapsed,
      lastSeenAt: Math.max(reconciled.record.lastSeenAt, now),
      updatedAt: now,
    };
    let status = statusForProfile(active.profile, record);
    const claimed = claimAllowanceWarning(record, status);
    record = claimed.record;
    status = claimed.warning && status.kind === "limited" ? { ...status, warning: claimed.warning } : status;
    await this.repository.write(record);
    this.active = stop || !status.canPlay ? null : { ...active, record, startedAt: now };
    return status;
  }

  private async stopInternal(now: number): Promise<DailyAllowanceStatus | null> {
    if (!this.active) return null;
    return this.checkpointInternal(now, true);
  }

  setRecurringAllowance(profile: Profile, allowance: ManagedAllowance, now: number = Date.now()): Promise<DailyAllowanceStatus> {
    return this.enqueue(async () => {
      if (profile.role !== "managed") throw new Error("Only Managed profiles have a viewing allowance.");
      if (this.active?.profile.id === profile.id) await this.stopInternal(now);
      const stored = await this.repository.read(profile.id);
      const reconciled = stored ? reconcileManagedAllowanceRecord(stored, now) : null;
      const base = reconciled?.ok ? reconciled.record : createManagedAllowanceRecord(profile.id, allowance, now);
      const record = reconciled?.ok ? updateRecurringAllowance(base, allowance, now) : base;
      await this.repository.write(record);
      return statusForProfile(profile, record);
    });
  }

  addTimeForToday(profile: Profile, minutes: number, now: number = Date.now()): Promise<DailyAllowanceStatus> {
    return this.enqueue(async () => {
      if (profile.role !== "managed" || !Number.isInteger(minutes) || minutes <= 0 || minutes > 1_440) {
        throw new Error("Choose a positive amount of time to add today.");
      }
      if (this.active?.profile.id === profile.id) await this.stopInternal(now);
      const loaded = await this.loadManaged(profile, now);
      if (!("record" in loaded)) throw new Error("Review the recurring Daily Frame time before adding time today.");
      const record = {
        ...loaded.record,
        addedSeconds: loaded.record.addedSeconds + minutes * 60,
        lastSeenAt: Math.max(loaded.record.lastSeenAt, now),
        updatedAt: now,
      };
      await this.repository.write(record);
      return statusForProfile(profile, record);
    });
  }
}
