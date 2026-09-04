import { describe, expect, test } from "bun:test";
import { performFullReset } from "./fullReset";

describe("full-reset recovery", () => {
  test("erases protected, database, and key-value state before restoring clean Owner selection", async () => {
    const calls: string[] = [];
    await performFullReset({
      stopPlayback: async () => { calls.push("stop"); },
      flushPendingWrites: async () => { calls.push("flush"); },
      clearProtectedCredentials: async () => { calls.push("protected"); },
      resetDatabase: async () => { calls.push("database"); },
      clearKeyValueStorage: async () => { calls.push("key-value"); },
      restoreOwnerSelection: async () => { calls.push("owner"); },
    });
    expect(calls).toEqual(["stop", "flush", "protected", "database", "key-value", "owner"]);
  });

  test("never reports recovery complete after an incomplete destructive step", async () => {
    const calls: string[] = [];
    await expect(performFullReset({
      stopPlayback: async () => { calls.push("stop"); },
      flushPendingWrites: async () => { calls.push("flush"); },
      clearProtectedCredentials: async () => { throw new Error("protected storage unavailable"); },
      resetDatabase: async () => { calls.push("database"); },
      clearKeyValueStorage: async () => { calls.push("key-value"); },
      restoreOwnerSelection: async () => { calls.push("owner"); },
    })).rejects.toThrow("protected storage unavailable");
    expect(calls).toEqual(["stop", "flush"]);
  });
});
