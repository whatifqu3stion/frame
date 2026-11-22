import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from '../../../expo/node_modules/typescript';
import { createProgressRecovery } from '../../../expo/domain/progressRecovery';

const root = new URL('../../../expo/', import.meta.url);
function load(file: string, name: string, context: Record<string, unknown>, declaration = false): (...args: any[]) => any {
  const source = readFileSync(new URL(file, root), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fn = '';
  function visit(node: ts.Node) {
    if (declaration && ts.isFunctionDeclaration(node) && node.name?.text === name) fn = node.getText(ast).replace('export ', '');
    if (!declaration && ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) fn = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!fn) throw Error(`Missing ${name}`);
  const env = { ...context, exports: {} as { fn: (...args: any[]) => any } };
  runInNewContext(ts.transpileModule(declaration ? `${fn}; exports.fn = ${name};` : `exports.fn = ${fn};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, env);
  return env.exports.fn;
}
const settle = async () => { for (let i=0; i<40; i++) await Promise.resolve(); };

// The actual completion callback awaits the resume write while the user switches profiles.
const recovery = createProgressRecovery();
const writer = recovery.getWriter('owner', 'video');
const leave = writer.retain();
const currentProfile = { current: 'owner' };
let positionWrites = 0, resumeCleared = false;
let finishResume!: () => void;
const resumeGate = new Promise<void>(resolve => { finishResume = resolve; });
const position = load('providers/AppProvider.tsx', 'updateSessionPosition', {
  activeProfileId: 'owner', activeProfileIdRef: currentProfile,
  setQueuePosition: async () => { positionWrites++; return true; }, queryClient: { invalidateQueries: async () => {} },
});
const ended = load('app/watch/[id].tsx', 'handleEnded', {
  attempt: { isCurrent: () => true }, playerKey: 1, lifecycle: { mount: true }, playIntent: { current: 0 },
  video: { id: 'video' }, didEndRef: { current: false }, __DEV__: false,
  savedSessionId: 'session', sessionEndsHere: false, sessionIndex: 0, isSession: true, sessionIds: ['video', 'next'],
  currentTimeRef: { current: 100 }, setPlaybackState() {}, stopAllowancePlayback: async () => null,
  applyAllowanceStatus() {}, failClosedAllowance() {}, setAction() {}, isFullscreenRef: { current: false },
  progressWriter: writer, clearVideoResume: async () => { await resumeGate; resumeCleared = true; },
  updateSessionPosition: position, nextSessionStep: () => 1, AccessibilityInfo: { announceForAccessibility() {} },
});
ended(); await settle(); currentProfile.current = 'viewer'; leave(); finishResume(); await writer.flush();
console.log(JSON.stringify({scenario:'completion overlaps profile switch',resumeCleared,positionWrites,recoveryFailures:recovery.failures('owner').length}));

// Execute the actual timer hook's storage effect and unmount cleanup with a rejected final write.
const effects: (() => void | (() => void))[] = [];
let timerWrites = 0, errorSignals = 0, pauses = 0;
const timerHook = load('hooks/useSessionTimer.ts', 'useSessionTimer', {
  useRef: (value: unknown) => ({current:value}),
  useState: (initial: unknown) => [initial, (value: any) => { const state=typeof value==='function'?value({}):value; if(state?.error) errorSignals++; }],
  useEffect: (fn: () => void | (()=>void)) => { effects.push(fn); }, useCallback: (fn: unknown) => fn,
  emptySessionRun: () => ({consumedSeconds:0,runId:1,ended:false,finishVideoId:null,lastVideoId:null}),
  createSessionClock: () => ({ playing: () => ({consumedSeconds:72,runId:1,ended:false,finishVideoId:null,lastVideoId:'video'}) }),
  readSessionRun: async () => ({consumedSeconds:70,runId:1,ended:false}),
  saveSessionRun: async () => { timerWrites++; throw Error('injected disk failure'); },
  sessionCanFinish: () => false, sessionTimeRemaining: () => 100, performance,
}, true);
timerHook('owner','session',30,'video',false,()=>{pauses++;});
const cleanup = effects[0](); await settle(); if(typeof cleanup==='function') cleanup(); await settle();
console.log(JSON.stringify({scenario:'timer checkpoint fails after unmount',timerWrites,errorSignals,pauses,appRecoveryFailures:recovery.failures('owner').length}));
