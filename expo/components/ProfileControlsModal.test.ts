import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";

type Element = { type: unknown; props: Record<string, any> };
const code = transpileModule(readFileSync(new URL("./ProfileControlsModal.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
}).outputText;

function controls(availability: "available" | "web" | "unavailable", hasPin: boolean) {
  const state: unknown[] = []; const refs: { current: unknown }[] = [];
  let cursor = 0; let refCursor = 0;
  const alerts: any[][] = []; const writes: any[][] = [];
  const owner = { id: "owner-default", name: "Owner", role: "owner" };
  const app = {
    profiles: [owner], activeProfileId: owner.id, isOwnerAuthorized: true,
    ownerPinAvailability: availability, hasOwnerPin: hasPin,
    getPlaybackAllowance: async () => ({ kind: "unlimited", canPlay: true }),
    setProfileViewingAllowance: async (...args: any[]) => { writes.push(args); return { ok: true, message: "Saved" }; },
  };
  const jsx = (type: unknown, props: Element["props"]): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useMemo: (build: () => unknown) => build(), useCallback: (fn: unknown) => fn, useEffect() {},
      useRef: (initial: unknown) => { const index = refCursor++; return refs[index] ?? (refs[index] = { current: initial }); },
      useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { View: "View", Pressable: "Pressable", StyleSheet: { create: (styles: unknown) => styles }, Alert: { alert: (...args: any[]) => alerts.push(args) } },
    "@/providers/AppProvider": { useApp: () => app },
    "@/hooks/useApprovalRequestCounts": { useApprovalRequestCounts: () => ({ data: {} }) },
    "@/hooks/useFeedback": { useFeedback: () => ({ capture: () => () => {} }) },
    "@/hooks/useDiscardChanges": { useDiscardChanges: () => (action: () => void) => action() },
    "@/constants/useFrameTheme": { useFrameTheme: () => ({ palette: {}, type: {} }) },
    "@/constants/theme": { spacing: {}, radii: {}, fonts: {} },
    "@/constants/productConfig": { PRODUCT_LIMITS: { futureProfilesPerHousehold: 6 } },
    "@/domain/playbackControls": { DEFAULT_MANAGED_PLAYBACK_CONTROLS: {} },
  };
  const runtime = { exports: {} as { default(props: any): Element }, require: (id: string) => modules[id] ?? { default: id } };
  runInNewContext(code, runtime);
  const render = () => {
    cursor = 0; refCursor = 0;
    const nodes: Element[] = [];
    const walk = (node: any) => { if (Array.isArray(node)) return node.forEach(walk); if (!node?.props) return; nodes.push(node); walk(node.props.children); };
    walk(runtime.exports.default({ visible: true, onClose() {} })); return nodes;
  };
  render().find(node => String(node.props.accessibilityLabel).startsWith("Manage Owner."))!.props.onPress();
  return { render, alerts, writes };
}

test("web and unavailable secure storage explain the allowance prerequisite without a dead navigation action", () => {
  for (const availability of ["web", "unavailable"] as const) {
    const ui = controls(availability, false);
    const nodes = ui.render();
    const row = nodes.find(node => node.props.title === "Daily viewing allowance")!;
    expect(row.props.disabled).toBe(true);
    expect(row.props.navigation).toBe(false);
    expect(nodes.some(node => typeof node.props.children === "string" && node.props.children.includes(availability === "web" ? "iPhone or Android app" : "Secure PIN storage is unavailable"))).toBe(true);
    // The callback also refuses entry if availability changes before a queued press.
    row.props.onPress();
    expect(ui.alerts.length).toBe(0);
    expect(ui.render().some(node => node.type === "@/components/AllowancePicker")).toBe(false);
    expect(ui.writes.length).toBe(0);
  }
});

test("native allowance entry without a PIN offers the working PIN setup route", () => {
  const ui = controls("available", false);
  const row = ui.render().find(node => node.props.title === "Daily viewing allowance")!;
  expect(row.props.disabled).toBe(false);
  expect(row.props.summary).toBe("Set up an Owner PIN first");
  row.props.onPress();
  expect(ui.alerts[0][0]).toBe("Create an Owner PIN first");
  ui.alerts[0][2].find((button: any) => button.text === "Add PIN").onPress();
  expect(ui.render().some(node => node.props.accessibilityLabel === "New Owner PIN")).toBe(true);
  expect(ui.writes.length).toBe(0);
});

test("native allowance entry with a PIN opens the picker and saves the chosen profile limit", async () => {
  const ui = controls("available", true);
  ui.render().find(node => node.props.title === "Daily viewing allowance")!.props.onPress();
  ui.render().find(node => node.type === "@/components/AllowancePicker")!.props.onChange({ mode: "dailyLimit", minutes: 45 });
  const save = ui.render().find(node => node.type === "Pressable" && node.props.children?.props?.children === "Save")!;
  expect(save.props.disabled).toBe(false);
  save.props.onPress();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ui.writes).toEqual([["owner-default", { mode: "dailyLimit", minutes: 45, commitment: true }]]);
});
