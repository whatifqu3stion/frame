import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";

const source = (path: string): Promise<string> => readFile(new URL(path, import.meta.url).pathname, "utf8");

describe("free beta boundaries", () => {
  test("keeps billing and unfinished entry points disabled", () => {
    expect(FOUNDATION_CAPABILITIES.paidAccess).toBeFalse();
    expect(FOUNDATION_CAPABILITIES.googleSelectiveImport).toBeTrue();
    expect(FOUNDATION_CAPABILITIES.weeklyDiscovery).toBeFalse();
  });

  test("free access is independent of purchase status and does not pretend to be an entitlement", async () => {
    const provider = await source("../providers/AppProvider.tsx");
    expect(provider).toContain('if (!FEATURE_FLAGS.paidAccess || premiumAccessState === "active") return true;');
    expect(provider).toContain('canUseLibrary: !FEATURE_FLAGS.paidAccess || premiumAccessState === "active"');
    expect(provider).toContain('const isPremium = hasPremiumEntitlement(customerInfoQuery.data)');
    const watch = await source("../app/watch/[id].tsx");
    expect(watch).not.toContain("isPremium");
    expect(watch).toContain("canUseLibrary");
  });

  test("billing cannot initialize, mount, purchase or restore in the free beta", async () => {
    const billing = await source("./revenueCat.ts");
    expect(billing).toContain("if (FEATURE_FLAGS.paidAccess && revenueCatApiKey)");
    expect(billing).toContain('if (!FEATURE_FLAGS.paidAccess || Platform.OS === "web" || !isRevenueCatConfigured)');
    expect(await source("../app/_layout.tsx")).toContain("{FEATURE_FLAGS.paidAccess ? <PaywallSheet /> : null}");
    expect(await source("../app/(tabs)/settings.tsx")).toContain('{FEATURE_FLAGS.paidAccess ? <Section label="Premium">');
  });

  test("legacy mobile content endpoints are removed, not hidden behind entitlement checks", async () => {
    const youtube = await source("./youtube.ts");
    expect(youtube).not.toContain("requestBackend");
    expect(youtube).not.toContain("/youtube/channels/");
    expect(youtube).not.toContain("/youtube/videos/");
    expect(youtube).not.toContain("/youtube/search");
    const channel = await source("../app/channel/[id].tsx");
    expect(channel).toContain("cachedContentService.getChannelShelf(id)");
    expect(channel).toContain('["cached-channel", activeProfileId, id]');
  });
});
