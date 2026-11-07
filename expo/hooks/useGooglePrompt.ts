import { useCallback } from "react";
import { exchangeCodeAsync, makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { GOOGLE_CONFIG, GOOGLE_SCOPES, isGooglePlatformConfigured } from "@/constants/config";
import { GOOGLE_NATIVE_CALLBACK } from "@/constants/googleCallback";
import { completeGooglePrompt } from "@/services/googlePrompt";

function useConfiguredPrompt() {
  const [request, , prompt] = Google.useAuthRequest({
    ...GOOGLE_CONFIG,
    scopes: GOOGLE_SCOPES,
    redirectUri: makeRedirectUri({ native: GOOGLE_NATIVE_CALLBACK }),
    // The caller awaits prompt(), so exchange its raw native code exactly once.
    shouldAutoExchangeCode: false,
  });
  const run = useCallback(async () => {
    if (!request) throw new Error("Google auth request is not ready");
    return completeGooglePrompt(await prompt(), request, (config) => exchangeCodeAsync(config, Google.discovery));
  }, [prompt, request]);
  return request ? run : null;
}

// Platform and bundled client IDs are fixed for the session. Choose the hook once:
// the SDK throws on mount if the platform has no usable client ID.
export const useGooglePrompt = isGooglePlatformConfigured() ? useConfiguredPrompt : () => null;
