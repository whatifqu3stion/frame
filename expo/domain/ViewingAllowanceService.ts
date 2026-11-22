import { applyDuePendingLimit, claimWarning, createUsageRecord, reconcileUsage, requestLimitChange, statusFromRecords } from "@/domain/viewingAllowance";
import type { ProfilePlaybackLimitRecord, ProfilePlaybackUsageRecord, ViewingAllowance, ViewingAllowanceStatus } from "@/models/viewingAllowance";
import type { Profile } from "@/models/profile";

export type ViewingAllowanceRepository = {
  readLimit(profileId: string): Promise<ProfilePlaybackLimitRecord | null>;
  writeLimit(record: ProfilePlaybackLimitRecord): Promise<void>;
  readUsage(profileId: string): Promise<ProfilePlaybackUsageRecord | null>;
  writeUsage(record: ProfilePlaybackUsageRecord): Promise<void>;
};

/** Shared local boundary for profile playback authorization, accounting, warnings, rollover, and Owner delay. */
export class ViewingAllowanceService {
  private operation: Promise<unknown> = Promise.resolve();
  private active: { profileId: string; limit: ProfilePlaybackLimitRecord; usage: ProfilePlaybackUsageRecord; startedAt: number } | null = null;
  private observed: { profileId: string; startedAt: number } | null = null;

  constructor(private readonly repository: ViewingAllowanceRepository, private readonly recordViewing?: (profileId: string, from: number, to: number) => Promise<void>) {}

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.operation.then(work, work);
    this.operation = result.catch(() => undefined);
    return result;
  }

  private async load(profile: Profile, now: number): Promise<{ limit: ProfilePlaybackLimitRecord | null; usage: ProfilePlaybackUsageRecord | null; status: ViewingAllowanceStatus }> {
    let limit = await this.repository.readLimit(profile.id);
    if (!limit) return { limit: null, usage: null, status: { kind: "unlimited", canPlay: true } };
    const due = applyDuePendingLimit(limit, now);
    limit = due.record;
    if (due.didActivate) await this.repository.writeLimit(limit);
    if (limit.dailyLimitMinutes === null) return { limit, usage: null, status: statusFromRecords(limit, null) };
    let usage = await this.repository.readUsage(profile.id);
    if (!usage) {
      usage = createUsageRecord(profile.id, now);
      await this.repository.writeUsage(usage);
    } else {
      const storedLastSeenAt = usage.lastSeenAt;
      const reconciled = reconcileUsage(usage, now);
      usage = reconciled.record;
      if (reconciled.didRollover || usage.lastSeenAt !== storedLastSeenAt) await this.repository.writeUsage(usage);
    }
    return { limit, usage, status: statusFromRecords(limit, usage) };
  }

  getStatus(profile: Profile, now: number = Date.now()): Promise<ViewingAllowanceStatus> {
    return this.enqueue(async () => (await this.load(profile, now)).status);
  }

  beginPlaying(profile: Profile, now: number = Date.now()): Promise<ViewingAllowanceStatus> {
    return this.enqueue(async () => {
      await this.stopInternal(now);
      const loaded = await this.load(profile, now);
      if (loaded.status.canPlay && this.recordViewing) this.observed = { profileId: profile.id, startedAt: now };
      if (!loaded.limit || !loaded.usage || !loaded.status.canPlay || loaded.status.kind === "unlimited") return loaded.status;
      const claimed = claimWarning(loaded.usage, loaded.status);
      if (claimed.warning) await this.repository.writeUsage({ ...claimed.usage, updatedAt: now });
      this.active = { profileId: profile.id, limit: loaded.limit, usage: claimed.usage, startedAt: now };
      return loaded.status.kind === "limited" && claimed.warning ? { ...loaded.status, warning: claimed.warning } : loaded.status;
    });
  }

  checkpoint(now: number = Date.now()): Promise<ViewingAllowanceStatus> { return this.enqueue(() => this.checkpointInternal(now, false)); }
  stopPlaying(now: number = Date.now()): Promise<ViewingAllowanceStatus | null> { return this.enqueue(() => this.stopInternal(now)); }

  private async checkpointInternal(now: number, stop: boolean): Promise<ViewingAllowanceStatus> {
    const observed = this.observed;
    if (observed) {
      this.observed = stop ? null : { ...observed, startedAt: Math.max(observed.startedAt, now) };
      // Awareness must never weaken or block the independent playback boundary.
      await this.recordViewing?.(observed.profileId, observed.startedAt, now).catch(() => undefined);
    }
    const active = this.active;
    if (!active) return { kind: "unlimited", canPlay: true };
    const reconciled = reconcileUsage(active.usage, now);
    const elapsedStart = reconciled.didRollover ? Math.max(active.startedAt, reconciled.record.dayStartedAt) : active.startedAt;
    const elapsed = Math.max(0, Math.floor((now - elapsedStart) / 1_000));
    let usage = { ...reconciled.record, consumedSeconds: reconciled.record.consumedSeconds + elapsed, lastSeenAt: Math.max(reconciled.record.lastSeenAt, now), updatedAt: now };
    const due = applyDuePendingLimit(active.limit, now);
    const limit = due.record;
    if (due.didActivate) await this.repository.writeLimit(limit);
    let status = statusFromRecords(limit, usage);
    const claimed = claimWarning(usage, status);
    usage = claimed.usage;
    if (claimed.warning && status.kind === "limited") status = { ...status, warning: claimed.warning };
    await this.repository.writeUsage(usage);
    this.active = stop || !status.canPlay || status.kind === "unlimited" ? null : { ...active, limit, usage, startedAt: now };
    if (!status.canPlay) this.observed = null;
    return status;
  }

  private async stopInternal(now: number): Promise<ViewingAllowanceStatus | null> {
    if (!this.active && !this.observed) return null;
    return this.checkpointInternal(now, true);
  }

  setAllowance(profile: Profile, allowance: ViewingAllowance, now: number = Date.now()): Promise<ViewingAllowanceStatus> {
    return this.enqueue(async () => {
      if (this.active?.profileId === profile.id || this.observed?.profileId === profile.id) await this.stopInternal(now);
      const current = await this.repository.readLimit(profile.id);
      const record = requestLimitChange(profile, current, allowance, now);
      await this.repository.writeLimit(record);
      if (record.dailyLimitMinutes !== null && !(await this.repository.readUsage(profile.id))) await this.repository.writeUsage(createUsageRecord(profile.id, now));
      return (await this.load(profile, now)).status;
    });
  }

  cancelPendingOwnerChange(profile: Profile, now: number = Date.now()): Promise<ViewingAllowanceStatus> {
    return this.enqueue(async () => {
      if (profile.role !== "owner") throw new Error("Only the Owner profile can have a delayed relaxation.");
      const current = await this.repository.readLimit(profile.id);
      if (!current?.pendingActivatesAt) return (await this.load(profile, now)).status;
      await this.repository.writeLimit({ ...current, pendingDailyLimitMinutes: null, pendingActivatesAt: null, updatedAt: now });
      return (await this.load(profile, now)).status;
    });
  }
}
