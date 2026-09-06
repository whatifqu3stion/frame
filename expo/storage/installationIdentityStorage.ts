import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createInstallationIdentityStore, type InstallationStringStore } from "@/domain/installationIdentity";

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const nativeStorage: InstallationStringStore = {
  async getItem(key: string): Promise<string | null> {
    if (!await SecureStore.isAvailableAsync()) throw new Error("protected storage unavailable");
    return SecureStore.getItemAsync(key, secureStoreOptions);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!await SecureStore.isAvailableAsync()) throw new Error("protected storage unavailable");
    await SecureStore.setItemAsync(key, value, secureStoreOptions);
  },
  async removeItem(key: string): Promise<void> {
    if (!await SecureStore.isAvailableAsync()) throw new Error("protected storage unavailable");
    await SecureStore.deleteItemAsync(key, secureStoreOptions);
  },
};

const webStorage: InstallationStringStore = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

/** Device-wide source-resolution usage identity, protected natively and local-only on web. */
export const installationIdentityStore = createInstallationIdentityStore({
  storage: Platform.OS === "web" ? webStorage : nativeStorage,
  randomBytes: (length: number) => Crypto.getRandomBytesAsync(length),
});
