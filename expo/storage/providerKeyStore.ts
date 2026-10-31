import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createProviderKeyStore } from "./providerKeys";

const options: SecureStore.SecureStoreOptions = {
  keychainService: "frame.byok",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// No AsyncStorage, browser storage, or plaintext fallback, including after storage errors.
export const providerKeyStore = createProviderKeyStore({
  getItemAsync: (key) => SecureStore.getItemAsync(key, options),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
}, () => Platform.OS === "web" ? Promise.resolve(false) : SecureStore.isAvailableAsync());
