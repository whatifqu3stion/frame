import { expect, test } from "bun:test";
import { URL } from "node:url";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createProgressRecovery } from "../domain/progressRecovery";
import { createSourceFile, forEachChild, isVariableDeclaration, isCallExpression, isFunctionDeclaration, ModuleKind, ScriptTarget, ScriptKind, transpileModule, type Node } from "typescript";
function load(file: string, name: string, context: Record<string, unknown>, declaration = false): (...args: any[]) => any {
  const source = readFileSync(new URL(file, import.meta.url), "utf8"), ast = createSourceFile(file, source, ScriptTarget.Latest, true, ScriptKind.TSX); let fn = "";
  function visit(node: Node) {
    if (declaration && isFunctionDeclaration(node) && node.name?.text === name) fn = node.getText(ast).replace("export ", "");
    if (!declaration && isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && isCallExpression(node.initializer)) fn = node.initializer.arguments[0].getText(ast);
    forEachChild(node, visit);
  }
  visit(ast); if (!fn) throw Error(`Missing actual callback ${name}`);
  const env = { ...context, exports: {} as Record<string, (...args: any[]) => any> };
  runInNewContext(transpileModule(declaration ? `${fn}; exports.fn = ${name};` : `exports.fn = ${fn};`, { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.CommonJS } }).outputText, env);
  return env.exports.fn;
}
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
for (const interrupt of ["pause", "background"] as const) test(`actual watch handler rejects delayed authorization after ${interrupt}`, async () => {
  let resolve!: (v: unknown) => void; const access = new Promise(r => { resolve = r; }); const events: string[] = []; const appState = { currentState: "active" };
  const h = load("../app/watch/[id].tsx", "handleStateChange", {
    attempt: { isCurrent: () => true }, playerKey: 1, lifecycle: { mount: true }, playIntent: { current: 0 }, AppState: appState,
    setPlaybackState() {}, longFormAllowed: true, runtimeRejectedRef: { current: false }, sessionTimer: { allowed: true }, playerRef: { current: { pause() {} } },
    allowanceEndingRef: { current: false }, accessVideo: { id: "video" }, getManagedContentAccess: () => access, setContentAccessStatus() {}, persist: async () => {},
    beginAllowancePlayback: async () => { events.push("start"); return { canPlay: true }; }, applyAllowanceStatus() {}, todayWatchedRef: { current: true },
    stopAllowancePlayback: async () => { events.push("stop"); return null; }, failClosedAllowance() {},
  });
  h("playing"); if (interrupt === "pause") h("paused"); else appState.currentState = "background";
  resolve({ canPlay: true }); await settle(); expect(events).not.toContain("start");
});
for (const name of ["saveSessionDraft", "clearSessionDraft"]) test(`${name}: failure reaches editor without poisoning profile/reset flushes`, async () => {
  const tails = new Map(); let fail = true, commits = 0; const write = async () => { if (fail) throw Error("disk"); commits++; };
  const h = load("../providers/AppProvider.tsx", name, {
    activeProfileId: "owner", activeProfileIdRef: { current: "owner" }, switchingRef: { current: false }, normalizeSessionTarget: (v: unknown) => v, normalizeSessionIds: (v: unknown) => v,
    draftWritesRef: { current: tails }, writeSessionDraft: write, deleteSessionDraft: write, queryClient: { setQueryData() {} },
  });
  const draft = { name: "Evening", orderedVideoIds: [], targetMinutes: 30 };
  await expect(h(draft)).rejects.toThrow("disk"); fail = false; await Promise.all([...tails.values()]); await Promise.all([...tails.values()]); await h(draft); expect(commits).toBe(1);
});
test("actual session edit commits once; validation/write failures leave old data", async () => {
  const old = { id: "session", name: "Before", orderedVideoIds: ["a"], targetMinutes: 30, currentIndex: 0 };
  let stored = { ...old }, failValidation = true, failWrite = false, writes = 0;
  const h = load("../providers/AppProvider.tsx", "updateSessionVideos", {
    activeProfileId: "owner", activeProfileIdRef: { current: "owner" }, switchingRef: { current: false }, requirePurchase: () => true,
    listQueues: async () => [stored], normalizeSessionIds: (v: unknown) => v, normalizeSessionTarget: (v: unknown) => v,
    validateSessionContent: async () => { if (failValidation) throw Error("metadata"); }, positionAfterEdit: () => 0,
    upsertQueue: async (_profile: string, next: typeof stored) => { writes++; if (failWrite) throw Error("disk"); stored = next; }, invalidateLibrary: async () => {},
  });
  await expect(h("session", ["b"], 45, "After")).rejects.toThrow("metadata"); expect(writes).toBe(0); expect(stored).toEqual(old);
  failValidation = false; failWrite = true; await expect(h("session", ["b"], 45, "After")).rejects.toThrow("disk"); expect(stored).toEqual(old);
  failWrite = false; writes = 0; await h("session", ["b"], 45, "After"); expect(writes).toBe(1); expect(stored).toMatchObject({ name: "After", orderedVideoIds: ["b"], targetMinutes: 45 });
});
test("500 missing videos use one profile-scoped query and expiry pass", async () => {
  let queries = 0, expires = 0; const ids = Array.from({ length: 500 }, (_, i) => `v${i}`);
  const h = load("../db/database.ts", "getLatestTodayVideos", {
    Platform: { OS: "ios" }, expireLocalTodayMetadata: async () => { expires++; },
    getDb: async () => ({ getAllAsync: async (sql: string, params: string[]) => {
      queries++; expect(sql).toContain("profileId = ? AND mediaId IN"); expect(params).toEqual(["owner", ...ids]);
      return [{ id: "v0", title: "New", fetchedAt: 3 }, { id: "v0", title: "Old", fetchedAt: 2 }, { id: "v1", fetchedAt: 0 }];
    } }), mapTodayItemRow: (v: unknown) => v, isMetadataCurrent: (timestamp: number) => timestamp > 0,
  }, true);
  const result = await h("owner", [...ids, "v0"]); expect(queries).toBe(1); expect(expires).toBe(1); expect(result).toHaveLength(1); expect(result[0].title).toBe("New");
});


test("a departed player cannot write its delayed final checkpoint using the next video's time", async () => {
  let generation = 0, position = 40; const saved: number[] = []; const callbacks: (() => void)[] = [];
  const h = load("../app/watch/[id].tsx", "pauseAndPersist", {
    playIntent: { current: 0 }, attempt: { cancel: () => ++generation, isCurrent: (ticket: number) => ticket === generation },
    setPlayerKey() {}, setAction() {}, setPlaybackState() {}, playerRef: { current: { requestProgress() {}, pause() {} } },
    stopAllowancePlayback: async () => null, applyAllowanceStatus() {}, failClosedAllowance() {},
    persist: async () => { saved.push(position); }, FINAL_PROGRESS_DELAY_MS: 250, setTimeout: (callback: () => void) => { callbacks.push(callback); },
  });
  h(); generation++; position = 90; callbacks.forEach(callback => callback()); await settle();
  expect(saved).toEqual([40]);
});

for (const outcome of ["success", "failure", "obsolete"] as const) test(`session completion survives a profile switch: ${outcome}`, async () => {
  const recovery = createProgressRecovery(), writer = recovery.getWriter("owner", "video");
  const leave = writer.retain(), current = { current: "owner" };
  let finish!: () => void, fail = outcome === "failure";
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const writes: string[] = [], invalidated: unknown[] = [];
  const position = load("../providers/AppProvider.tsx", "completeSessionPosition", {
    activeProfileId: "owner", activeProfileIdRef: current,
    setQueuePosition: async (profile: string) => { if (fail) throw Error("disk"); if (outcome === "obsolete") return false; writes.push(profile); return true; },
    queryClient: { invalidateQueries: async (key: unknown) => { invalidated.push(key); } },
  });
  const ended = load("../app/watch/[id].tsx", "handleEnded", {
    attempt: { isCurrent: () => true }, playerKey: 1, lifecycle: { mount: true }, playIntent: { current: 0 },
    video: { id: "video" }, didEndRef: { current: false }, __DEV__: false, savedSessionId: "session",
    sessionEndsHere: false, sessionIndex: 0, isSession: true, sessionIds: ["video", "next"], currentTimeRef: { current: 100 },
    setPlaybackState() {}, stopAllowancePlayback: async () => null, applyAllowanceStatus() {}, failClosedAllowance() {},
    setAction() {}, isFullscreenRef: { current: false }, progressWriter: writer, clearVideoResume: () => gate,
    completeSessionPosition: position, nextSessionStep: () => 1, AccessibilityInfo: { announceForAccessibility() {} },
  });
  ended(); await settle(); current.current = "viewer"; leave(); finish(); await settle();
  if (fail) {
    expect(recovery.failures("owner")).toHaveLength(1); expect(recovery.failures("viewer")).toHaveLength(0);
    fail = false; await recovery.retry("owner");
  }
  expect(writes).toEqual(outcome === "obsolete" ? [] : ["owner"]);
  expect(invalidated).toEqual(outcome === "obsolete" ? [] : [{ queryKey: ["library", "owner", "queues"] }]);
  expect(recovery.failures("owner")).toHaveLength(0);
});
