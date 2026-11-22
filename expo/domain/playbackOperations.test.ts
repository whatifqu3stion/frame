import { expect, test } from "bun:test";
import { createPlaybackOperations } from "./playbackOperations";
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
test("stop during ledger startup cleans up before next play starts", async () => {
  const gate = deferred(), entered = deferred(); const events: string[] = []; let playing = false;
  const queue = createPlaybackOperations(async () => { playing = false; events.push("stop"); });
  const first = queue.start(async () => { entered.resolve(); await gate.promise; playing = true; events.push("old-start"); return "old"; }, () => true);
  await entered.promise; const stop = queue.stop();
  const next = queue.start(async () => { playing = true; events.push("new-start"); return "new"; }, () => true);
  gate.resolve(); expect(await first).toBeNull(); await stop; expect(await next).toBe("new");
  expect(events).toEqual(["old-start", "stop", "stop", "new-start"]); expect(playing).toBe(true);
});
test("invalid intent never starts and failed startup does not poison stops", async () => {
  let started = 0, stopped = 0; const queue = createPlaybackOperations(async () => { stopped++; });
  expect(await queue.start(async () => { started++; }, () => false)).toBeNull(); expect(started).toBe(0);
  await expect(queue.start(async () => { throw Error("disk"); }, () => true)).rejects.toThrow("disk");
  await queue.stop(); expect(stopped).toBe(2);
});


test("delayed storage does not move the pause timestamp forward", async () => {
  let now = 1000;
  const gate = deferred(), entered = deferred(); const stoppedAt: number[] = [];
  const queue = createPlaybackOperations(async at => { stoppedAt.push(at); }, () => now);
  const start = queue.start(async () => { entered.resolve(); await gate.promise; }, () => true);
  await entered.promise; now = 2000; const stop = queue.stop(); now = 20000; gate.resolve();
  await start; await stop; expect(stoppedAt).toEqual([2000, 2000]);
});
