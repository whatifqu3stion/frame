import { APP_ENV } from "@/constants/config";
import { createSourceFeedClient } from "@/services/sourceFeedClient";

export const sourceFeedClient = createSourceFeedClient({
  supabaseUrl: APP_ENV === "development" ? process.env.EXPO_PUBLIC_SUPABASE_URL : undefined,
  publishableKey: APP_ENV === "development" ? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY : undefined,
});
