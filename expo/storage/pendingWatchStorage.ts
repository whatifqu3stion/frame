import AsyncStorage from "@react-native-async-storage/async-storage";
import { pendingWatchId } from "@/domain/pendingWatch";
import { profileStorageKey } from "./profileStorage";
const key = (profile: string) => profileStorageKey("pendingWatch", profile);
export async function keepPendingWatch(profile: string, path: string) {
  const id = pendingWatchId(path);
  if (id) await AsyncStorage.setItem(key(profile), id);
}
export async function readPendingWatch(profile: string): Promise<string | null> {
  const value = await AsyncStorage.getItem(key(profile));
  return value && /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null;
}
export async function takePendingWatch(profile: string): Promise<string | null> {
  const id = await readPendingWatch(profile);
  await AsyncStorage.removeItem(key(profile));
  return id;
}
