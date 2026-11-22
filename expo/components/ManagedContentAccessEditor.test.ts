import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import { collectionPage } from "@/domain/collectionPage";

type Element = { type: string | { name: string }; props: Record<string, any> };
test("the actual approval editor renders bounded pages and searches across the entire library", () => {
  const state: unknown[] = []; let cursor = 0;
  const jsx = (type: Element["type"], props: Element["props"]): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    react: { useMemo: (build: () => unknown) => build(), useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; } },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { View: "View", StyleSheet: { create: (value: unknown) => value }, Alert: { alert() {} } },
    "@/domain/collectionPage": { collectionPage },
    "@/constants/useFrameTheme": { useFrameTheme: () => ({ palette: {}, type: {} }) },
    "@/constants/theme": { spacing: {}, radii: {} },
  };
  const runtime = { exports: {} as { default(props: any): Element }, require: (id: string) => modules[id] ?? { default: id } };
  const code = transpileModule(readFileSync(new URL("./ManagedContentAccessEditor.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText;
  runInNewContext(code, runtime);
  const entries = Array.from({ length: 1003 }, (_, i) => ({ id: String(i), targetId: String(i), title: `Video ${i}`, channelTitle: "Creator", kind: "video", sourceTitle: "Creator" }));
  const props = { value: { policy: { mode: "selectedVideos" }, requests: entries, approvedVideos: entries, approvedSources: [] }, busy: false, expanded: null, onExpand() {} };
  const render = () => { cursor = 0; const tree = runtime.exports.default(props); const all: Element[] = []; const walk = (node: any) => { if (Array.isArray(node)) return node.forEach(walk); if (!node?.props) return; all.push(node); walk(node.props.children); }; walk(tree); return all; };
  let nodes = render();
  const rows = () => nodes.filter(node => typeof node.type !== "string" && node.type?.name === "ApprovalRow");
  expect(rows().length).toBe(20);
  expect(nodes.filter(node => String(node.props.accessibilityLabel).startsWith("Review Video")).length).toBe(20);
  nodes.find(node => node.props.label === "Approvals")!.props.onChange(50);
  nodes = render(); expect(rows().length).toBe(3); expect(rows()[2].props.title).toBe("Video 1002");
  nodes.find(node => node.props.accessibilityLabel === "Find an existing approval")!.props.onChangeText("Video 1002");
  nodes = render(); expect(rows().length).toBe(1); expect(rows()[0].props.title).toBe("Video 1002");
  expect(entries.length).toBe(1003);
});
