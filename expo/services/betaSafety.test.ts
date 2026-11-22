import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";

const source = (path: string): Promise<string> => readFile(new URL(path, import.meta.url).pathname, "utf8");

describe("full-access BYOK boundaries", () => {
  test("keeps billing disabled while launch discovery stays free", () => {
    expect(FOUNDATION_CAPABILITIES.paidAccess).toBeFalse();
    expect(FOUNDATION_CAPABILITIES.googleSelectiveImport).toBeFalse();
    expect(FOUNDATION_CAPABILITIES.weeklyDiscovery).toBeTrue();
  });

  test("free access is independent of purchase status and does not pretend to be an entitlement", async () => {
    const provider = await source("../providers/AppProvider.tsx");
    expect(provider).toContain('canUseLibrary: true');
    expect(provider).not.toContain('customerInfoQuery');
    expect(provider).not.toContain('services/revenueCat');
    const watch = await source("../app/watch/[id].tsx");
    expect(watch).not.toContain("isPremium");
    expect(watch).toContain("canUseLibrary");
  });

  test("billing SDK and both purchase surfaces are absent; keys replace plans in Settings", async () => {
    expect(FOUNDATION_CAPABILITIES.demoPaywall).toBeFalse();
    expect(await source("../package.json")).not.toContain("react-native-purchases");
    expect(await source("../app/_layout.tsx")).not.toContain("PaywallSheet");
    expect(await source("../components/OnboardingFlow.tsx")).not.toContain("DemoPaywall");
    expect(await source("../components/SettingsDetails.tsx")).toContain('section === "keys"');
    expect(await source("../app/(tabs)/settings.tsx")).toContain('testID="settings-keys"');
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
