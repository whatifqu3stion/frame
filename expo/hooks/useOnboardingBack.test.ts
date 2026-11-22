import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";

test("Android Back belongs to key setup while onboarding is underneath", () => {
  let focused = true;
  let cleanup: (() => void) | undefined;
  let handler: (() => boolean) | undefined;
  let exits = 0;
  let previous = 0;
  let busy = false;
  const modules: Record<string, unknown> = {
    react: { useEffect: (effect: () => (() => void) | undefined) => { cleanup?.(); cleanup = effect(); } },
    "@react-navigation/native": { useIsFocused: () => focused },
    "react-native": { BackHandler: {
      addEventListener: (_name: string, next: () => boolean) => { handler = next; return { remove: () => { handler = undefined; } }; },
      exitApp: () => exits++,
    } },
  };
  const context = { exports: {} as { useOnboardingBack(replay: boolean, step: number, busy: () => boolean, previous: () => void): void }, require: (id: string) => modules[id] };
  runInNewContext(transpileModule(readFileSync(new URL("./useOnboardingBack.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, context);
  const render = (replay = false, step = 1) => context.exports.useOnboardingBack(replay, step, () => busy, () => previous++);
  render(); expect(handler?.()).toBe(true); expect(previous).toBe(1);
  focused = false; render(); expect(handler).toBeUndefined(); expect(exits).toBe(0);
  focused = true; render(); busy = true; expect(handler?.()).toBe(true); expect(previous).toBe(1);
  busy = false; render(false, 0); expect(handler?.()).toBe(true); expect(exits).toBe(1);
  render(true, 0); expect(handler?.()).toBe(false); expect(exits).toBe(1);
  cleanup?.(); expect(handler).toBeUndefined();
});
