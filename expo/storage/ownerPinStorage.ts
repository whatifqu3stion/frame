import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  createOwnerPinVerifier,
  validateOwnerPin,
  type OwnerPinRecord,
  type ProtectedPinStorage,
} from "@/domain/ownerPinVerifier";

const OWNER_PIN_KEY = "frame.ownerPin.verifier.v1";

export type OwnerPinAvailability = "available" | "web" | "unavailable";
export { validateOwnerPin, type OwnerPinRecord, type ProtectedPinStorage };

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const nativePinStorage: ProtectedPinStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key, secureStoreOptions),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, secureStoreOptions),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key, secureStoreOptions),
};

const pinCrypto = {
  randomBytes: (length: number): Promise<Uint8Array> => Crypto.getRandomBytesAsync(length),
  digest: (value: string): Promise<string> => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
};

export async function getOwnerPinAvailability(): Promise<OwnerPinAvailability> {
  if (Platform.OS === "web") return "web";
  return await SecureStore.isAvailableAsync() ? "available" : "unavailable";
}

function service(storage: ProtectedPinStorage) {
  return createOwnerPinVerifier(storage, pinCrypto, OWNER_PIN_KEY);
}

export async function readOwnerPinRecord(storage: ProtectedPinStorage = nativePinStorage): Promise<OwnerPinRecord | null> {
  return service(storage).read();
}

/** Stores only a random salt and one-way verifier in device-protected storage. */
export async function setOwnerPin(pin: string, storage: ProtectedPinStorage = nativePinStorage): Promise<void> {
  return service(storage).set(pin);
}

export async function verifyOwnerPin(pin: string, storage: ProtectedPinStorage = nativePinStorage): Promise<boolean> {
  return service(storage).verify(pin);
}

export async function removeOwnerPin(storage: ProtectedPinStorage = nativePinStorage): Promise<void> {
  return service(storage).remove();
}

export const ownerPinStorageKeyForTests = OWNER_PIN_KEY;
