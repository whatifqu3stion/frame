import { expect, test } from "bun:test";
import { continuingRowOffset, createPresentationGate } from "./motionContinuity";

test("the personalized first reveal waits for a visible route and is consumed once", () => {
  const gate = createPresentationGate("selection", true, true);
  expect(gate.update("selection", false)).toBeFalse();
  expect(gate.update("selection", true)).toBeTrue();
  expect(gate.update("selection", true)).toBeFalse();
  expect(gate.update("selection", false)).toBeFalse();
  expect(gate.update("selection", true)).toBeFalse();
});
test("hidden async completions settle without replaying when navigating Back", () => {
  const gate = createPresentationGate("idle", false);
  expect(gate.update("idle", true)).toBeFalse();
  expect(gate.update("saved", false)).toBeFalse();
  expect(gate.update("saved", true)).toBeFalse();
  expect(gate.update("next-save", true)).toBeTrue();
});
test("repeated completion and preference changes do not manufacture new feedback", () => {
  const gate = createPresentationGate(false, false);
  expect(gate.update(true, true)).toBeTrue();
  expect(gate.update(true, true)).toBeFalse();
  expect(gate.update(true, false)).toBeFalse();
  expect(gate.update(true, true)).toBeFalse();
});
test("a rapid reorder preserves the current visual position before settling", () => {
  // Row moved from y=100 to y=200 and is halfway through that movement.
  const previousY = 200, currentOffset = -50, nextY = 0;
  const offset = continuingRowOffset(previousY, nextY, currentOffset);
  expect(nextY + offset).toBe(previousY + currentOffset);
  // Reverse it again before the previous animation finishes.
  expect(continuingRowOffset(nextY, 100, offset)).toBe(50);
});
test("invalid row measurements safely settle without an invalid native transform", () => {
  expect(continuingRowOffset(NaN, 10, 0)).toBe(0);
  expect(continuingRowOffset(100, 0, Infinity)).toBe(0);
});

test("a completion notice mounted out of view never celebrates on return", () => {
  const gate = createPresentationGate("saved", true);
  expect(gate.update("saved", false)).toBeFalse();
  expect(gate.update("saved", true)).toBeFalse();
});
