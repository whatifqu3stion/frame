import { Platform } from "react-native";

/**
 * Google OAuth client configuration, read from public env vars.
 * Until these are provided, Google sign-in shows a "needs setup" state and the
 * rest of Frame (manual channel-adding, curated lists, the search taste) works.
 */
export const GOOGLE_CONFIG = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || undefined,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || undefined,
} as const;

export function isGoogleConfigured(): boolean {
  return Boolean(
    GOOGLE_CONFIG.iosClientId || GOOGLE_CONFIG.androidClientId || GOOGLE_CONFIG.webClientId,
  );
}

/**
 * Whether the CURRENT platform has the client ID it needs for Google auth.
 * `expo-auth-session` throws if the active platform's client ID is missing, so we
 * use this to keep the auth request dormant (rather than crashing) on platforms
 * whose key hasn't been provided yet. The result is constant for the session.
 */
export function isGooglePlatformConfigured(): boolean {
  if (Platform.OS === "ios") return Boolean(GOOGLE_CONFIG.iosClientId);
  if (Platform.OS === "android") return Boolean(GOOGLE_CONFIG.androidClientId);
  return Boolean(GOOGLE_CONFIG.webClientId);
}

/** Scopes required to read the user's email and their YouTube subscriptions. */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
];
