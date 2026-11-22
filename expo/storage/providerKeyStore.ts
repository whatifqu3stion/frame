import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createLocalTabKeys } from "./localTabKeys";
import { createProviderKeyStore } from "./providerKeys";

const options: SecureStore.SecureStoreOptions = {
  keychainService: "frame.byok",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const nativeKeyStore = createProviderKeyStore({
  getItemAsync: (key) => SecureStore.getItemAsync(key, options),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
}, () => Platform.OS === "web" ? Promise.resolve(false) : SecureStore.isAvailableAsync());

// The hosted browser preview never receives a key store.
const tabStore = Platform.OS === "web" && typeof window !== "undefined"
  ? createLocalTabKeys(typeof __DEV__ !== "undefined" && __DEV__, window.location.hostname)
  : null;
if (tabStore) window.addEventListener("pagehide", () => { void tabStore.clear(); });

export const localKeyPreview = tabStore !== null;
export const providerKeyStore = tabStore ?? nativeKeyStore;
