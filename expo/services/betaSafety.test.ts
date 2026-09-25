import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";
import { canUseFeature, capabilitiesFor } from "../domain/capabilities";

const source = (path: string): Promise<string> => readFile(new URL(path, import.meta.url).pathname, "utf8");

describe("day-one Premium boundaries", () => {
  test("enables billing without gating the useful free core", () => {
    expect(FOUNDATION_CAPABILITIES.paidAccess).toBeTrue();
    expect(FOUNDATION_CAPABILITIES.googleSelectiveImport).toBeTrue();
    expect(FOUNDATION_CAPABILITIES.weeklyDiscovery).toBeTrue();
    for (const feature of ["library", "save", "watchLater", "resume", "interests", "creators", "import", "sessions", "discovery"] as const) {
      expect(canUseFeature(feature, false)).toBeTrue();
    }
    for (const feature of ["additionalProfiles", "managedControls", "deepFind"] as const) {
      expect(canUseFeature(feature, false)).toBeFalse();
      expect(canUseFeature(feature, true)).toBeTrue();
    }
    expect(capabilitiesFor(false)).toEqual({ sourceLimit: 5, profileLimit: 1, monthlyDeepFindLimit: 0 });
    expect(capabilitiesFor(true)).toEqual({ sourceLimit: 25, profileLimit: 3, monthlyDeepFindLimit: 3 });
  });

  test("free playback is independent of purchase status and paid access uses the actual entitlement", async () => {
    const provider = await source("../providers/AppProvider.tsx");
    expect(provider).toContain("canUseFeature(feature, isPremium)");
    expect(provider).toContain("canUseLibrary: true");
    expect(provider).toContain('!customerInfoQuery.isError && hasPremiumEntitlement(customerInfoQuery.data)');
    const watch = await source("../app/watch/[id].tsx");
    expect(watch).not.toContain("isPremium");
    expect(watch).toContain("canUseLibrary");
  });

  test("paid access configures RevenueCat with the protected identity", async () => {
    const billing = await source("./revenueCat.ts");
    expect(billing).toContain("await installationIdentityStore.getOrCreate()");
    expect(billing).toContain("Purchases.configure({ apiKey: revenueCatApiKey, appUserID })");
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
