import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { createSourceFile, forEachChild, isCallExpression, isVariableDeclaration, ModuleKind, ScriptTarget, transpileModule, type Node } from "typescript";

const source = readFileSync(new URL("../providers/AppProvider.tsx", import.meta.url), "utf8");
const ast = createSourceFile("AppProvider.tsx", source, ScriptTarget.Latest, true);
let effect = "";
function visit(node: Node) {
  if (isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]?.getText(ast).includes("const initialize = async")) effect = node.arguments[0].getText(ast);
  forEachChild(node, visit);
}
visit(ast);
if (!effect) throw new Error("Actual startup effect not found");
const startupCode = transpileModule(`exports.start = ${effect};`, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
const settle = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };

function harness(fail: "database" | "profile" | "snapshot" | null, fresh = false) {
  const state: Record<string, unknown> = { ready: false, startupError: false };
  const writes: string[] = [];
  let failure = fail;
  const snapshot = { prefs: { theme: "ink", hasCompletedOnboarding: !fresh }, interests: [], recentSearches: [], savedVideos: [], resumeList: [], sessions: [], followedChannels: [], sessionDraft: null, googleCredential: null, rawGoogleCredential: null };
  const profileId = fresh ? "owner" : "managed-existing";
  const context = {
    exports: {} as { start(): () => void },
    startupPending: { current: true }, readyRef: { current: false }, activeProfileIdRef: { current: "owner" },
    prefsRef: { current: {} }, interestsRef: { current: [] }, recentSearchesRef: { current: [] },
    console: { warn() {} }, AsyncStorage: {}, SecureStore: {},
    clearLegacyThumbnailCaches: async () => {},
    followedSourceRepository: { initialize: async () => { if (failure === "database") throw Error("db unavailable"); } },
    profileRepository: { list: async () => [{ id: profileId, role: fresh ? "owner" : "managed" }] },
    readActiveProfileId: async () => { if (failure === "profile") throw Error("profile unavailable"); return fresh ? null : profileId; },
    getOwnerPinAvailability: async () => "available", readOwnerPinRecord: async () => ({ verifier: "test-only" }),
    resolveActiveProfileId: () => profileId,
    loadProfileSnapshot: async () => { if (failure === "snapshot") throw Error("preferences unavailable"); return snapshot; },
    writeActiveProfileId: async (_storage: unknown, id: string) => { writes.push(id); },
    queryClient: { setQueryData() {} }, clearProfileGoogleCredential: async () => {},
    playbackOperations: { stop: async () => {} }, authorizationResolverRef: { current: null },
    ...Object.fromEntries(["Profiles", "ActiveProfileId", "Prefs", "Interests", "RecentSearches", "GoogleCredential", "OwnerPinAvailability", "HasOwnerPin", "OwnerPinProtectionError", "Ready", "StartupError"].map((name) => [`set${name}`, (value: unknown) => { state[name[0].toLowerCase() + name.slice(1)] = value; }])),
  };
  runInNewContext(startupCode, context);
  return { context, state, writes, start: context.exports.start, recover: () => { failure = null; } };
}

for (const failure of ["database", "profile", "snapshot"] as const) {
  test(`failed ${failure} restoration stays blocked; retry restores the existing Managed profile`, async () => {
    const h = harness(failure);
    const cleanup = h.start();
    await settle();
    expect(h.state.ready).toBe(false);
    expect(h.context.readyRef.current).toBe(false);
    expect(h.state.startupError).toBe(true);
    expect(h.writes).toEqual([]);
    expect(h.state.prefs).toBeUndefined();
    cleanup(); h.recover(); h.start(); await settle();
    expect(h.state.ready).toBe(true);
    expect(h.state.startupError).toBe(false);
    expect(h.state.activeProfileId).toBe("managed-existing");
    expect(h.state.prefs).toEqual({ theme: "ink", hasCompletedOnboarding: true });
  });
}

test("fresh setup is released only after successful restoration, and departed startup cannot publish", async () => {
  const h = harness(null, true);
  h.start(); await settle();
  expect(h.state.ready).toBe(true);
  expect(h.state.prefs).toEqual({ theme: "ink", hasCompletedOnboarding: false });
  expect(h.writes).toEqual(["owner"]);
  const departed = harness(null);
  departed.start()(); await settle();
  expect(departed.state.ready).toBe(false);
  expect(departed.state.prefs).toBeUndefined();
});

test("startup gate exposes retry instead of mounting navigation after failure", () => {
  let state = { ready: false, startupError: true, retryStartup: () => {} };
  const code = transpileModule(readFileSync(new URL("../components/StartupGate.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  const context = { exports: {} as { default(props: {children: string}): { type: string; props: Record<string, unknown> } }, require: (id: string) => {
    if (id === "@/providers/AppProvider") return { useApp: () => state };
    if (id === "@/components/RecoveryScreen") return { default: "Recovery" };
    return { jsx: (type: string, props: Record<string, unknown>) => ({ type, props }), Fragment: "Fragment" };
  } };
  runInNewContext(code, context);
  const failed = context.exports.default({ children: "Navigation" });
  expect(failed.type).toBe("Recovery");
  expect(failed.props.onRetry).toBe(state.retryStartup);
  expect(failed.props.children).toBeUndefined();
  state = { ...state, startupError: false };
  expect(context.exports.default({ children: "Navigation" }).props.loading).toBe(true);
  state = { ...state, ready: true };
  expect(context.exports.default({ children: "Navigation" }).props.children).toBe("Navigation");
});

function actualCallback(name: string, context: Record<string, unknown>): (...args: unknown[]) => unknown {
  let callback = "";
  function find(node: Node) {
    if (isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && isCallExpression(node.initializer)) callback = node.initializer.arguments[0].getText(ast);
    forEachChild(node, find);
  }
  find(ast);
  if (!callback) throw new Error(`Missing callback ${name}`);
  const runtime = { ...context, exports: {} as { run: (...args: unknown[]) => unknown } };
  runInNewContext(transpileModule(`exports.run = ${callback}`, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText, runtime);
  return runtime.exports.run;
}

test("retry coalesces rapid presses and ready state prevents another initialization", () => {
  const startupPending = { current: false }, readyRef = { current: false };
  let attempt = 0;
  const retry = actualCallback("retryStartup", { startupPending, readyRef, setStartupError() {}, setStartupAttempt: (change: (value: number) => number) => { attempt = change(attempt); } });
  retry(); retry();
  expect(attempt).toBe(1);
  startupPending.current = false; readyRef.current = true;
  retry(); expect(attempt).toBe(1);
});

test("preferences and Owner actions cannot proceed before profile restoration", async () => {
  const context = { readyRef: { current: false } };
  const update = actualCallback("updatePrefs", context);
  const authorize = actualCallback("requestOwnerAuthorization", context);
  await expect(update({ theme: "ink" }) as Promise<void>).rejects.toThrow("restoring");
  expect(await authorize()).toBe(false);
});
