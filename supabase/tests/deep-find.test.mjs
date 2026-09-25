import assert from "node:assert/strict";
import test from "node:test";
import { executeDeepFind, geminiChannelQuery, hasServerPremiumEntitlement } from "../functions/_shared/deep-find.ts";

const identity = "a".repeat(64);
const channelId = `UC${"b".repeat(22)}`;
const source = { provider: "youtube", providerSourceId: channelId, handle: null, displayName: "Verified source", description: "Learning channel", thumbnailUrl: null };

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      async verifyPremium() { calls.push("verify"); return true; },
      async getRemaining() { calls.push("status"); return { remaining: 3, resetAt: "2026-10-01T00:00:00Z", enabled: true }; },
      async reserve() { calls.push("reserve"); return { outcome: "reserved", remaining: 2, resetAt: "2026-10-01T00:00:00Z", reservationId: "reservation" }; },
      async release() { calls.push("release"); },
      async translate() { calls.push("translate"); return "bridge engineering channels"; },
      async searchChannels() { calls.push("search"); return [channelId, channelId, "invalid", `UC${"c".repeat(22)}`]; },
      async verifyChannels() { calls.push("channels"); return [source]; },
      async cacheSources() { calls.push("cache"); },
      ...overrides,
    },
  };
}

test("an inactive entitlement never reaches Gemini or YouTube", async () => {
  const { deps, calls } = dependencies({ async verifyPremium() { calls.push("verify"); return false; } });
  assert.deepEqual(await executeDeepFind({ installationToken: identity, query: "bridge engineers" }, deps), {
    state: "premium_required", message: "Deep Find requires an active Premium entitlement.",
  });
  assert.deepEqual(calls, ["verify"]);
});

test("a paid search reserves once and returns only channels verified against provider details", async () => {
  const { deps, calls } = dependencies();
  const result = await executeDeepFind({ installationToken: identity, query: "bridge engineers" }, deps);
  assert.equal(result.state, "ready");
  assert.deepEqual(result.sources, [source]);
  assert.equal(result.remaining, 2);
  assert.deepEqual(calls, ["verify", "reserve", "translate", "search", "channels", "cache"]);
});

test("Gemini failure releases the monthly slot before any provider search", async () => {
  const { deps, calls } = dependencies({ async translate() { calls.push("translate"); throw new Error("offline"); } });
  const result = await executeDeepFind({ installationToken: identity, query: "bridge engineers" }, deps);
  assert.equal(result.state, "unavailable");
  assert.match(result.message, /No monthly search was used/);
  assert.deepEqual(calls, ["verify", "reserve", "translate", "release"]);
});

test("a status check verifies Premium without reserving or searching", async () => {
  const { deps, calls } = dependencies();
  const result = await executeDeepFind({ installationToken: identity, action: "status" }, deps);
  assert.equal(result.state, "status");
  assert.deepEqual(calls, ["verify", "status"]);
});

test("server verification rejects expired, refunded, or sandbox-only production purchases", () => {
  const purchase = {
    subscriber: {
      entitlements: { premium: { product_identifier: "premium_monthly", purchase_date: "2026-09-01T00:00:00Z", expires_date: "2026-10-01T00:00:00Z" } },
      subscriptions: { premium_monthly: { is_sandbox: true, refunded_at: null } },
    },
  };
  const now = Date.parse("2026-09-25T00:00:00Z");
  assert.equal(hasServerPremiumEntitlement(purchase, now, true), true);
  assert.equal(hasServerPremiumEntitlement(purchase, now, false), false);
  assert.equal(hasServerPremiumEntitlement({ subscriber: { ...purchase.subscriber, subscriptions: { premium_monthly: { is_sandbox: false, refunded_at: null } } } }, now, false), true);
  assert.equal(hasServerPremiumEntitlement(purchase, Date.parse("2026-10-02T00:00:00Z"), true), false);
  assert.equal(hasServerPremiumEntitlement({ subscriber: { ...purchase.subscriber, subscriptions: { premium_monthly: { is_sandbox: false, refunded_at: "2026-09-20T00:00:00Z" } } } }, now, false), false);
});

test("Gemini REST translation reads the final model output step", () => {
  const response = { steps: [
    { type: "thought", summary: [{ type: "text", text: "internal" }] },
    { type: "model_output", content: [{ type: "text", text: '{"query":"bridge engineering channels"}' }] },
  ] };
  assert.equal(geminiChannelQuery(response), "bridge engineering channels");
  assert.throws(() => geminiChannelQuery({ output_text: '{"query":"wrong shape"}' }));
});

test("a lifetime Premium product is verified without accepting a refund or production sandbox purchase", () => {
  const now = Date.parse("2026-09-25T00:00:00Z");
  const lifetime = { subscriber: {
    entitlements: { premium: { product_identifier: "frame_lifetime", purchase_date: "2026-09-20T00:00:00Z", expires_date: null } },
    subscriptions: {}, non_subscriptions: { frame_lifetime: [{ purchase_date: "2026-09-20T00:00:00Z", is_sandbox: false }] },
  } };
  assert.equal(hasServerPremiumEntitlement(lifetime, now, false), true);
  assert.equal(hasServerPremiumEntitlement({ subscriber: { ...lifetime.subscriber, non_subscriptions: { frame_lifetime: [{ purchase_date: "2026-09-20T00:00:00Z", is_sandbox: false, refunded_at: "2026-09-21T00:00:00Z" }] } } }, now, false), false);
  assert.equal(hasServerPremiumEntitlement({ subscriber: { ...lifetime.subscriber, non_subscriptions: { frame_lifetime: [{ purchase_date: "2026-09-20T00:00:00Z", is_sandbox: true }] } } }, now, false), false);
});
