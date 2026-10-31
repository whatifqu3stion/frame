import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import type { FramePalette } from "./theme";

// Evaluate the real palette without loading native platform bindings in Bun.
const context = { exports: {} as { watchPalette: typeof import("./theme").watchPalette; createPalette: (dark: boolean, accent: "blue" | "green" | "rose") => FramePalette }, require: () => ({ Platform: { select: () => "monospace" } }) };
runInNewContext(transpileModule(readFileSync(new URL("./theme.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, context);
function rgb(color: string): number[] {
  return color.startsWith("#") ? color.slice(1).match(/../g)!.map((value) => parseInt(value, 16)) : color.match(/[\d.]+/g)!.map(Number);
}
function luminance(color: number[]): number {
  return color.slice(0, 3).map((value) => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(foreground: number[], background: number[]): number {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
describe("readable text across Frame appearances", () => {
  for (const dark of [false, true]) for (const accent of ["blue", "green", "rose"] as const) {
    test(`${dark ? "dark" : "light"} ${accent} has at least 4.5:1 contrast for text roles`, () => {
      const p = context.exports.createPalette(dark, accent);
      for (const background of [p.wall, p.surface, p.surfaceHigh, p.surfaceDeep, p.surfaceBright, p.mount]) {
        expect(contrast(rgb(p.inkMuted), rgb(background))).toBeGreaterThanOrEqual(4.5);
        const tint = rgb(p.activeSoft);
        const selectedBackground = rgb(background).map((v, i) => v * (1 - tint[3]) + tint[i] * tint[3]);
        expect(contrast(rgb(p.active), selectedBackground)).toBeGreaterThanOrEqual(4.5);
      }
      // Brightest possible grain pixel: white at the asset's capped alpha.
      const grainAlpha = (32 / 255) * p.programmeGrainOpacity;
      const brightestProgramme = rgb(p.programme).map((value) => value * (1 - grainAlpha) + 255 * grainAlpha);
      for (const foreground of [p.onProgramme, p.onProgrammeSoft]) {
        expect(contrast(rgb(foreground), brightestProgramme)).toBeGreaterThanOrEqual(4.5);
      }
      for (const [foreground, background] of [[p.onDark, p.accentDeep], [p.onAccent, p.accent], [p.onDanger, p.danger], [p.onProgramme, p.programme], [p.onProgrammeSoft, p.programme], [p.programme, p.onProgramme]]) {
        expect(contrast(rgb(foreground), rgb(background))).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

// The viewing room deliberately stays dark across all six appearances.
test("viewing-room text remains readable on each dark surface", () => {
  const p = context.exports.watchPalette;
  for (const background of [p.wall, p.stage, p.surface, p.surfaceHigh]) {
    for (const foreground of [p.ink, p.inkSoft, p.inkMuted, p.accent]) {
      const color = rgb(foreground), bg = rgb(background);
      const opaque = color.length === 4 ? bg.map((v, i) => v * (1 - color[3]) + color[i] * color[3]) : color;
      expect(contrast(opaque, bg)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("room lighting keeps text readable throughout entry and return in both themes", () => {
  const p = context.exports.watchPalette;
  for (const start of [p.litWall, p.darkLitWall]) {
    for (let step = 0; step <= 20; step++) {
      const amount = step / 20;
      const bg = rgb(start).map((v, i) => v * (1 - amount) + rgb(p.wall)[i] * amount);
      for (const foreground of [p.ink, p.inkSoft, p.inkMuted, p.accent]) {
        const color = rgb(foreground);
        const opaque = color.length === 4 ? bg.map((v, i) => v * (1 - color[3]) + color[i] * color[3]) : color;
        expect(contrast(opaque, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
