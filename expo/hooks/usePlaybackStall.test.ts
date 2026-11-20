import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";

function harness() {
  let time = 0, cursor = 0, count = 0;
  const ref = { current: () => {} };
  const timers: { at: number; callback(): void; cleared: boolean; fired: boolean }[] = [];
  const effects: { deps: unknown[]; cleanup?: () => void }[] = [];
  const context = {
    exports: {} as { usePlaybackStall(watching: boolean, attempt: number, onStall: () => void): void },
    require: () => ({
      useRef: () => ref,
      useLayoutEffect(effect: () => (() => void) | void, deps: unknown[]) {
        const i = cursor++, old = effects[i];
        if (!old || deps.some((d, j) => d !== old.deps[j])) {
          old?.cleanup?.(); effects[i] = { deps, cleanup: effect() || undefined };
        }
      },
    }),
    setTimeout(callback: () => void, delay: number) {
      const timer = { at: time + delay, callback, cleared: false, fired: false };
      timers.push(timer); return timer;
    },
    clearTimeout(timer: typeof timers[number]) { timer.cleared = true; },
  };
  runInNewContext(transpileModule(readFileSync(new URL("./usePlaybackStall.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText, context);
  return {
    render(watching: boolean, attempt = 0, onStall = () => { count++; }) {
      cursor = 0; context.exports.usePlaybackStall(watching, attempt, onStall);
    },
    advance(ms: number) {
      time += ms;
      for (const timer of timers) if (!timer.cleared && !timer.fired && timer.at <= time) {
        timer.fired = true; timer.callback();
      }
    },
    count: () => count, timers,
    dispose: () => effects.forEach(effect => effect.cleanup?.()),
  };
}

test("continuous buffering recovers once after twenty seconds, despite progress rerenders", () => {
  const h = harness(); h.render(true); h.advance(19_000); h.render(true);
  expect(h.count()).toBe(0); h.advance(1_000); expect(h.count()).toBe(1);
  h.advance(60_000); expect(h.count()).toBe(1); expect(h.timers).toHaveLength(1);
});

test("playback resuming or losing permission/visibility cancels recovery; the next stall gets its own grace period", () => {
  const h = harness(); h.render(true); h.advance(19_000); h.render(false);
  h.timers[0].callback(); h.advance(60_000); expect(h.count()).toBe(0);
  h.render(true); h.advance(19_999); expect(h.count()).toBe(0);
  h.advance(1); expect(h.count()).toBe(1);
});

test("retry and unmount reject callbacks from a departed player", () => {
  const h = harness(); h.render(true, 0); h.advance(19_000); h.render(true, 1);
  h.timers[0].callback(); h.advance(1_000); expect(h.count()).toBe(0);
  h.dispose(); h.timers[1].callback(); h.advance(30_000); expect(h.count()).toBe(0);
});

test("the timeout uses the latest connectivity message without extending the deadline", () => {
  const h = harness(); const messages: string[] = [];
  h.render(true, 0, () => messages.push("stalled")); h.advance(10_000);
  h.render(true, 0, () => messages.push("offline")); h.advance(10_000);
  expect(messages).toEqual(["offline"]);
});
