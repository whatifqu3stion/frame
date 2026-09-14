import { Image } from "expo-image";
import { Platform } from "react-native";
import { createThumbnailCleanup } from "./thumbnailCleanup";

const cleanup = createThumbnailCleanup({
  isWeb: Platform.OS === "web",
  clearDisk: () => Image.clearDiskCache(),
  clearMemory: () => Image.clearMemoryCache(),
  now: Date.now,
});

/** Clear legacy native thumbnail caches. New thumbnails use cachePolicy="none". */
export const clearLegacyThumbnailCaches = cleanup.run;

/** Read the latest native API result, without performing cleanup or network requests. */
export const getThumbnailCleanupStatus = cleanup.getStatus;
