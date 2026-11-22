import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import * as jsxRuntime from "react/jsx-runtime";

type Node = { type: unknown; props: { children?: Node | Node[]; style?: unknown; hidden?: boolean; testID?: string } };
type LayoutProps = {
  width: number;
  height: number;
  fullscreen: boolean;
  tvDetailsOpen?: boolean;
  insets: { top: number; right: number; bottom: number; left: number };
  children: Node;
  chrome: Node;
  landscapeControls: Node;
  details: Node;
};

function harness(platform = "android", isTV = false) {
  const options: { navigationBarHidden: boolean }[] = [];
  const cleanups: (() => void)[] = [];
  const navigation = { setOptions: (value: { navigationBarHidden: boolean }) => options.push(value) };
  const modules: Record<string, unknown> = {
    react: { useLayoutEffect: (effect: () => (() => void) | void) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } },
    "react/jsx-runtime": jsxRuntime,
    "react-native": { Platform: { OS: platform, isTV }, View: "View", StyleSheet: { create: (styles: unknown) => styles } },
    "expo-router": { useNavigation: () => navigation },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "@/constants/theme": { spacing: { sm: 8 }, watchPalette: { stage: "#202021" } },
  };
  const context = { exports: {} as { default(props: LayoutProps): Node }, require: (name: string) => modules[name] };
  const source = readFileSync(new URL("./WatchPlayerLayout.tsx", import.meta.url), "utf8");
  runInNewContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText, context);
  const player = { type: "player", props: {} };
  const props: LayoutProps = { width: 393, height: 851, fullscreen: false, insets: { top: 24, right: 0, bottom: 24, left: 0 }, children: player, chrome: { type: "chrome", props: {} }, landscapeControls: { type: "controls", props: {} }, details: { type: "details", props: {} } };
  return { render: (overrides: Partial<LayoutProps> = {}) => context.exports.default({ ...props, ...overrides }), player, options, dispose: () => cleanups.forEach(cleanup => cleanup()) };
}

function children(node: Node): Node[] {
  return Array.isArray(node.props.children) ? node.props.children : node.props.children ? [node.props.children] : [];
}

function style(node: Node): Record<string, unknown> {
  return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
}

test("Android landscape gives the player the full viewport without a left rail or safe-area padding", () => {
  const layout = harness();
  for (const [width, height] of [[851, 393], [800, 450], [1024, 768]]) {
    for (const [left, right] of [[0, 0], [48, 0], [0, 48], [32, 24]]) {
      const root = layout.render({ width, height, insets: { top: 24, right, bottom: 24, left } });
      const [status, chrome, area, details] = children(root);
      const [frame, rail] = children(area);
      expect(status.props.hidden).toBe(true);
      expect(style(area)).toEqual({ flex: 1, backgroundColor: "#202021" });
      expect(style(frame)).toEqual({ flex: 1, width: "100%" });
      expect(style(rail).display).toBe("none");
      expect(style(chrome).display).toBe("none");
      expect(style(details).display).toBe("none");
    }
  }
  expect(layout.options.at(-1)?.navigationBarHidden).toBe(true);
  layout.dispose();
  expect(layout.options.at(-1)?.navigationBarHidden).toBe(false);
});

test("rotation and fullscreen keep the player at the same reconciliation path", () => {
  for (const platform of ["android", "ios", "web"]) {
    const layout = harness(platform);
    let originalPath: unknown[] | undefined;
    for (const overrides of [{}, { fullscreen: true }, { width: 851, height: 393, fullscreen: true }, { width: 851, height: 393 }, {}]) {
      const root = layout.render(overrides);
      const area = children(root)[2];
      const frame = children(area)[0];
      const path = [root.type, children(root).length, area.type, children(area).length, frame.type];
      originalPath ??= path;
      expect(path).toEqual(originalPath);
      expect(frame.props.children).toBe(layout.player);
    }
    layout.dispose();
  }
});

test("fullscreen is edge-to-edge before rotation completes, with no Frame controls over the player", () => {
  for (const platform of ["android", "ios"]) {
    const layout = harness(platform);
    const root = layout.render({ fullscreen: true });
    const [status, chrome, area, details] = children(root);
    expect(status.props.hidden).toBe(true);
    expect(style(area).paddingLeft).toBeUndefined();
    expect(style(children(area)[0])).toEqual({ flex: 1, width: "100%" });
    for (const control of [chrome, children(area)[1], details]) expect(style(control).display).toBe("none");
    layout.dispose();
  }
});

test("portrait restores chrome and system bars; iOS landscape retains safe controls", () => {
  const android = harness();
  android.render({ width: 851, height: 393 });
  const portrait = android.render();
  expect(children(portrait)[0].props.hidden).toBe(false);
  expect(style(children(portrait)[1]).display).toBeUndefined();
  expect(android.options.at(-1)?.navigationBarHidden).toBe(false);
  expect(style(children(children(portrait)[2])[0]).width).toBeCloseTo(393);
  android.dispose();
  const ios = harness("ios");
  const landscape = ios.render({ width: 851, height: 393, insets: { top: 0, left: 48, right: 0, bottom: 21 } });
  const area = children(landscape)[2];
  expect(style(area).paddingLeft).toBe(112);
  expect(style(children(area)[1]).left).toBe(48);
  ios.dispose();
});

test("Android TV keeps remote controls beside a 16:9 picture until fullscreen", () => {
  const layout = harness("android", true);
  const size = { width: 960, height: 540, insets: { left: 0, top: 0, right: 0, bottom: 0 } };
  const root = layout.render(size);
  const [frame, rail] = children(children(root)[2]);
  expect(style(rail).display).toBeUndefined();
  expect(Number(style(rail).left)).toBeGreaterThan(0);
  expect(Number(style(frame).width) / Number(style(frame).height)).toBeCloseTo(16 / 9);
  const withDetails = layout.render({ ...size, tvDetailsOpen: true });
  expect(Number(style(children(withDetails)[3]).width)).toBeGreaterThan(0);
  const smallerFrame = children(children(withDetails)[2])[0];
  expect(Number(style(smallerFrame).width)).toBeLessThan(Number(style(frame).width));
  expect(smallerFrame.props.children).toBe(layout.player);
  const fullscreen = layout.render({ ...size, fullscreen: true });
  expect(style(children(children(fullscreen)[2])[1]).display).toBe("none");
  expect(children(children(fullscreen)[2])[0].props.children).toBe(layout.player);
  layout.dispose();
});
