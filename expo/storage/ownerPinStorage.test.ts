import { describe, expect, test } from "bun:test";
import {
  createOwnerPinVerifier,
  validateOwnerPin,
  type PinCrypto,
  type ProtectedPinStorage,
} from "../domain/ownerPinVerifier";

const STORAGE_KEY = "owner-pin-test";

class MemoryProtectedStorage implements ProtectedPinStorage {
  readonly values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async removeItem(key: string): Promise<void> { this.values.delete(key); }
}

const testCrypto: PinCrypto = {
  randomBytes: async (length: number): Promise<Uint8Array> => Uint8Array.from({ length }, (_, index) => (index * 17) % 255),
  digest: async (value: string): Promise<string> => {
    let hash = 2166136261;
    for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return Math.abs(hash >>> 0).toString(16).padStart(64, "0");
  },
};

describe("Owner PIN protected storage", () => {
  test("accepts only four to six numeric digits", () => {
    expect(validateOwnerPin("1234")).toBeTrue();
    expect(validateOwnerPin("123456")).toBeTrue();
    expect(validateOwnerPin("123")).toBeFalse();
    expect(validateOwnerPin("1234567")).toBeFalse();
    expect(validateOwnerPin("12a4")).toBeFalse();
  });

  test("stores a salted verifier without plaintext and verifies the PIN", async () => {
    const storage = new MemoryProtectedStorage();
    const verifier = createOwnerPinVerifier(storage, testCrypto, STORAGE_KEY);
    await verifier.set("4826");
    const raw = storage.values.get(STORAGE_KEY) ?? "";
    const record = await verifier.read();
    expect(raw).not.toContain("4826");
    expect(record?.salt.length).toBe(64);
    expect(record?.verifier.length).toBe(64);
    expect(await verifier.verify("4826")).toBeTrue();
    expect(await verifier.verify("4827")).toBeFalse();
  });

  test("changes and removes the verifier without leaving the prior PIN valid", async () => {
    const storage = new MemoryProtectedStorage();
    const verifier = createOwnerPinVerifier(storage, testCrypto, STORAGE_KEY);
    await verifier.set("1111");
    await verifier.set("2222");
    expect(await verifier.verify("1111")).toBeFalse();
    expect(await verifier.verify("2222")).toBeTrue();
    await verifier.remove();
    expect(await verifier.read()).toBeNull();
  });
});
