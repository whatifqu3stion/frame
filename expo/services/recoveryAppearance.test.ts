import { expect, test } from "bun:test";
import { recoveryAppearance, rememberRecoveryAppearance } from "./recoveryAppearance";

test("fallback starts with system appearance then retains the last committed app appearance", () => {
  expect(recoveryAppearance(true)).toEqual({ theme: "ink", accent: "blue" });
  rememberRecoveryAppearance("ink", "rose");
  const returned = recoveryAppearance(false);
  expect(returned).toEqual({ theme: "ink", accent: "rose" });
  returned.theme = "warm";
  expect(recoveryAppearance(false).theme).toBe("ink");
  rememberRecoveryAppearance("warm", "green");
  expect(recoveryAppearance(true)).toEqual({ theme: "warm", accent: "green" });
});
