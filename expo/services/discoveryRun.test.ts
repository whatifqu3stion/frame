import { expect, test } from "bun:test";
import { createDiscoveryRun } from "./discoveryRun";
import { ProviderError } from "./providerRequest";
import type { DiscoveryProgress } from "./byokWeeklyPicks";
import type { WeeklyPicksClientResult } from "./weeklyPicksClient";

const empty: WeeklyPicksClientResult = { status: "success", response: { state: "empty", interests: [] } };
function fixture() {
  let release!: () => void;
  let report!: (progress: DiscoveryProgress) => void;
  let signal!: AbortSignal;
  let calls = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const run = createDiscoveryRun({
    async generate(_ids, received, _profile, stage, progress) {
      calls++; signal = received; report = progress; stage("review");
      await pending;
      if (received.aborted) throw new ProviderError("cancelled");
    },
    async getWeeklyPicks() { return empty; },
  }, () => 123);
  return { run, release, report: (p: DiscoveryProgress) => report(p), signal: () => signal, calls: () => calls };
}
test("durable progress survives the presenting screen unsubscribing; duplicate starts do not spend again", async () => {
  const f = fixture();
  const unsub = f.run.subscribe(() => {});
  const pending = f.run.start("owner", ["science"]);
  f.report({ reviewedCount: 2, available: false });
  expect(f.run.getSnapshot()).toMatchObject({ status: "running", available: false, revision: 0 });
  f.report({ reviewedCount: 3, available: true });
  unsub();
  expect(f.run.getSnapshot()).toMatchObject({ status: "running", available: true, reviewedCount: 3, revision: 1 });
  expect(f.signal().aborted).toBe(false);
  await f.run.start("other", ["art"]);
  expect(f.calls()).toBe(1);
  f.run.cancel(); f.release(); await pending;
  expect(f.run.getSnapshot()).toMatchObject({ status: "stopped", available: true, reviewedCount: 3 });
  expect(f.run.getSnapshot().message).toContain("reviewed picks are saved");
});
test("empty results finish without inventing a ready selection", async () => {
  const f = fixture(); const pending = f.run.start("owner", ["science"]);
  f.release(); await pending;
  expect(f.run.getSnapshot()).toMatchObject({ status: "complete", available: false, reviewedCount: 0 });
});
test("unexpected failures never expose provider payloads", async () => {
  const run = createDiscoveryRun({ async generate() { throw new Error("private-provider-payload"); }, async getWeeklyPicks() { return empty; } });
  await run.start("owner", ["science"]);
  expect(run.getSnapshot().status).toBe("failed");
  expect(run.getSnapshot().message).not.toContain("private-provider-payload");
});

test("quota failure retains published picks and an explicit later attempt can recover", async () => {
  let calls = 0;
  const run = createDiscoveryRun({
    async generate(_ids, _signal, _profile, _stage, progress) {
      calls++;
      if (calls === 1) {
        progress({ reviewedCount: 3, available: true });
        throw new ProviderError("quota", "gemini", 429);
      }
    },
    async getWeeklyPicks() { return empty; },
  });
  await run.start("owner", ["science"]);
  expect(run.getSnapshot()).toMatchObject({ status: "failed", available: true, reviewedCount: 3 });
  expect(run.getSnapshot().message).toContain("reviewed picks are saved");
  expect(run.getSnapshot().message).toContain("quota");
  expect(calls).toBe(1);
  await run.start("owner", ["science"]);
  expect(calls).toBe(2);
  expect(run.getSnapshot()).toMatchObject({ status: "complete", available: false, reviewedCount: 0 });
});

test("failure reading committed results is a storage error, never a successful empty edition", async () => {
  const run = createDiscoveryRun({
    async generate() {},
    async getWeeklyPicks() { return { status: "invalid_response" }; },
  });
  await run.start("owner", ["science"]);
  expect(run.getSnapshot()).toMatchObject({ status: "failed", available: false });
  expect(run.getSnapshot().message).not.toContain("Your selection is ready");
});
