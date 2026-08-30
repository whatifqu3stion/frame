import { Platform } from "react-native";
import { DEFAULT_OWNER_PROFILE_ID } from "@/models/profile";
import { FOUNDATION_CAPABILITIES } from "@/constants/productConfig";

export { MAX_ITEMS_PER_SOURCE, ONBOARDING_INTEREST_MAX, PRODUCT_LIMITS, TODAY_MAX_ITEMS, WEEKLY_DISCOVERY_DISPLAY_MAX } from "@/constants/productConfig";

export type AppEnvironment = "development" | "staging" | "production";

function resolveAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === "development" || value === "staging" || value === "production") return value;
  return typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production";
}

function valueForEnvironment(values: {
  development?: string;
  staging?: string;
  production?: string;
}): string | undefined {
  return values[APP_ENV] || undefined;
}

/** Explicit runtime environment. Unset development builds stay isolated; release builds require production configuration. */
export const APP_ENV: AppEnvironment = resolveAppEnvironment(process.env.EXPO_PUBLIC_APP_ENV);

/** Non-production builds are explicitly treated as closed-beta surfaces. */
export const IS_CLOSED_BETA = APP_ENV !== "production";
export const RELEASE_CHANNEL_LABEL = IS_CLOSED_BETA ? "Closed beta" : "Public release";

/**
 * Environment-scoped backend configuration. The legacy Rork functions URL is accepted
 * only for development so a release cannot silently use the routine development backend.
 */
export const BACKEND_BASE_URL = valueForEnvironment({
  development: process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL_DEVELOPMENT ?? process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL,
  staging: process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL_STAGING,
  production: process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL_PRODUCTION,
})?.replace(/\/$/, "") ?? "";

/** Environment-scoped Google OAuth client configuration. OAuth client IDs are public. */
export const GOOGLE_CONFIG = {
  iosClientId: valueForEnvironment({
    development: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS_DEVELOPMENT ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    staging: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS_STAGING,
    production: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS_PRODUCTION,
  }),
  androidClientId: valueForEnvironment({
    development: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID_DEVELOPMENT ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    staging: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID_STAGING,
    production: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID_PRODUCTION,
  }),
  webClientId: valueForEnvironment({
    development: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB_DEVELOPMENT ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    staging: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB_STAGING,
    production: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB_PRODUCTION,
  }),
} as const;

/** Stable Owner identity used until profile switching is deliberately introduced. */
export const ACTIVE_PROFILE_ID = DEFAULT_OWNER_PROFILE_ID;

export const FEATURE_FLAGS = {
  ...FOUNDATION_CAPABILITIES,
  knownYouTubeUrlResolution: Boolean(BACKEND_BASE_URL),
  googleConnection: Boolean(GOOGLE_CONFIG.iosClientId || GOOGLE_CONFIG.androidClientId || GOOGLE_CONFIG.webClientId),
} as const;

export function isGoogleConfigured(): boolean {
  return FEATURE_FLAGS.googleConnection;
}

/** Returns whether the current platform has the OAuth client ID it requires. */
export function isGooglePlatformConfigured(): boolean {
  if (Platform.OS === "ios") return Boolean(GOOGLE_CONFIG.iosClientId);
  if (Platform.OS === "android") return Boolean(GOOGLE_CONFIG.androidClientId);
  return Boolean(GOOGLE_CONFIG.webClientId);
}

/** Minimal scopes used while selective YouTube subscription import is unavailable. */
export const GOOGLE_SCOPES = ["openid", "email", "profile"];
