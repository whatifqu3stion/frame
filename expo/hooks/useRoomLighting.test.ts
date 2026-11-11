import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { motion } from "../constants/motion";

// Run the actual hook effect with deterministic native animation and lifecycle
// boundaries. Advancing a value models interruption without a wall-clock timer.
function harness(initialWatching = false) {
  const calls: { from: number; toValue: number; duration: number; easing: unknown }[] = [];
  class Value {
    stopped = false;
    constructor(public value: number) {}
    get() { return this.value; }
    set(next: number | { toValue: number; duration: number; easing: unknown }) {
      if (typeof next === "number") this.value = next;
      else {
        this.stopped = false;
        calls.push({ from: this.value, ...next });
      }
    }
  }
  let ref: { current: Value } | undefined;
  let dependencies: unknown[] = [];
  let cleanup: (() => void) | undefined;
  let reduced = false;
  const listeners = new Set<(state: string) => void>();
  const app = { currentState: "active", addEventListener: (_name: string, callback: (state: string) => void) => { listeners.add(callback); return { remove: () => listeners.delete(callback) }; } };
  const modules: Record<string, unknown> = {
    react: { useLayoutEffect: (effect: () => () => void, next: unknown[]) => {
      if (next.every((value, index) => value === dependencies[index])) return;
      cleanup?.(); dependencies = next; cleanup = effect();
    } },
    "react-native": { AppState: app },
    "react-native-reanimated": {
      useSharedValue: (initial: number) => (ref ??= { current: new Value(initial) }).current,
      cancelAnimation: (value: Value) => { value.stopped = true; },
      withTiming: (toValue: number, config: { duration: number; easing: unknown }) => ({ toValue, ...config }),
      Easing: { cubic: "cubic", out: (value: unknown) => value, bezier: (...points: number[]) => points },
    },
    "react-native-worklets": {
      scheduleOnUI: <T extends unknown[]>(worklet: (...args: T) => void, ...args: T) => worklet(...args),
    },
    "@/constants/motion": { motion },
    "@/hooks/useReducedMotion": { useReducedMotion: () => reduced },
  };
  const context = { exports: {} as { useRoomLighting(watching: boolean): Value }, require: (id: string) => modules[id] };
  runInNewContext(transpileModule(readFileSync(new URL("./useRoomLighting.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, context);
  const render = (watching: boolean) => context.exports.useRoomLighting(watching);
  const value = render(initialWatching);
  calls.length = 0;
  return { value, calls, render, reduce: () => { reduced = true; }, background: () => { app.currentState = "background"; listeners.forEach(fn => fn("background")); }, foreground: () => { app.currentState = "active"; listeners.forEach(fn => fn("active")); }, dispose: () => cleanup?.(), listeners };
}

test("quick Back and re-entry retarget the current light, with a faster exit", () => {
  const h = harness(); h.render(true);
  expect(h.calls[0]).toMatchObject({ from: 0, toValue: 1, duration: motion.roomDim, easing: [0.30, 0, 0.35, 1] });
  h.value.value = 0.4; h.render(false);
  expect(h.calls[1]).toMatchObject({ from: 0.4, toValue: 0, duration: 320 });
  h.value.value = 0.2; h.render(true);
  expect(h.calls[2]).toMatchObject({ from: 0.2, toValue: 1, duration: 1376 });
  h.dispose(); expect(h.value.stopped).toBeTrue(); expect(h.listeners.size).toBe(0);
});

test("player updates and next-video renders cannot replay the room entrance", () => {
  const h = harness(); h.render(true); h.value.value = 1;
  h.render(true); h.render(true);
  expect(h.calls.length).toBe(1); expect(h.value.value).toBe(1);
  h.dispose();
});
test("Reduce Motion settles an in-flight entrance and skips the exit", () => {
  const h = harness(); h.render(true); h.value.value = 0.3;
  h.reduce(); h.render(true);
  expect(h.value.value).toBe(1); expect(h.value.stopped).toBeTrue();
  h.render(false); expect(h.value.value).toBe(0); expect(h.calls.length).toBe(1);
  h.dispose();
});
test("backgrounding settles; resuming and direct watch entry do not flash the light", () => {
  const h = harness(); h.render(true); h.value.value = 0.3;
  h.background(); expect(h.value.value).toBe(1);
  h.foreground(); h.render(true); expect(h.calls.length).toBe(1);
  h.dispose();
  const direct = harness(true); expect(direct.value.value).toBe(1); direct.dispose();
});
