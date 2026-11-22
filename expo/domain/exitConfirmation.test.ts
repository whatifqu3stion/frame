import { expect, test } from "bun:test";
import { createExitConfirmation } from "./exitConfirmation";

test("keep editing and repeated Back preserve work; discard proceeds once", () => {
  const gate = createExitConfirmation();
  let decide = (_discard: boolean) => {};
  let prompts = 0;
  let exits = 0;
  const present = (callback: typeof decide) => { prompts += 1; decide = callback; };
  gate.request(present, () => exits++);
  gate.request(present, () => exits++);
  expect(prompts).toBe(1);
  decide(false);
  expect(exits).toBe(0);
  gate.request(present, () => exits++);
  decide(true);
  decide(true);
  expect(exits).toBe(1);
});

test("an expired alert cannot navigate after authorization loss, save, or profile replacement", () => {
  const gate = createExitConfirmation();
  let oldDecision = (_discard: boolean) => {};
  let newDecision = (_discard: boolean) => {};
  let exits = 0;
  gate.request((callback) => { oldDecision = callback; }, () => exits++);
  gate.invalidate();
  gate.request((callback) => { newDecision = callback; }, () => exits++);
  oldDecision(true);
  expect(exits).toBe(0);
  newDecision(true);
  expect(exits).toBe(1);
});
