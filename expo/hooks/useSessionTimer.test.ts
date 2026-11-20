import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as timerDomain from "../domain/sessionTimer";
import { createProgressRecovery } from "../domain/progressRecovery";

// Execute the actual hook with deterministic effect scheduling and faultable storage.
const source = readFileSync(new URL("./useSessionTimer.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("timer.ts", source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "useSessionTimer")!;
const code = ts.transpileModule(`${declaration.getText(ast).replace("export ", "")}; exports.hook = useSessionTimer;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function storage() {
  let run = timerDomain.emptySessionRun(), fail = false, readFail = false, writes = 0;
  return {
    read: async () => { if (readFail) throw Error("read unavailable"); return { ...run }; },
    save: async (_profile: string, _session: string, next: timerDomain.SessionRun) => {
      writes++; if (fail) throw Error("disk");
      if (next.runId === run.runId) run = { ...next, consumedSeconds: Math.max(run.consumedSeconds, next.consumedSeconds), ended: run.ended || next.ended };
    },
    setFail(value: boolean) { fail = value; },
    setReadFail(value: boolean) { readFail = value; },
    reset() { run = { ...timerDomain.emptySessionRun(), runId: run.runId + 1 }; },
    get run() { return run; }, get writes() { return writes; },
  };
}
function mount(recovery: ReturnType<typeof createProgressRecovery>, db: ReturnType<typeof storage>) {
  const cells: any[] = []; let cursor = 0, dirty = false, now = 0, mounted = true;
  let pending: { cell: any; setup: () => (() => void) | void }[] = [];
  let result: ReturnType<typeof import("./useSessionTimer").useSessionTimer>;
  const same = (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const environment = {
    ...timerDomain, progressRecovery: recovery, performance: { now: () => now },
    readSessionRun: db.read, saveSessionRun: db.save,
    useRef(value: unknown) { return cells[cursor++] ??= { current: value }; },
    useState(value: unknown) {
      const cell = cells[cursor++] ??= { value };
      return [cell.value, (next: any) => { const value = typeof next === "function" ? next(cell.value) : next; if (!Object.is(value, cell.value)) { cell.value = value; dirty = true; } }];
    },
    useMemo(fn: () => unknown, deps: unknown[]) {
      const cell = cells[cursor++] ??= {};
      if (!same(cell.deps, deps)) { cell.value = fn(); cell.deps = deps; } return cell.value;
    },
    useCallback(fn: unknown) { return fn; },
    useEffect(setup: () => (() => void) | void, deps: unknown[]) {
      const cell = cells[cursor++] ??= {};
      if (!same(cell.deps, deps)) { cell.deps = deps; pending.push({ cell, setup }); }
    },
    setInterval: () => 1, clearInterval() {},
    exports: {} as { hook: (...args: any[]) => typeof result },
  };
  runInNewContext(code, environment);
  const render = () => {
    cursor = 0; dirty = false;
    result = environment.exports.hook("owner", "session", 30, "video", true, () => {});
    const batch = pending; pending = [];
    batch.forEach(({ cell }) => cell.cleanup?.());
    batch.forEach(({ cell, setup }) => { cell.cleanup = setup(); });
  };
  render();
  return {
    get result() { return result; }, advance(seconds: number) { now += seconds * 1000; },
    async flush() { for (let i = 0; i < 20; i++) { await settle(); if (!mounted || !dirty) return; render(); } throw Error("Hook did not settle"); },
    unmount() { mounted = false; cells.forEach(cell => cell.cleanup?.()); },
  };
}

test("timer's actual final checkpoint stays retryable after leaving Watch", async () => {
  const recovery = createProgressRecovery(), db = storage(), page = mount(recovery, db);
  await page.flush(); expect(page.result.allowed).toBe(true);
  page.advance(72); db.setFail(true); page.unmount(); await settle();
  expect(recovery.failures("owner")).toHaveLength(1);
  expect(recovery.failures("owner")[0].kind).toBe("session");
  expect(db.run.consumedSeconds).toBe(0);
  db.setFail(false); await recovery.retry("owner");
  expect(db.run.consumedSeconds).toBe(72);
  expect(recovery.failures("owner")).toHaveLength(0);
});

test("reopening a failed timer blocks stale playback; local Retry restores the checkpoint", async () => {
  const recovery = createProgressRecovery(), db = storage(), first = mount(recovery, db);
  await first.flush(); first.advance(42); db.setFail(true); first.unmount(); await settle();
  const next = mount(recovery, db); await next.flush();
  expect(next.result.error).toBe(true); expect(next.result.allowed).toBe(false);
  db.setFail(false); await next.result.retry(); await next.flush();
  expect(next.result.error).toBe(false); expect(next.result.run.consumedSeconds).toBe(42);
  next.unmount(); await settle();
});

test("a failed session ending remains recoverable after departure", async () => {
  const recovery = createProgressRecovery(), db = storage(), page = mount(recovery, db);
  await page.flush(); page.advance(12); db.setFail(true);
  await expect(page.result.end()).rejects.toThrow(); page.unmount(); await settle();
  db.setFail(false); await recovery.retry("owner");
  expect(db.run).toMatchObject({ ended: true, consumedSeconds: 12 });
});

test("retrying a previous run does not overwrite a newly reset session", async () => {
  const recovery = createProgressRecovery(), db = storage(), page = mount(recovery, db);
  await page.flush(); page.advance(20); db.setFail(true); page.unmount(); await settle();
  db.reset(); db.setFail(false); await recovery.retry("owner");
  expect(db.run).toMatchObject({ runId: 1, consumedSeconds: 0, ended: false });
});

test("data deletion retires the timer's handle before a stale route cleanup", async () => {
  const recovery = createProgressRecovery(), db = storage(), page = mount(recovery, db);
  await page.flush(); page.advance(20); await recovery.discard("owner");
  const writesBefore = db.writes; page.unmount(); await settle();
  expect(db.writes).toBe(writesBefore); expect(recovery.failures("owner")).toHaveLength(0);
});

test("session time read failure stays blocked until a successful local Retry", async () => {
  const recovery = createProgressRecovery(), db = storage(); db.setReadFail(true);
  const page = mount(recovery, db); await page.flush();
  expect(page.result.error).toBe(true); expect(page.result.allowed).toBe(false);
  db.setReadFail(false); await page.result.retry(); await page.flush();
  expect(page.result.error).toBe(false); expect(page.result.allowed).toBe(true);
  page.unmount(); await settle();
});
