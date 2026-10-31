import { expect, test } from "bun:test";
import { providerKeyState, unavailableKeyStorageMessage } from "./providerKeyStatus";

test("pending and failed key reads cannot be mistaken for missing or usable credentials", () => {
  expect(providerKeyState({ isPending: true, isError: false })).toBe("checking");
  expect(providerKeyState({ isPending: false, isError: true, data: { available: true, youtube: true, gemini: false } })).toBe("error");
  expect(providerKeyState({ isPending: false, isError: false })).toBe("error");
  expect(providerKeyState({ isPending: false, isError: false, data: { available: false, youtube: false, gemini: false } })).toBe("unavailable");
  for (const youtube of [true, false]) {
    expect(providerKeyState({ isPending: false, isError: false, data: { available: true, youtube, gemini: false } })).toBe("ready");
  }
});

test("storage recovery distinguishes a phone failure from an unsupported browser", () => {
  expect(unavailableKeyStorageMessage(false)).toContain("Unlock your device");
  expect(unavailableKeyStorageMessage(false)).not.toContain("browser");
  expect(unavailableKeyStorageMessage(true)).toContain("browser preview");
});
