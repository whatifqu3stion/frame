import { Image } from "expo-image";
import { Platform } from "react-native";

let cleanup: Promise<void> | null = null;

/** Clear legacy native thumbnail caches. New thumbnails use cachePolicy="none". */
export async function clearLegacyThumbnailCaches(): Promise<void> {
  if (Platform.OS === "web") return;
  if (cleanup) return cleanup;
  cleanup = (async () => {
    const disk = await Image.clearDiskCache();
    const memory = await Image.clearMemoryCache();
    if (!disk || !memory) throw new Error("Thumbnail cleanup is pending; retry while Frame is active.");
  })().finally(() => { cleanup = null; });
  return cleanup;
}
