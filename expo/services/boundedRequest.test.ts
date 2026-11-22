import { expect, test } from "bun:test";
import { boundedRequest } from "./boundedRequest";
test("bounded lookup returns a completed response", async () => {
  expect(await boundedRequest(async () => ({ title: "Ready" }), 100)).toEqual({ title: "Ready" });
});
test("a stalled body is bounded even when its work ignores abort", async () => {
  let requestSignal: AbortSignal | undefined;
  await expect(boundedRequest((signal) => { requestSignal = signal; return new Promise(() => {}); }, 10)).rejects.toThrow("timed out");
  expect(requestSignal?.aborted).toBeTrue();
});
test("leaving lookup cancels immediately and aborts the request", async () => {
  const outer = new AbortController();
  let inner: AbortSignal | undefined;
  const request = boundedRequest((signal) => { inner = signal; return new Promise(() => {}); }, 1000, outer.signal);
  await Promise.resolve(); outer.abort();
  await expect(request).rejects.toThrow("cancelled");
  expect(inner?.aborted).toBeTrue();
});
test("already cancelled work never starts", async () => {
  const outer = new AbortController(); outer.abort(); let calls = 0;
  await expect(boundedRequest(async () => { calls += 1; }, 100, outer.signal)).rejects.toThrow("cancelled");
  expect(calls).toBe(0);
});
