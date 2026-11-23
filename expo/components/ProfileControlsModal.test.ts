import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";

type Element = { type: unknown; props: Record<string, any> };
const code = transpileModule(readFileSync(new URL("./ProfileControlsModal.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
}).outputText;

function controls(availability: "available" | "web" | "unavailable", hasPin: boolean, review?: {
  authorized: boolean;
  decisionResult?: { ok: boolean; message: string };
  afterDecision?: Promise<void>;
}, readAllowance: () => Promise<unknown> = async () => ({ mode: "unlimited" }), paused = false) {
  const state: unknown[] = []; const refs: { current: unknown }[] = [];
  const effects: { deps: unknown[]; cleanup?: () => void }[] = [];
  const callbacks: { deps: unknown[]; callback: unknown }[] = [];
  let effectCursor = 0;
  let callbackCursor = 0;
  let queuedEffects: (() => void)[] = [];
  const changed = (previous: unknown[], next: unknown[]) => next.some((item, index) => item !== previous[index]);
  let cursor = 0; let refCursor = 0;
  const controlReads: string[][] = []; const writes: any[][] = []; const announcements: string[] = [];
  const owner = { id: "owner-default", name: "Owner", role: "owner" };
  const app = {
    profiles: [owner, { id: "managed", name: "Learner", role: "managed" }], activeProfileId: owner.id, isOwnerAuthorized: review?.authorized ?? true,
    getManagedContentOverview: async (id: string) => { controlReads.push(["content", id]); if (writes.length) await review?.afterDecision; writes.push(["read requests", id]); return { policy: { mode: "selectedVideos" }, requests: [] }; },
    reviewManagedApprovalRequest: async () => review?.decisionResult,
    ownerPinAvailability: availability, hasOwnerPin: hasPin,
    getPlaybackAllowance: async () => paused ? { kind: "restricted", canPlay: false, restriction: "paused" } : { kind: "unlimited", canPlay: true },
    getProfileViewingAllowance: async (id: string) => { controlReads.push(["allowance", id]); return readAllowance(); },
    getManagedPlaybackControls: async (id: string) => { controlReads.push(["controls", id]); return {}; },
    saveOwnerPin: async () => { app.hasOwnerPin = true; app.isOwnerAuthorized = false; return { ok: true, message: "Owner PIN added." }; },
    createManagedProfile: async (name: string) => { const profile = { id: "created", name, role: "managed" }; app.profiles.push(profile); return { ok: true, profileId: profile.id, message: "Profile created" }; },
    requestOwnerAuthorization: async (_fresh?: boolean, _instruction?: string) => { app.isOwnerAuthorized = true; return true; },
    setProfileViewingAllowance: async (...args: any[]) => { writes.push(args); return { ok: true, message: "Saved" }; },
  };
  const jsx = (type: unknown, props: Element["props"]): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useMemo: (build: () => unknown) => build(),
      useCallback(fn: unknown, deps: unknown[]) {
        const index = callbackCursor++;
        if (!callbacks[index] || changed(callbacks[index].deps, deps)) callbacks[index] = { callback: fn, deps };
        return callbacks[index].callback;
      },
      useEffect(fn: () => (() => void) | void, deps: unknown[]) {
        const index = effectCursor++;
        const previous = effects[index];
        if (!previous || changed(previous.deps, deps)) queuedEffects.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps, cleanup: fn() || undefined };
        });
      },
      useRef: (initial: unknown) => { const index = refCursor++; return refs[index] ?? (refs[index] = { current: initial }); },
      useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { View: "View", Pressable: "Pressable", Platform: { OS: "ios" }, AccessibilityInfo: { announceForAccessibility: (message: string) => announcements.push(message) }, StyleSheet: { create: (styles: unknown) => styles } },
    "@/providers/AppProvider": { useApp: () => app },
    "@/hooks/useApprovalRequestCounts": { useApprovalRequestCounts: () => ({ data: {} }) },
    "@/hooks/useFeedback": { useFeedback: () => ({ capture: () => () => {} }) },
    "@/hooks/useDiscardChanges": { useDiscardChanges: () => (action: () => void) => action() },
    "@/constants/useFrameTheme": { useFrameTheme: () => ({ palette: {}, type: {} }) },
    "@/constants/theme": { spacing: {}, radii: {}, fonts: {} },
    "@/constants/productConfig": { PRODUCT_LIMITS: { futureProfilesPerHousehold: 6 } },
    "@/domain/playbackControls": { DEFAULT_MANAGED_PLAYBACK_CONTROLS: {}, validateManagedPlaybackControls: () => null },
  };
  const runtime = { setTimeout: () => 0, clearTimeout: () => {}, exports: {} as { default(props: any): Element }, require: (id: string) => modules[id] ?? { default: id } };
  runInNewContext(code, runtime);
  const render = (visible = true) => {
    cursor = 0; refCursor = 0; callbackCursor = 0; effectCursor = 0; queuedEffects = [];
    const nodes: Element[] = [];
    const walk = (node: any) => { if (Array.isArray(node)) return node.forEach(walk); if (!node?.props) return; nodes.push(node); walk(node.props.children); };
    walk(runtime.exports.default({ visible, initialReviewId: review ? "managed" : undefined, onClose() {} }));
    queuedEffects.forEach((effect) => effect());
    return nodes;
  };
  const initial = render();
  if (!review) initial.find(node => String(node.props.accessibilityLabel).startsWith(paused ? "Manage Learner." : "Manage Owner."))!.props.onPress();
  return { render, controlReads, writes, announcements, app };
}

test("a protected review reports its result before the list refresh, and fades only successful pointer decisions", async () => {
  for (const [decision, pointer, ok, message] of [
    ["approve", true, true, "Approved Big Buck Bunny for Learner."],
    ["deny", true, true, "Declined Learner’s request for Big Buck Bunny."],
    ["approve", false, true, "Approved Big Buck Bunny for Learner."],
    ["deny", true, false, "Owner authorization is required."],
  ] as const) {
    let finish!: () => void;
    const afterDecision = new Promise<void>(resolve => { finish = resolve; });
    const ui = controls("available", true, { authorized: true, decisionResult: { ok, message }, afterDecision });
    await new Promise(resolve => setTimeout(resolve, 0));
    ui.render().find(node => node.type === "@/components/ManagedContentAccessEditor")!.props.onReview({ kind: "video", targetId: "bunny", requestedAt: 1 }, decision, pointer);
    await new Promise(resolve => setTimeout(resolve, 0));
    const nodes = ui.render();
    expect(nodes.find(node => node.props.role === "status")?.props.children).toBe(message);
    expect(nodes.find(node => node.type === "@/components/motion/ActionReveal")?.props.instant).toBe(!(pointer && ok));
    expect(ui.announcements).toEqual(ok ? [message] : []);
    expect(ui.writes).toEqual([["read requests", "managed"]]);
    finish();
  }
});

test("web and unavailable secure storage explain the allowance prerequisite without a dead navigation action", () => {
  for (const availability of ["web", "unavailable"] as const) {
    const ui = controls(availability, false);
    const nodes = ui.render();
    const row = nodes.find(node => node.props.title === "Daily viewing limit")!;
    expect(row.props.disabled).toBe(true);
    expect(row.props.navigation).toBe(false);
    expect(nodes.some(node => String(node.props.children).includes(availability === "web" ? "iPhone or Android app" : "Secure PIN storage is unavailable"))).toBe(true);
    // The callback also refuses entry if availability changes before a queued press.
    row.props.onPress();
    expect(ui.controlReads).toEqual([]);
    expect(ui.render().some(node => node.type === "@/components/AllowancePicker")).toBe(false);
    expect(ui.writes.length).toBe(0);
  }
});

for (const [title, kind, component] of [
  ["Daily viewing limit", "allowance", "@/components/AllowancePicker"],
  ["Schedule & pauses", "controls", "@/components/ManagedPlaybackControlsEditor"],
  ["Content & requests", "content", "@/components/ManagedContentAccessEditor"],
]) {
  test(`setting up a PIN from ${title} resumes the same profile and control only after unlock`, async () => {
    const ui = controls("available", false, undefined, undefined, true);
    let verification = "";
    ui.app.requestOwnerAuthorization = async (fresh, instruction) => {
      expect(fresh).toBe(true);
      verification = instruction ?? "";
      return false;
    };
    ui.render().find(node => node.props.title === title)!.props.onPress();
    const fields = ui.render();
    expect(fields.some(node => String(node.props.children).includes(`open ${title} for Learner`))).toBe(true);
    fields.find(node => node.props.accessibilityLabel === "New Owner PIN")!.props.onChangeText("1234");
    fields.find(node => node.props.accessibilityLabel === "Confirm PIN")!.props.onChangeText("1234");
    ui.render().find(node => node.props.children?.props?.children === "Save PIN")!.props.onPress();
    await new Promise(resolve => setTimeout(resolve, 0));
    const locked = ui.render();
    expect(locked.some(node => node.props.children === "Unlock to continue")).toBe(true);
    expect(locked.some(node => node.type === component)).toBe(false);
    expect(ui.controlReads).toEqual([]);
    expect(verification).toContain("Learner");
    expect(locked.some(node => node.props.children === verification)).toBe(true);
    ui.render();
    expect(ui.controlReads).toEqual([]);
    ui.app.isOwnerAuthorized = true;
    ui.render();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ui.controlReads).toEqual([[kind, "managed"]]);
    expect(ui.render().some(node => node.type === component)).toBe(true);
  });
}

test("canceling PIN setup returns to the profile without opening a protected setting", () => {
  const ui = controls("available", false);
  ui.render().find(node => node.props.title === "Daily viewing limit")!.props.onPress();
  ui.render().find(node => node.props.accessibilityLabel === "Back to Owner")!.props.onPress();
  expect(ui.render().some(node => node.props.title === "Daily viewing limit")).toBe(true);
  expect(ui.controlReads).toEqual([]);
});

test("native allowance entry with a PIN opens the picker and saves the chosen profile limit", async () => {
  const ui = controls("available", true);
  ui.render().find(node => node.props.title === "Daily viewing limit")!.props.onPress();
  ui.render();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ui.render().find(node => node.type === "@/components/AllowancePicker")!.props.value).toEqual({ mode: "unlimited" });
  ui.render().find(node => node.type === "@/components/AllowancePicker")!.props.onChange({ mode: "dailyLimit", minutes: 45 });
  const save = ui.render().find(node => node.props.accessibilityRole === "button" && node.props.children?.props?.children === "Save daily limit")!;
  expect(save.props.disabled).toBe(false);
  save.props.onPress();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ui.writes).toEqual([["owner-default", { mode: "dailyLimit", minutes: 45, commitment: false }]]);
});

test("a paused profile's saved daily limit can be retried without opening an editor with a substitute value", async () => {
  let attempts = 0;
  const saved = { mode: "dailyLimit", minutes: 65, commitment: false };
  const ui = controls("available", true, undefined, async () => {
    if (++attempts === 2) throw new Error("Unavailable");
    return saved;
  }, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ui.render().some(node => node.props.children === "Managed · Paused")).toBe(true);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ui.render().find(node => node.props.title === "Daily viewing limit")?.props.value).toBe("65 min");
  const open = () => ui.render().find(node => node.props.title === "Daily viewing limit")!.props.onPress();
  open();
  ui.render();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ui.render().some(node => node.type === "@/components/AllowancePicker")).toBe(false);
  expect(ui.writes).toEqual([]);
  open();
  ui.render();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ui.render().find(node => node.type === "@/components/AllowancePicker")!.props.value).toEqual(saved);
});

test("an in-flight protected read is discarded when the panel closes", async () => {
  let finish!: (value: unknown) => void;
  const read = new Promise(resolve => { finish = resolve; });
  const ui = controls("available", true, undefined, () => read);
  ui.render().find(node => node.props.title === "Daily viewing limit")!.props.onPress();
  ui.render();
  expect(ui.controlReads).toEqual([["allowance", "owner-default"]]);
  ui.render(false);
  finish({ mode: "dailyLimit", minutes: 15 });
  await new Promise(resolve => setTimeout(resolve, 0));
  const reopened = ui.render();
  expect(reopened.some(node => node.type === "@/components/AllowancePicker")).toBe(false);
  expect(reopened.some(node => node.props.title === "Add profile")).toBe(true);
});

test("Add profile explains both roles before opening their editors and keeps managed creation on supported devices", () => {
  for (const availability of ["available", "web"] as const) {
    const ui = controls(availability, true);
    ui.render().find(node => node.props.accessibilityLabel === "Back to Profiles")!.props.onPress();
    ui.render().find(node => node.props.title === "Add profile")!.props.onPress();
    const choices = ui.render();
    const standard = choices.find(node => node.props.title === "Standard profile")!;
    const managed = choices.find(node => node.props.title === "Managed profile")!;
    expect(standard.props.summary).toContain("own sources");
    expect(managed.props.disabled).toBe(availability === "web");
    standard.props.onPress();
    expect(ui.render().some(node => node.props.accessibilityLabel === "Profile name")).toBe(true);
    ui.render().find(node => node.props.accessibilityLabel === "Back to Profile types")!.props.onPress();
    expect(ui.render().some(node => node.props.title === "Managed profile")).toBe(true);
  }
});

test("a pending-request shortcut opens the requested managed profile only with Owner access and a supported PIN", async () => {
  for (const [availability, pin, authorized, canReview] of [
    ["available", true, true, true],
    ["available", true, false, false],
    ["available", false, true, false],
    ["web", false, true, false],
  ] as const) {
    const ui = controls(availability, pin, { authorized });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ui.writes).toEqual(canReview ? [["read requests", "managed"]] : []);
    expect(ui.render().some(node => node.type === "@/components/ManagedContentAccessEditor")).toBe(canReview);
  }
});

test("Managed creation takes the Owner to the persisted viewer and offers PIN setup only when needed", async () => {
  for (const hasPin of [false, true]) {
    const ui = controls("available", hasPin);
    ui.render().find(node => node.props.accessibilityLabel === "Back to Profiles")!.props.onPress();
    ui.render().find(node => node.props.title === "Add profile")!.props.onPress();
    ui.render().find(node => node.props.title === "Managed profile")!.props.onPress();
    ui.render().find(node => node.props.accessibilityLabel === "Profile name")!.props.onChangeText("Studio");
    ui.render().find(node => node.props.children?.props?.children === "Create profile")!.props.onPress();
    await new Promise(resolve => setTimeout(resolve, 0));
    const nodes = ui.render();
    expect(nodes.some(node => node.props.label === "Studio")).toBe(true);
    expect(nodes.some(node => node.props.title === "Add Owner PIN")).toBe(!hasPin);
    expect(ui.app.activeProfileId).toBe("owner-default");
  }
});

test("a completed PIN mismatch stays by confirmation and clears after correction", () => {
  const ui = controls("available", false);
  ui.render().find(node => node.props.title === "Daily viewing limit")!.props.onPress();
  const field = (label: string) => ui.render().find(node => node.props.accessibilityLabel === label)!.props;
  field("New Owner PIN").onChangeText("123456");
  field("Confirm PIN").onChangeText("123455");
  expect(field("Confirm PIN").accessibilityHint).toContain("Re-enter");
  const save = () => ui.render().find(node => node.props.children?.props?.children === "Save PIN")!.props;
  expect(save().disabled).toBe(true);
  field("Confirm PIN").onChangeText("123456");
  expect(field("Confirm PIN").accessibilityHint).toBeUndefined();
  expect(save().disabled).toBe(false);
});
