import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";

type Element = { type: unknown; props: Record<string, any> };
const code = transpileModule(readFileSync(new URL("./OwnerPinModal.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
}).outputText;

function prompt(cooldown = false) {
  let time = 1_000;
  let tick: (() => void) | undefined;
  let slot = 0;
  const state: unknown[] = [];
  const effects: (() => void)[] = [];
  let mounted = false;
  const submissions: string[] = [];
  const app = {
    ownerPinPromptOpen: true, ownerPinCooldownUntil: cooldown ? time + 30_000 : 0,
    ownerPinPromptError: cooldown ? "Too many attempts. Wait 30 seconds, then try again." : null,
    submitOwnerAuthorization: async (pin: string) => { submissions.push(pin); },
  };
  const exports: { default?: () => Element } = {};
  const element = (type: unknown, props: Element["props"]): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useRef: () => ({ current: null }),
      useMemo: (fn: () => unknown) => fn(),
      useEffect: (fn: () => void) => { if (!mounted) effects.push(fn); },
      useState: (initial: unknown) => {
        const index = slot++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [state[index], (value: unknown) => { state[index] = value; }];
      },
    },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "react-native": { Platform: { OS: "android", isTV: true }, StyleSheet: { create: (s: unknown) => s } },
    "@/constants/theme": { radii: {}, spacing: {}, fonts: {} },
    "@/constants/useFrameTheme": { useFrameTheme: () => ({ palette: {}, type: {} }) },
    "@/providers/AppProvider": { useApp: () => app },
  };
  runInNewContext(code, {
    exports, Date: { now: () => time },
    setInterval: (fn: () => void) => { tick = fn; return 1; },
    clearInterval: () => { tick = undefined; },
    require: (id: string) => modules[id] ?? { default: id },
  });
  const render = () => {
    slot = 0;
    const root = exports.default!();
    const content = root.props.children[0].props.children as Element[];
    if (!mounted) { mounted = true; effects.forEach(fn => fn()); }
    return {
      input: content.find(node => node?.props?.testID === "owner-pin-input")!.props,
      submit: content.find(node => node?.props?.testID === "owner-pin-submit")!.props,
      status: content.find(node => node?.props?.accessibilityLiveRegion === "polite")?.props.children,
    };
  };
  return { render, submissions, advance: (ms: number) => { time += ms; tick?.(); } };
}

test("PIN entry stays masked and keyboard submission enforces the same minimum as the button", async () => {
  const ui = prompt();
  const { input } = ui.render();
  expect(input.secureTextEntry).toBe(true);
  expect(input.disableFullscreenUI).toBe(true);
  input.onChangeText("a12");
  ui.render().input.onSubmitEditing();
  expect(ui.submissions).toEqual([]);
  input.onChangeText("7a654321");
  const ready = ui.render();
  expect(ready.submit.disabled).toBe(false);
  ready.input.onSubmitEditing();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ui.submissions).toEqual(["765432"]);
  expect(ui.render().input.value).toBe("");
});

test("cooldown disables both PIN entry and submission, then replaces the expired wait instruction", () => {
  const ui = prompt(true);
  const locked = ui.render();
  expect(locked.input.editable).toBe(false);
  expect(locked.submit.disabled).toBe(true);
  expect(locked.status).toBe("Too many attempts.");
  ui.advance(30_000);
  const ready = ui.render();
  expect(ready.input.editable).toBe(true);
  expect(ready.status).toBe("You can try again now.");
  expect(ready.submit.disabled).toBe(true);
});
