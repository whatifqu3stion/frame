import { expect, test } from "bun:test";
import { compactViewingHistory, viewingChartLayout, viewingChartOffset } from "./viewingChartLayout";

test("only constrained phone layouts default to compact history", () => {
  expect(compactViewingHistory(320, 740, 1)).toBe(true);
  expect(compactViewingHistory(390, 690, 1)).toBe(true);
  expect(compactViewingHistory(390, 844, 2)).toBe(true);
  expect(compactViewingHistory(390, 844, 1)).toBe(false);
  expect(compactViewingHistory(1280, 720, 1)).toBe(false);
});

test("ordinary phone widths show all seven full-sized days when they fit", () => {
  for (const width of [350, 371, 680]) {
    const layout = viewingChartLayout(width, 1);
    expect(layout.visibleDays).toBe(7);
    expect(layout.overflow).toBe(false);
    expect(layout.dayWidth).toBeGreaterThanOrEqual(48);
    expect(layout.plotWidth).toBeCloseTo(width);
  }
});

test("narrow and large-text charts display only whole days with accessible targets", () => {
  for (const width of [240, 280, 320, 350, 680]) {
    for (const scale of [1, 1.3, 2]) {
      const layout = viewingChartLayout(width, scale);
      expect(layout.dayWidth).toBeGreaterThanOrEqual(Math.max(48, 32 * scale));
      expect(layout.dayWidth * layout.visibleDays).toBeCloseTo(width);
      for (let index = 0; index < 7; index++) {
        const offset = viewingChartOffset(index, layout.visibleDays, layout.dayWidth);
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset + width).toBeLessThanOrEqual(layout.plotWidth + 0.001);
        expect(offset / layout.dayWidth).toBeCloseTo(Math.round(offset / layout.dayWidth));
        expect(index * layout.dayWidth).toBeGreaterThanOrEqual(offset - 0.001);
        expect((index + 1) * layout.dayWidth).toBeLessThanOrEqual(offset + width + 0.001);
      }
    }
  }
});

test("first and latest dates remain reachable in an overflowing chart", () => {
  const layout = viewingChartLayout(280, 1);
  expect(layout.visibleDays).toBe(5);
  expect(layout.overflow).toBe(true);
  expect(viewingChartOffset(0, layout.visibleDays, layout.dayWidth)).toBe(0);
  expect(viewingChartOffset(6, layout.visibleDays, layout.dayWidth)).toBe(layout.plotWidth - 280);
  expect(viewingChartLayout(0, 1).plotWidth).toBe(336);
});
