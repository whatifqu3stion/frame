import { describe, expect, test } from "bun:test";
import type { AuthSessionResult, TokenResponse } from "expo-auth-session";
import { completeGooglePrompt } from "./googlePrompt";
import { GOOGLE_NATIVE_CALLBACK } from "../constants/googleCallback";
import appConfig from "../app.json";
import { redirectSystemPath } from "../app/+native-intent";

const request = { clientId: "android-id", redirectUri: GOOGLE_NATIVE_CALLBACK, codeVerifier: "test-verifier" };
const token = { accessToken: "test-token", expiresIn: 3600 } as TokenResponse;
const success: AuthSessionResult = { type: "success", params: { code: "one-time-code" }, url: GOOGLE_NATIVE_CALLBACK, authentication: null, errorCode: null };

describe("Google callback", () => {
  test("the native callback scheme is registered, and codes are not passed to navigation", () => {
    const scheme = new URL(GOOGLE_NATIVE_CALLBACK).protocol.slice(0, -1);
    expect(appConfig.expo.android.scheme).toBe(scheme);
    expect(appConfig.expo.ios.bundleIdentifier).toBe(scheme);
    expect(redirectSystemPath({ path: GOOGLE_NATIVE_CALLBACK + "?code=test&state=example", initial: false })).toBe("/");
  });
  test("exchanges the native code with the original client, redirect and verifier", async () => {
    const result = await completeGooglePrompt(success, request, async (config) => {
      expect(config).toEqual({ clientId: "android-id", redirectUri: GOOGLE_NATIVE_CALLBACK, code: "one-time-code", extraParams: { code_verifier: "test-verifier" } });
      return token;
    });
    expect(result).toEqual({ ...success, authentication: token });
  });
  test("web tokens and cancellations bypass the exchange", async () => {
    const unexpected = async () => { throw new Error("unexpected code exchange"); };
    for (const result of [{ ...success, authentication: token }, { type: "cancel" }] as AuthSessionResult[]) {
      expect(await completeGooglePrompt(result, request, unexpected)).toBe(result);
    }
  });
  test("rejects an incomplete PKCE request before sending the code", async () => {
    await expect(completeGooglePrompt(success, { ...request, codeVerifier: undefined }, async () => token)).rejects.toThrow("verifier");
  });
});
