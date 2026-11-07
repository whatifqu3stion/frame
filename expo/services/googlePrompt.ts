import type { AccessTokenRequestConfig, AuthRequest, AuthSessionResult, TokenResponse } from "expo-auth-session";

/** Web already has a token; a native success contains a code bound to the original PKCE request. */
export async function completeGooglePrompt(
  result: AuthSessionResult,
  request: Pick<AuthRequest, "clientId" | "redirectUri" | "codeVerifier">,
  exchange: (config: AccessTokenRequestConfig) => Promise<TokenResponse>,
): Promise<AuthSessionResult> {
  if (result.type !== "success" || result.authentication || !result.params.code) return result;
  if (!request.codeVerifier) throw new Error("Google auth request has no code verifier");
  const authentication = await exchange({
    code: result.params.code,
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    extraParams: { code_verifier: request.codeVerifier },
  });
  return { ...result, authentication };
}
