import { describe, expect, test } from "bun:test";
import { artworkTransform, chartDayAt, validArtworkRect } from "./artworkGeometry";

describe("artwork navigation geometry", () => {
  test("preserves the source centre and aspect ratio across different screen offsets", () => {
    const from = { x: 20, y: 350, width: 142, height: 79.875 };
    const to = { x: 0, y: 90, width: 390, height: 219.375 };
    const result = artworkTransform(from, to);
    expect(to.x + to.width / 2 + result.x).toBe(from.x + from.width / 2);
    expect(to.y + to.height / 2 + result.y).toBe(from.y + from.height / 2);
    expect(to.height * result.scale).toBeCloseTo(from.height);
  });
  test("rejects unmeasured and nonfinite artwork", () => {
    expect(validArtworkRect({ x: 0, y: 0, width: 0, height: 80 })).toBe(false);
    expect(validArtworkRect({ x: NaN, y: 0, width: 100, height: 80 })).toBe(false);
  });
});
describe("chart scrubbing", () => {
  test("clamps pointer excursions and respects scrolled plot coordinates", () => {
    expect(chartDayAt(-12, 308, 7)).toBe(0);
    expect(chartDayAt(500, 308, 7)).toBe(6);
    expect(chartDayAt(80 + 44, 308, 7)).toBe(2);
    expect(chartDayAt(44, 308, 7)).toBe(1);
    expect(chartDayAt(10, 0, 7)).toBe(-1);
    expect(chartDayAt(NaN, 308, 7)).toBe(-1);
  });
});
