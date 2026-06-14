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

/** Scopes required to read the user's email and their YouTube subscriptions. */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
];
