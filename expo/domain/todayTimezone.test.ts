import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

/** Separate processes keep timezone tests from changing other tests' local clock. */
function period(zone: string, iso: string): { key: string; startsAt: number; endsAt: number } {
  const modulePath = new URL("./today.ts", import.meta.url).pathname;
  const script = `import { getTodayPeriod } from ${JSON.stringify(modulePath)}; console.log(JSON.stringify(getTodayPeriod(Date.parse(${JSON.stringify(iso)}))));`;
  const result = spawnSync(process.execPath, ["--eval", script], { env: { ...process.env, TZ: zone }, encoding: "utf8" });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}

describe("Today local clock boundaries", () => {
  test("spring-forward period is 23 hours and changes at local 4 a.m.", () => {
    const before = period("America/Los_Angeles", "2026-03-08T10:59:59Z");
    const after = period("America/Los_Angeles", "2026-03-08T11:00:00Z");
    expect(before.key).toBe("2026-03-07");
    expect(after.key).toBe("2026-03-08");
    expect(before.endsAt - before.startsAt).toBe(23 * 3_600_000);
    expect(before.endsAt).toBe(after.startsAt);
  });
  test("fall-back period is 25 hours and changes at local 4 a.m.", () => {
    const before = period("America/Los_Angeles", "2026-11-01T11:59:59Z");
    const after = period("America/Los_Angeles", "2026-11-01T12:00:00Z");
    expect(before.key).toBe("2026-10-31");
    expect(after.key).toBe("2026-11-01");
    expect(before.endsAt - before.startsAt).toBe(25 * 3_600_000);
    expect(before.endsAt).toBe(after.startsAt);
  });
  test("uses the device timezone, including non-hour offsets", () => {
    expect(period("Asia/Kolkata", "2026-09-14T22:29:59Z").key).toBe("2026-09-14");
    expect(period("Asia/Kolkata", "2026-09-14T22:30:00Z").key).toBe("2026-09-15");
    expect(period("Pacific/Auckland", "2026-09-14T20:00:00Z").key).toBe("2026-09-15");
    expect(period("America/Los_Angeles", "2026-09-14T20:00:00Z").key).toBe("2026-09-14");
  });
});
