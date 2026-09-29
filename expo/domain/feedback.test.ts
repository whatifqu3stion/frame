import { describe, expect, test } from "bun:test";
import { createFeedbackGate, type FeedbackKind } from "./feedback";

function setup() {
  const state = { enabled: true, active: true, native: true };
  let time = 1_000;
  const played: FeedbackKind[] = [];
  const gate = createFeedbackGate(() => state, (kind) => played.push(kind), () => time);
  return { state, played, gate, advance: (ms: number) => { time += ms; } };
}
describe("context-bound touch feedback", () => {
  test("a persisted action can confirm once, using its semantic strength", () => {
    const { gate, played } = setup();
    const saved = gate.capture(); saved("commit"); saved("milestone");
    expect(played).toEqual(["commit"]);
  });
  test("unchanged results stay silent and cannot be replayed as successes", () => {
    const { gate, played } = setup();
    const complete = gate.capture(); complete("selection", false); complete("selection", true);
    expect(played).toEqual([]);
  });
  for (const key of ["enabled", "active", "native"] as const) test(`disabled ${key} suppresses feedback at completion`, () => {
    const { gate, played, state } = setup();
    const complete = gate.capture(); state[key] = false; complete("commit");
    expect(played).toEqual([]);
  });
  test("navigation, profile changes or backgrounding invalidate pending work", () => {
    const { gate, played } = setup();
    const oldProfileSave = gate.capture(); gate.invalidate(); oldProfileSave("milestone");
    gate.capture()("selection");
    expect(played).toEqual(["selection"]);
  });
  test("rapid controls share a burst limit without suppressing the next deliberate action", () => {
    const { gate, played, advance } = setup();
    gate.capture()("selection"); advance(40); gate.capture()("commit");
    advance(60); gate.capture()("commit");
    expect(played).toEqual(["selection", "commit"]);
  });
  test("a long-delayed completion never causes a surprise pulse", () => {
    const { gate, played, advance } = setup();
    const complete = gate.capture(); advance(10_001); complete("commit");
    expect(played).toEqual([]);
  });
  test("an unavailable actuator cannot fail a product action", () => {
    const gate = createFeedbackGate(() => ({ enabled: true, active: true, native: true }), () => { throw new Error("Unavailable"); });
    expect(() => gate.capture()("reject")).not.toThrow();
  });
});
