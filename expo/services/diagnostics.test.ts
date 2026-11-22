import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import { buildSupportReport } from "@/domain/supportDiagnostics";

test("production Android diagnostics opens and shares only after an explicit press", async () => {
  const shared: { title: string; message: string }[] = [];
  const jsx = (type: any, props: any) => ({ type, props });
  const modules: Record<string, unknown> = {
    react: { useMemo: (build: () => unknown) => build(), useState: (initial: unknown) => [initial, () => {}] },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", ScrollView: "ScrollView", Pressable: "Pressable", Platform: { OS: "android", Version: 34 }, Share: { share: async (payload: any) => { shared.push(payload); } }, StyleSheet: { create: (styles: unknown) => styles } },
    "expo-constants": { default: { nativeAppVersion: "1.0.0", nativeBuildVersion: "2" } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0 }) },
    "@/constants/useFrameTheme": { useFrameTheme: () => ({ palette: {}, type: {} }) },
    "@/constants/theme": { spacing: {}, radii: {} },
    "@/constants/config": { APP_ENV: "production", IS_CLOSED_BETA: false, isGooglePlatformConfigured: () => false },
    "@/domain/supportDiagnostics": { buildSupportReport },
    "@tanstack/react-query": { useQuery: ({ queryKey }: any) => ({ data: queryKey[1] === "database" ? { version: 13, storage: "sqlite", tables: [] } : { state: "succeeded", diskCleared: true, memoryCleared: true } }) },
  };
  const runtime = { exports: {} as any, require: (id: string) => modules[id] ?? { default: id } };
  runInNewContext(transpileModule(readFileSync(new URL("../app/diagnostics.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText, runtime);
  const route = runtime.exports.default();
  const nodes: any[] = [];
  const walk = (node: any) => { if (Array.isArray(node)) return node.forEach(walk); if (!node?.props) return; nodes.push(node); walk(node.props.children); };
  walk(route.type(route.props));
  expect(shared.length).toBe(0);
  const share = nodes.find(node => node.props.accessibilityRole === "button" && node.props.children?.props?.children === "Share diagnostic report");
  expect(Boolean(share)).toBe(true);
  share.props.onPress();
  await Promise.resolve();
  expect(shared.length).toBe(1);
  expect(shared[0].message).toContain("Version: 1.0.0 · Build: 2");
  expect(shared[0].message).toContain("Environment: production");
  expect(shared[0].message).toContain("Storage: sqlite");
  expect(shared[0].message).not.toContain("profile");
});

test("sample library cannot activate or read browser storage in native or release builds", () => {
  const code = transpileModule(readFileSync(new URL("../preview/mode.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  for (const [platform, development] of [["android", false], ["android", true], ["ios", false], ["web", false]] as const) {
    let storageCalls = 0;
    const runtime = { exports: {} as any, __DEV__: development, require: () => ({ Platform: { OS: platform } }), window: { sessionStorage: { getItem() { storageCalls++; return "on"; }, setItem() { storageCalls++; }, removeItem() { storageCalls++; } }, location: { assign() { throw new Error("Unexpected navigation"); } } } };
    runInNewContext(code, runtime);
    expect(runtime.exports.CAN_PREVIEW_LIBRARY).toBe(false);
    expect(runtime.exports.PREVIEW_LIBRARY_ENABLED).toBe(false);
    runtime.exports.setPreviewLibrary(true);
    expect(storageCalls).toBe(0);
  }
});
