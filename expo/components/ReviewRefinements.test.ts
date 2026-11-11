import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import * as jsxRuntime from "react/jsx-runtime";

type Node = { type: unknown; props: Record<string, unknown> & { children?: Child; onPress?: () => void } };
type Child = Node | string | number | boolean | null | undefined | Child[];

function descendants(child: Child): Node[] {
  if (Array.isArray(child)) return child.flatMap(descendants);
  if (!child || typeof child !== "object") return [];
  return [child, ...descendants(child.props.children)];
}

function textContent(child: Child): string {
  if (Array.isArray(child)) return child.map(textContent).join(" ");
  if (typeof child === "string" || typeof child === "number") return String(child);
  return child && typeof child === "object" ? textContent(child.props.children) : "";
}

function harness(file: string, width = 390, overrides: Record<string, unknown> = {}, namedExport = "default") {
  const state: unknown[] = [];
  let cursor = 0;
  const modules: Record<string, unknown> = {
    react: {
      memo: (component: unknown) => component,
      useMemo: (compute: () => unknown) => compute(),
      useCallback: (callback: unknown) => callback,
      useEffect: () => {},
      useLayoutEffect: () => {},
      useRef: (current: unknown) => {
        const index = cursor++;
        return state[index] ?? (state[index] = { current });
      },
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value: unknown) => { state[index] = value; }];
      },
    },
    "react/jsx-runtime": jsxRuntime,
    "react-native": { Animated: { View: "Animated.View" }, View: "View", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 }, useWindowDimensions: () => ({ width, fontScale: 1 }) },
    "@/constants/onboardingPosters": { posterForTopic: () => 1 },
    "@/preview/mode": { PREVIEW_LIBRARY_ENABLED: false },
    "@/preview/library": { isPreviewVideo: () => false },
    "@/constants/motion": { motion: { galleryArrival: 840 } },
    "@/hooks/usePresentationProgress": { usePresentationProgress: () => ({ reduced: true, progress: { interpolate: () => 1 } }) },
    "@/hooks/useControlFeedback": { useControlFeedback: () => ({ events: {}, highlighted: false, reduced: true }) },
    "lucide-react-native": { Bookmark: "Bookmark", MoreHorizontal: "MoreHorizontal", Play: "Play", Rows3: "Rows3" },
    "expo-router": { router: {} },
    "@tanstack/react-query": { useQuery: () => ({ data: undefined }), skipToken: Symbol() },
    "@/constants/theme": { spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }, radii: {} },
    "@/constants/useFrameTheme": { useFrameTheme: () => ({ palette: {}, type: {} }) },
    "@/constants/navigation": { FRAME_PLAYBACK_ROUTE: "/watch/[id]" },
    "@/providers/AppProvider": { useApp: () => ({ activeProfileId: "owner", requirePurchase: () => true }) },
    "@/domain/contentPolicy": { durationDecision: () => "long", SHORT_FORM_MESSAGE: "Short video" },
    "@/domain/interests": { interestTopicFromId: (id: string) => ({ name: id }) },
    "@/domain/metadataRetention": { expireVideo: (video: unknown) => video, isMetadataCurrent: () => true },
    "@/services/youtube": { formatDuration: (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`, formatRelativeDate: () => "Yesterday" },
    "@/components/PrimaryAction": { default: "Pressable" },
    "@/components/PlaybackAction": { default: "Pressable" },
    "@/components/VideoSkeleton": { ThumbnailSkeleton: "ThumbnailSkeleton" },
    "@/domain/today": { tomorrowSnoozeTime: (now: number) => now + 86400000 },
    "./SnoozePicker": { default: "SnoozePicker" },
  };
  for (const name of ["FrameText", "motion/MotionView", "motion/PersonalizedPreview", "motion/DisclosureIndicator", "VideoDetailsRecovery", "MediaMount", "MediaImage", "GlassPlayMark", "Sheet"]) modules[`@/components/${name}`] = { default: name };
  modules["@/components/motion/PersonalizedPreview"] = { PrintWindow: "PrintWindow" };
  Object.assign(modules, overrides);
  const context = { exports: {} as Record<string, (props: Record<string, unknown>) => Node>, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Missing test module: ${name}`);
    return modules[name];
  } };
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  runInNewContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText, context);
  return (props: Record<string, unknown>) => { cursor = 0; return context.exports[namedExport](props); };
}

test("primary actions show depth only at rest and retain their press styling", () => {
  const render = harness("./PrimaryAction.tsx");
  const depth = { boxShadow: "0px 2px 0px #baa" };
  const style = ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.8 : 1 });
  for (const [disabled, busy] of [[false, false], [true, false], [false, true]]) {
    const button = render({ depth, disabled, accessibilityState: { busy }, style });
    const resolve = button.props.style as (state: { pressed: boolean }) => unknown[];
    expect(resolve({ pressed: false }).includes(depth)).toBe(!disabled && !busy);
    expect(resolve({ pressed: true })).not.toContain(depth);
    expect(resolve({ pressed: true })).toContainEqual({ opacity: 0.8 });
  }
});

test("playback press gives touch feedback and retains tint and focus without displacement in Reduce Motion", () => {
  for (const reduced of [false, true]) {
    const ring = { outlineColor: "#fff", outlineWidth: 2 };
    const render = harness("./PlaybackAction.tsx", 390, {
      "@/hooks/useControlFeedback": { useControlFeedback: () => ({ events: {}, highlighted: false, reduced, ring }) },
      "@/constants/useFrameTheme": { useFrameTheme: () => ({ palette: { accentDeep: "#36596b", active: "#36596b" } }) },
    });
    const control = render({ children: "Watch" });
    const style = control.props.style as (state: { pressed: boolean }) => Record<string, unknown>[];
    const children = control.props.children as unknown as (state: { pressed: boolean }) => Child;
    const pressed = style({ pressed: true }).filter(Boolean);
    expect(pressed).toContain(ring);
    expect(pressed.find(item => item.backgroundColor)?.backgroundColor).not.toBe("#36596b");
    expect(pressed.some(item => item.transform)).toBe(!reduced);
    const glyph = descendants(children({ pressed: true })).find(node => node.type === "View")!;
    expect((glyph.props.style as Record<string, unknown>[]).some(item => item && item.transform)).toBe(!reduced);
  }
});

test("inline guidance exposes its expanded state on web and native", () => {
  const render = harness("./InlineHelp.tsx");
  for (const open of [false, true, false]) {
    const root = render({ label: "About this time", children: "Playback only" });
    const control = descendants(root).find(node => node.type === "Pressable")!;
    expect(control.props["aria-expanded"]).toBe(open);
    expect(control.props.accessibilityState).toEqual({ expanded: open });
    expect(textContent(root).includes("Playback only")).toBe(open);
    control.props.onPress!();
  }
});

test("filter motion keeps the choices present on entry and removes displacement for keyboard and Reduce Motion", () => {
  for (const [reduced, instant] of [[false, false], [true, false], [false, true]]) {
    const timings: number[] = [];
    const render = harness("./motion/ActionReveal.tsx", 390, {
      react: {
        useState: (initial: boolean) => [initial, () => {}], useRef: (current: number) => ({ current }),
        useCallback: (fn: unknown) => fn, useLayoutEffect: (effect: () => unknown) => effect(),
      },
      "@/hooks/useReducedMotion": { useReducedMotion: () => reduced },
      "@/constants/motion": { motion: { choice: 180 } },
      "react-native-worklets": { scheduleOnRN: () => {} },
      "react-native-reanimated": {
        default: { View: "View" }, useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (compute: () => unknown) => compute(),
        Easing: { out: () => undefined }, ReduceMotion: { Never: "never" },
        // Hold the first frame; the group must be available before timing completes.
        withTiming: (_: number, config: { duration: number }) => { timings.push(config.duration); return 0; },
      },
    });
    const surface = render({ open: true, instant, offset: -4, children: "Filters" });
    expect(surface.props.children).toBe("Filters");
    expect(surface.props.pointerEvents).toBe("auto");
    expect(surface.props["aria-hidden"]).toBe(false);
    expect(surface.props.style).toEqual({ opacity: instant ? 1 : reduced ? 0.85 : 0.65, transform: [{ translateY: instant || reduced ? 0 : -4 }] });
    expect(timings).toEqual(instant ? [] : [reduced ? 100 : 180]);
  }
});

test("gallery brings real companions forward without watching or following on selection", () => {
  const render = galleryHarness(true, []);
  const watched: string[] = [], followed: string[] = [];
  const items = ["First", "Second", "Third"].map((title) => ({ providerSourceId: title, displayName: title, featuredMedia: { title, durationSeconds: 540 }, fetchedAt: 1 }));
  const props = { items, onBrowse: () => {}, isFollowed: () => false, onWatch: (pick: typeof items[number]) => watched.push(pick.providerSourceId), onFollow: (pick: typeof items[number]) => followed.push(pick.providerSourceId) };
  const controls = () => descendants(render(props));
  const button = (label: string) => controls().find(node => node.props.accessibilityLabel === label);
  expect(button("Watch First")).toBeDefined();
  expect(button("Bring forward: First")).toBeUndefined();
  button("Bring forward: Third")!.props.onPress!();
  expect(button("Watch Third")).toBeDefined();
  expect(button("Bring forward: First")).toBeDefined();
  expect(watched).toEqual([]); expect(followed).toEqual([]);
  button("Watch Third")!.props.onPress!(); button("Follow Third")!.props.onPress!();
  expect(watched).toEqual(["Third"]); expect(followed).toEqual(["Third"]);
  const single = descendants(render({ ...props, items: items.slice(0, 1) }));
  expect(single.some(node => String(node.props.accessibilityLabel).startsWith("Bring forward:"))).toBe(false);
});

function galleryHarness(reduced: boolean, timings: number[], pointer = true) {
  let progress = 1;
  const shared = { get: () => progress, set: (v: number) => { progress = v; } };
  return harness("./PickGallery.tsx", 390, {
    "@/components/motion/pointerActivation": { isPointerActivation: () => pointer },
    "@/hooks/useMotionVisibility": { useMotionVisibility: () => true },
    "@/hooks/usePresentationProgress": { usePresentationProgress: () => ({ reduced, progress: { interpolate: () => 1 } }) },
    "@/constants/motion": { motion: { state: 220, galleryArrival: 840 } },
    "react-native-reanimated": {
      default: { View: "AnimatedPrint" }, useSharedValue: () => shared,
      useAnimatedStyle: (read: () => unknown) => read(),
      cancelAnimation: () => {}, Easing: { out: () => undefined }, ReduceMotion: {},
      withTiming: (value: number, config: {duration: number}) => { timings.push(config.duration); return value; },
    },
  });
}

test("only the current promoted poster can settle after loading, including a return to the same pick", () => {
  for (const [reduced, pointer] of [[false, true], [true, true], [false, false]]) {
    const timings: number[] = [];
    const render = galleryHarness(reduced, timings, pointer);
    const items = ["A", "B", "C"].map(title => ({ providerSourceId: title, displayName: title, featuredMedia: { title }, fetchedAt: 1 }));
    const watched: string[] = [];
    const nodes = () => descendants(render({ items, onBrowse() {}, isFollowed: () => false,
      onWatch: (pick: typeof items[number]) => watched.push(pick.providerSourceId) }));
    const press = (label: string) => nodes().find(node => node.props.accessibilityLabel === label)!.props.onPress!();
    const artwork = () => descendants(nodes().find(node => node.type === "PrintWindow")!.props.image as Child);
    const load = () => artwork().find(node => node.type === "MediaImage")!.props.onLoad as () => void;
    press("Bring forward: B");
    const oldB = load();
    press("Watch B");
    expect(watched).toEqual(["B"]);
    press("Next pick");
    oldB();
    expect(nodes().some(node => node.props.accessibilityLabel === "Watch C")).toBe(true);
    press("Bring forward: B");
    oldB();
    expect(timings).toEqual([]);
    const style = artwork().find(node => node.type === "AnimatedPrint")!.props.style;
    expect(style).toEqual({ opacity: pointer && reduced ? 0.85 : 1, transform: [{ scale: pointer && !reduced ? 1.025 : 1 }] });
    load()();
    load()();
    expect(timings).toEqual(pointer ? [reduced ? 100 : 220] : []);
  }
});

test("print-room light only runs while visible with motion enabled, and stops on cleanup", () => {
  for (const [visible, reduced] of [[true, false], [true, true], [false, false]]) {
    let starts = 0, stops = 0;
    const targets: number[] = [];
    const cleanups: (() => void)[] = [];
    class Value { setValue() {} interpolate() { return 0; } }
    const render = harness("./motion/CuratingSelection.tsx", 390, {
      react: { useState: () => [350, () => {}], useRef: (current: unknown) => ({ current }), useEffect: (effect: () => (() => void) | undefined) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } },
      "react-native": { View: "View", StyleSheet: { create: (styles: unknown) => styles }, Easing: { linear: () => {} }, Animated: { View: "Animated.View", Value, timing: () => ({}), loop: () => ({ start: () => { starts++; }, stop: () => { stops++; } }) } },
      "expo-linear-gradient": { LinearGradient: "LinearGradient" },
      "@/components/ProgrammeGrain": { default: "ProgrammeGrain" },
      "@/components/motion/PrintStudy": { default: "PrintStudy" },
      "@/hooks/useMotionTarget": { useMotionTarget: (target: number) => { targets.push(target); return new Value(); } },
      "@/hooks/useMotionVisibility": { useMotionVisibility: () => visible },
      "@/hooks/useReducedMotion": { useReducedMotion: () => reduced },
    }, "CuratingSelection");
    const root = render({ stage: "review" });
    expect(textContent(root)).toContain("Reviewing video quality");
    expect(descendants(root).filter(node => node.type === "PrintStudy")).toHaveLength(3);
    expect(starts).toBe(visible && !reduced ? 1 : 0);
    expect(targets).toEqual([reduced ? 2 : 1]);
    cleanups.forEach(cleanup => cleanup()); expect(stops).toBe(starts);
  }
});

test("every saved-card layout prioritizes resume time over publication age", () => {
  const video = { id: "sample", title: "A film", channelTitle: "A source", durationSeconds: 2570, thumbnailUrl: "", publishedAt: "2026-10-31", fetchedAt: Date.now() };
  for (const variant of ["full", "wide", "compact"]) {
    const render = harness("./VideoCard.tsx");
    const resumed = render({ video, variant, progressSeconds: 428 });
    expect(textContent(resumed)).toContain("Resume at 7:08");
    expect(textContent(resumed)).not.toContain("Yesterday");
    for (const progressSeconds of [undefined, 0]) {
      const unwatched = render({ video, variant, progressSeconds });
      expect(textContent(unwatched)).toContain("Yesterday");
      expect(textContent(unwatched)).not.toContain("Resume at");
    }
  }
});

test("Today names the film before its artwork and gives Watch a contextual label", () => {
  const render = harness("./TodayVideoCard.tsx");
  let watched = 0;
  const root = render({ item: { id: "sample", title: "A forest", sourceTitle: "Fieldwork", durationSeconds: 1084 }, busy: false, onWatch: () => { watched++; } });
  const nodes = descendants(root);
  const titleIndex = nodes.findIndex(node => node.props.children === "A forest");
  const imageIndex = nodes.findIndex(node => node.type === "MediaImage");
  expect(titleIndex).toBeGreaterThanOrEqual(0);
  expect(imageIndex).toBeGreaterThan(titleIndex);
  const watch = nodes.find(node => node.props.accessibilityLabel === "Watch A forest")!;
  expect(watch.props.accessibilityRole).toBe("button");
  watch.props.onPress!();
  expect(watched).toBe(1);
});

test("narrow Today uses four paired action cells, including a visible More label", () => {
  const root = harness("./TodayVideoCard.tsx", 320)({ item: { id: "sample", title: "A forest", sourceTitle: "Fieldwork", durationSeconds: 1084 }, busy: false });
  const controls = descendants(root).filter(node => node.type === "Pressable").slice(1);
  expect(controls).toHaveLength(4);
  for (const control of controls) {
    const style = (control.props.style as (state: { pressed: boolean }) => unknown[])({ pressed: false });
    expect(style).toContainEqual({ flexBasis: "46%", flexGrow: 1, marginLeft: 0 });
  }
  expect(textContent(controls[3])).toContain("More");
});

test("video options dismiss or open snooze inside the same sheet, with error and busy states", () => {
  const render = harness("./SnoozeModal.tsx");
  let dismissed = 0;
  let closed = 0;
  const props = { visible: true, title: "A forest", onDismiss: () => { dismissed++; }, onClose: () => { closed++; }, onSnooze: () => {} };
  const root = render(props);
  const action = (tree: Node, label: string) => descendants(tree).find(node => node.type === "Pressable" && textContent(node) === label)!;
  expect(root.type).toBe("Sheet");
  expect(textContent(root)).toContain("Video options");
  action(root, "Dismiss from Today").props.onPress!();
  expect(dismissed).toBe(1);
  action(root, "Snooze").props.onPress!();
  const snooze = render(props);
  expect(snooze.type).toBe(root.type);
  expect(textContent(snooze)).toContain("Snooze video");
  (snooze.props.onBack as () => void)();
  expect(textContent(render(props))).toContain("Video options");
  const failed = render({ ...props, error: "Couldn’t dismiss. Try again." });
  expect(textContent(failed)).toContain("Couldn’t dismiss. Try again.");
  const busy = render({ ...props, busy: true });
  expect(action(busy, "Dismissing…").props.disabled).toBe(true);
  (busy.props.onClose as () => void)();
  expect(closed).toBe(0);
});
