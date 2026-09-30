import { expect, test } from "bun:test";
import { createActionGate } from "./actionGate";

test("a repeated tap cannot begin a second action", () => {
  const gate = createActionGate();
  expect(gate.begin()).toBeNull();
  gate.reset(true);
  const ticket = gate.begin()!;
  expect(gate.begin()).toBeNull();
  expect(ticket.isCurrent()).toBe(true);
  ticket.finish();
  expect(ticket.isCurrent()).toBe(false);
  expect(gate.begin()).not.toBeNull();
});

test("leaving and returning cannot revive an old completion or release a new action", () => {
  const gate = createActionGate();
  gate.reset(true);
  const old = gate.begin()!;
  gate.reset(false);
  expect(old.isCurrent()).toBe(false);
  expect(gate.begin()).toBeNull();
  gate.reset(true);
  const current = gate.begin()!;
  old.finish();
  expect(current.isCurrent()).toBe(true);
  expect(gate.begin()).toBeNull();
  current.finish();
  expect(gate.begin()).not.toBeNull();
});


test("a confirmation from a previous screen cannot start a destructive action", () => {
  const gate = createActionGate();
  gate.reset(true);
  const confirm = gate.capture();
  expect(confirm()).toBe(true);
  gate.reset(false);
  gate.reset(true);
  expect(confirm()).toBe(false);
  expect(gate.capture()()).toBe(true);
});
