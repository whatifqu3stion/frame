import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { FollowedSourceIdentity } from "@/repositories/followedSourceRepository";

export type SourceLeaseTokenStore = {
  generate(): Promise<string>;
  get(source: FollowedSourceIdentity): Promise<string | null>;
  set(source: FollowedSourceIdentity, token: string): Promise<void>;
  remove(source: FollowedSourceIdentity): Promise<void>;
};

const keyPrefix = "frame.sourceLease.token.v1";

/** Stores each anonymous lease token in device-only protected storage. */
export const sourceLeaseTokenStore: SourceLeaseTokenStore = {
  async generate(): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, "0")).join("");
  },

  async get(source: FollowedSourceIdentity): Promise<string | null> {
    if (!await SecureStore.isAvailableAsync()) throw new Error("protected storage unavailable");
    return SecureStore.getItemAsync(await tokenStorageKey(source), secureStoreOptions);
  },

  async set(source: FollowedSourceIdentity, token: string): Promise<void> {
    if (!await SecureStore.isAvailableAsync()) throw new Error("protected storage unavailable");
    await SecureStore.setItemAsync(await tokenStorageKey(source), token, secureStoreOptions);
  },

  async remove(source: FollowedSourceIdentity): Promise<void> {
    if (!await SecureStore.isAvailableAsync()) throw new Error("protected storage unavailable");
    await SecureStore.deleteItemAsync(await tokenStorageKey(source), secureStoreOptions);
  },
};

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function tokenStorageKey(source: FollowedSourceIdentity): Promise<string> {
  const identityHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify([source.provider, source.providerSourceId]),
  );
  return `${keyPrefix}.${identityHash}`;
}
