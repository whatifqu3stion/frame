import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";

type Animation = { target: number; config: { duration: number }; finish(done: boolean): void };
function harness(initialVisible = true) {
  let visible = initialVisible, reduced = false, elapsed = 0, completed = 0;
  let cursor = 0, effectIndex = 0, callbackIndex = 0;
  const refs: { current: unknown }[] = [], callbacks: unknown[] = [];
  const effects: { deps: unknown[]; cleanup?: () => void }[] = [];
  const calls: Animation[] = [], queued: (() => void)[] = [];
  let clock: { value: number } | undefined;
  const linear = (n: number) => n;
  const modules: Record<string, unknown> = {
    react: {
      useRef: (current: unknown) => { const i = cursor++; return refs[i] ?? (refs[i] = { current }); },
      useCallback: (fn: unknown) => { const i = callbackIndex++; return callbacks[i] ?? (callbacks[i] = fn); },
      useLayoutEffect: (effect: () => (() => void) | void, deps: unknown[]) => {
        const i = effectIndex++, old = effects[i];
        if (!old || deps.some((d, j) => d !== old.deps[j])) { old?.cleanup?.(); effects[i] = { deps, cleanup: effect() || undefined }; }
      },
    },
    "react-native-reanimated": {
      useSharedValue: (value: number) => {
        if (!clock) { elapsed = value; clock = Object.defineProperty({}, "value", { get: () => elapsed, set: (v: number | Animation) => { if (typeof v === "number") elapsed = v; else calls.push(v); } }) as { value: number }; }
        return clock;
      },
      useDerivedValue: (compute: () => number) => ({ get value() { return compute(); } }),
      cancelAnimation: () => {},
      withTiming: (target: number, config: Animation["config"], finish: Animation["finish"]) => ({ target, config, finish }),
      Easing: { linear, bezier: () => linear, inOut: () => linear }, ReduceMotion: { Never: "never" },
    },
    "react-native-worklets": { scheduleOnRN: (fn: (version: number) => void, version: number) => queued.push(() => fn(version)) },
    "@/hooks/useReducedMotion": { useReducedMotionPreference: () => reduced },
    "@/hooks/useMotionVisibility": { useMotionVisibility: () => visible },
  };
  const context = { exports: {} as { useStudyReveal(first: boolean, duration: number, delay: number, ease: (n: number) => number, complete: () => void): { value: number } }, require: (name: string) => modules[name] };
  runInNewContext(transpileModule(readFileSync(new URL("./useStudyReveal.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, context);
  const onComplete = () => { completed++; };
  const render = () => { cursor = 0; effectIndex = 0; callbackIndex = 0; return context.exports.useStudyReveal(true, 1000, 500, linear, onComplete); };
  const progress = render();
  return { progress, calls, render, advance: (value: number) => { elapsed = value; }, setVisible: (v: boolean) => { visible = v; render(); }, reduce: () => { reduced = true; render(); }, flush: () => { while (queued.length) queued.shift()!(); }, completed: () => completed, dispose: () => effects.forEach(e => e.cleanup?.()) };
}

test("a study resumes its remaining delay and reveal without restarting", () => {
  const h = harness(); expect(h.calls.at(-1)?.config.duration).toBe(1500);
  h.advance(200); h.setVisible(false); expect(h.progress.value).toBe(0);
  h.setVisible(true); expect(h.calls.at(-1)?.config.duration).toBe(1300);
  h.advance(900); expect(h.progress.value).toBe(0.4);
  h.setVisible(false); const count = h.calls.length;
  h.render(); expect(h.calls.length).toBe(count); expect(h.completed()).toBe(0);
  h.setVisible(true); expect(h.calls.at(-1)?.config.duration).toBe(600); expect(h.progress.value).toBe(0.4);
});

test("queued completion is invalidated when hidden; returning completes once", () => {
  const h = harness(); h.advance(1500); h.calls.at(-1)!.finish(true);
  h.setVisible(false); h.flush(); expect(h.completed()).toBe(0);
  h.setVisible(true); expect(h.completed()).toBe(1);
  h.render(); expect(h.completed()).toBe(1);
});

test("Reduce Motion settles invisibly but acknowledges only the visible stage", () => {
  const h = harness(false); expect(h.calls.length).toBe(0);
  h.reduce(); expect(h.progress.value).toBe(1); expect(h.completed()).toBe(0);
  h.setVisible(true); expect(h.completed()).toBe(1); expect(h.calls.length).toBe(0);
});

test("unmount rejects an already queued study completion", () => {
  const h = harness(); h.calls.at(-1)!.finish(true); h.dispose(); h.flush(); expect(h.completed()).toBe(0);
});
