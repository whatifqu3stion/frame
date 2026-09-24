import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const providerPath = new URL("../providers/AppProvider.tsx", import.meta.url);
const servicePath = new URL("./managedContentAccessService.ts", import.meta.url);
const todayPath = new URL("../app/(tabs)/index.tsx", import.meta.url);
const sourcesPath = new URL("../app/(tabs)/sources.tsx", import.meta.url);
const watchPath = new URL("../app/watch/[id].tsx", import.meta.url);

describe("Managed content access boundaries", () => {
  test("gates every player mount, start, and checkpoint on current content approval", async () => {
    const watch = await readFile(watchPath.pathname, "utf8");
    expect(watch).toContain("contentAccessStatus?.canPlay === true");
    expect(watch).toContain("getManagedContentAccess(accessVideo), getPlaybackAllowance()");
    expect(watch).toContain("void getManagedContentAccess(accessVideo).then(async (access)");
    expect(watch).toContain("if (!access.canPlay)");
    expect(watch.indexOf("if (!access.canPlay)", watch.indexOf("handleStateChange"))).toBeLessThan(watch.indexOf("beginAllowancePlayback()", watch.indexOf("handleStateChange")));
  });

  test("does not trust route-supplied source metadata for Approved Sources", async () => {
    const watch = await readFile(watchPath.pathname, "utf8");
    expect(watch).toContain('managedMode === "approvedSources"');
    expect(watch).toContain("!hasLocallyTrustedMetadata");
    expect(watch).toContain("needsManagedSourceVerification ? verifiedVideo ?? undefined : baseVideo");
    expect(watch).toContain("needsManagedSourceVerification || (contentAccessStatus?.canPlay === true");
  });

  test("protects Owner mutations with authorization and an established PIN", async () => {
    const provider = await readFile(providerPath.pathname, "utf8");
    for (const name of ["setManagedContentMode", "approveManagedContent", "reviewManagedApprovalRequest", "revokeManagedContent"]) {
      const start = provider.indexOf(`const ${name}`);
      const end = provider.indexOf("\n  const ", start + 10);
      const mutation = provider.slice(start, end);
      expect(start).toBeGreaterThan(-1);
      expect(mutation).toContain("await authorizeProtectedAction");
      expect(mutation).toContain("if (!hasOwnerPin)");
    }
  });

  test("invalidates obsolete requests when the Owner changes access mode", async () => {
    const service = await readFile(servicePath.pathname, "utf8");
    expect(service).toContain("if (existing.mode !== mode)");
    expect(service).toContain("clearManagedApprovalRequests(profile.id)");
    expect(service).toContain("request.kind !== expectedKind");
  });

  test("keeps Managed Today and Sources finite and limited to active approvals", async () => {
    const [today, sources] = await Promise.all([
      readFile(todayPath.pathname, "utf8"),
      readFile(sourcesPath.pathname, "utf8"),
    ]);
    expect(today).toContain('managedOverview.policy.mode === "selectedVideos"');
    expect(today).toContain("managedOverview.approvedVideos");
    expect(today).toContain("followedChannels.filter((source) => approved.has(source.id))");
    expect(sources).toContain('activeProfile?.role !== "managed" && section === "discover"');
    expect(sources).toContain("managedOverview.approvedSources");
    expect(sources).toContain("followedChannels.filter((source) => approved.has(source.id))");
  });
});
