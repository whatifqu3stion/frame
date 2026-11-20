import { expect, test } from "bun:test";
import { createProgressWriter } from "./progressWriter";
test("failed checkpoint remains visible and retryable until a successful commit", async () => {
  const writer = createProgressWriter(); let fail = true, saved = 0;
  await writer.write(async () => { if (fail) throw Error("disk"); saved = 42; });
  expect(writer.getSnapshot()).toEqual({ error: true, retrying: false }); await expect(writer.flush()).rejects.toThrow();
  fail = false; await writer.retry(); await writer.flush(); expect(saved).toBe(42); expect(writer.getSnapshot().error).toBe(false);
});
test("retry cannot overwrite a newer queued checkpoint", async () => {
  const writer = createProgressWriter(); let fail = true, saved = 0;
  await writer.write(async () => { if (fail) throw Error("disk"); saved = 10; }); fail = false;
  const newer = writer.write(async () => { saved = 80; }); const retry = writer.retry(); await Promise.all([newer, retry]);
  expect(saved).toBe(80); expect(writer.getSnapshot()).toEqual({ error: false, retrying: false });
});
test("completion failure recovers without breaking subsequent writes", async () => {
  const writer = createProgressWriter(); let fail = true; const events: string[] = [];
  await writer.write(async () => { events.push("resume"); });
  await writer.write(async () => { if (fail) throw Error("disk"); events.push("complete"); }); expect(writer.getSnapshot().error).toBe(true);
  fail = false; await writer.retry(); expect(events).toEqual(["resume", "complete"]); await writer.flush();
});
