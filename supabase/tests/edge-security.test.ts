import { describe, expect, test } from "bun:test";
import {
  getAllowedPublishableKeys,
  getSupabaseSecretKey,
  hasValidPublishableKey,
  readBoundedJsonBody,
  type EnvironmentReader,
} from "../functions/_shared/edge-security";

function environment(values: Record<string, string | undefined>): EnvironmentReader {
  return (name: string) => values[name];
}

describe("Edge Function authentication", () => {
  test("accepts current key maps and legacy fallbacks", () => {
    const readEnvironment = environment({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: "sb_publishable_current" }),
      SUPABASE_ANON_KEY: "legacy-anon",
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_current" }),
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service",
    });

    expect(getAllowedPublishableKeys(readEnvironment)).toEqual(["sb_publishable_current", "legacy-anon"]);
    expect(getSupabaseSecretKey(readEnvironment)).toBe("sb_secret_current");
    expect(hasValidPublishableKey(
      new Request("https://example.com", { headers: { apikey: "sb_publishable_current" } }),
      readEnvironment,
    )).toBe(true);
  });

  test("rejects missing, unknown, and malformed configured keys", () => {
    const readEnvironment = environment({ SUPABASE_PUBLISHABLE_KEYS: "not-json" });
    expect(hasValidPublishableKey(new Request("https://example.com"), readEnvironment)).toBe(false);
    expect(hasValidPublishableKey(
      new Request("https://example.com", { headers: { apikey: "unknown" } }),
      readEnvironment,
    )).toBe(false);
  });
});

describe("bounded request bodies", () => {
  test("parses valid JSON within the actual byte limit", async () => {
    const result = await readBoundedJsonBody(
      new Request("https://example.com", { method: "POST", body: JSON.stringify({ interestIds: ["science"] }) }),
      128,
    );
    expect(result).toEqual({ ok: true, value: { interestIds: ["science"] } });
  });

  test("rejects oversized chunked bodies without trusting Content-Length", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"value":"'));
        controller.enqueue(encoder.encode("x".repeat(64)));
        controller.enqueue(encoder.encode('"}'));
        controller.close();
      },
    });
    const result = await readBoundedJsonBody(new Request("https://example.com", { method: "POST", body }), 32);
    expect(result).toEqual({ ok: false, status: 413, message: "Request body is too large." });
  });

  test("rejects malformed JSON", async () => {
    const result = await readBoundedJsonBody(new Request("https://example.com", { method: "POST", body: "{" }), 32);
    expect(result).toEqual({ ok: false, status: 400, message: "A valid JSON body is required." });
  });
});
