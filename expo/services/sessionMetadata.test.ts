import { expect, test } from "bun:test";
import { loadSessionMetadata } from "./sessionMetadata";
import type { Video } from "../types";

test("500-item reads stay bounded and preserve order and missing entries", async () => {
  const ids = Array.from({ length: 500 }, (_, i) => String(i));
  let active = 0, peak = 0;
  const result = await loadSessionMetadata(ids, async id => {
    active++; peak = Math.max(peak, active);
    await Promise.resolve(); active--;
    return id === "23" ? null : { id } as Video;
  });
  expect(peak).toBeLessThanOrEqual(20);
  expect(result.map(v => v?.id ?? null)).toEqual(ids.map(id => id === "23" ? null : id));
});

test("cancellation stops further batches and rejects stale results", async () => {
  const controller = new AbortController(); let reads = 0;
  await expect(loadSessionMetadata(Array.from({ length: 500 }, (_, i) => String(i)), async () => {
    reads++; controller.abort(); return null;
  }, controller.signal)).rejects.toThrow("cancelled");
  expect(reads).toBe(20);
  reads = 0;
  await expect(loadSessionMetadata(["a"], async () => { reads++; return null; }, controller.signal)).rejects.toThrow("cancelled");
  expect(reads).toBe(0);
});

test("storage failure is not reported as a successful empty session", async () => {
  await expect(loadSessionMetadata(["a"], async () => { throw new Error("storage unavailable"); })).rejects.toThrow("storage unavailable");
});
