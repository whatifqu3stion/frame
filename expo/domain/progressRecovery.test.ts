import { expect, test } from "bun:test";
import { createProgressRecovery } from "./progressRecovery";

const tick = () => new Promise(resolve => setTimeout(resolve, 5));

test("a final write failing after route unmount remains visible and retryable elsewhere", async () => {
  const recovery = createProgressRecovery();
  const writer = recovery.getWriter("owner", "video");
  const leave = writer.retain();
  let reject!: (reason: Error) => void;
  let fail = true, saved = 0, updates = 0;
  recovery.subscribe(() => { updates++; });
  const pending = writer.write(async () => {
    if (fail) await new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
    saved = 42;
  });
  await Promise.resolve();
  leave(); await tick();
  reject(Error("disk full")); await pending;
  expect(recovery.failures("owner")).toHaveLength(1);
  expect(updates).toBeGreaterThan(0);
  fail = false;
  await recovery.retry("owner");
  expect(saved).toBe(42);
  expect(recovery.failures("owner")).toHaveLength(0);
  expect(recovery.getWriter("owner", "video")).not.toBe(writer);
});

test("returning to the video reuses ordering; an old retry cannot overwrite its newer checkpoint", async () => {
  const recovery = createProgressRecovery();
  const writer = recovery.getWriter("owner", "video"); const leave = writer.retain();
  let fail = true, saved = 0;
  await writer.write(async () => { if (fail) throw Error("disk"); saved = 10; });
  leave(); await tick();
  const returned = recovery.getWriter("owner", "video"); const leaveAgain = returned.retain();
  expect(returned).toBe(writer); fail = false;
  await Promise.all([returned.write(async () => { saved = 80; }), recovery.retry("owner")]);
  expect(saved).toBe(80); leaveAgain();
});

test("retry and visibility are scoped to the active profile", async () => {
  const recovery = createProgressRecovery(); let fail = true; const writes: string[] = [];
  for (const profile of ["owner", "viewer"]) {
    await recovery.getWriter(profile, "same-video").write(async () => { if (fail) throw Error("disk"); writes.push(profile); });
  }
  fail = false; await recovery.retry("viewer");
  expect(writes).toEqual(["viewer"]);
  expect(recovery.failures("owner")).toHaveLength(1);
  expect(recovery.failures("viewer")).toHaveLength(0);
});

test("reset drains in-flight storage and retires old handles before data deletion", async () => {
  const recovery = createProgressRecovery(); const writer = recovery.getWriter("owner", "video");
  const release = writer.retain(); const events: string[] = [];
  let finish!: () => void;
  const pending = writer.write(async () => { await new Promise<void>(resolve => { finish = resolve; }); events.push("save"); });
  await Promise.resolve();
  const reset = recovery.discard().then(() => { events.push("delete"); });
  await writer.write(async () => { events.push("stale cleanup"); });
  expect(events).toEqual([]);
  finish(); await Promise.all([pending, reset]);
  await writer.retry(); await writer.write(async () => { events.push("resurrect"); }); release();
  expect(events).toEqual(["save", "delete"]);
  expect(recovery.failures("owner")).toHaveLength(0);
  const fresh = recovery.getWriter("owner", "video");
  await fresh.write(async () => { events.push("new viewing"); });
  expect(events.at(-1)).toBe("new viewing");
});

test("deleting one profile drops its failed completion without discarding another profile", async () => {
  const recovery = createProgressRecovery(); let fail = true; const completed: string[] = [];
  for (const profile of ["owner", "viewer"]) {
    await recovery.getWriter(profile, "video").write(async () => { if (fail) throw Error("disk"); completed.push(profile); });
  }
  await recovery.discard("viewer"); fail = false;
  await recovery.retry("viewer"); await recovery.retry("owner");
  expect(completed).toEqual(["owner"]);
});

test("a video checkpoint cannot clear a session timer failure with the same entity ID", async () => {
  const recovery = createProgressRecovery();
  const timer = recovery.getWriter("owner", "same", "session");
  const video = recovery.getWriter("owner", "same");
  await timer.write(async () => { throw Error("timer disk failure"); });
  await video.write(async () => {});
  expect(recovery.failures("owner")).toHaveLength(1);
  expect(recovery.failures("owner")[0].kind).toBe("session");
  await recovery.discard("owner");
  expect(recovery.failures("owner")).toHaveLength(0);
});
