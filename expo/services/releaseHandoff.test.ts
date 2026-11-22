import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const text = (path: string): Promise<string> => readFile(new URL(path, import.meta.url).pathname, "utf8");

describe("BYOK release handoff", () => {
  test("keeps the native acceptance guide aligned with the current feature contract", async () => {
    const smoke = await text("../docs/SMOKE_TEST.md");
    for (const boundary of [
      "Today, Sources, Saved, and Settings",
      "Selected Videos",
      "Approved Sources",
      "Daily time and Managed playback controls",
      "Finite Today",
      "time-based Session",
      "Google account import is retired",
      "Keys and live discovery",
      "500-item session",
    ]) expect(smoke).toContain(boundary);
    expect(smoke).toContain("full-access BYOK");
    expect(smoke).not.toContain("welcome flow includes a clearly labeled sample checkout");
    expect(smoke).not.toContain("paywall and restore");
    expect(smoke).not.toContain("add it to Watch Later");
  });

  test("the release checklist names the actual verification and build commands", async () => {
    const smoke = await text("../docs/SMOKE_TEST.md");
    const manifest = JSON.parse(await text("../package.json"));
    expect(smoke).toContain("bun run verify");
    expect(smoke).toContain("npm run android:apk");
    expect(manifest.scripts.verify).toBe("bun run typecheck && bun run lint && bun run test");
    expect(manifest.scripts["android:apk"]).toBe("node scripts/build-android-apk.mjs");
    expect(smoke).toContain("Browser previews and mocked tests do not establish native acceptance");
  });

  test("reset disclosure includes Managed content state", async () => {
    const settings = await text("../components/SettingsDetails.tsx");
    expect(settings).toContain("viewing limits and schedules");
    expect(settings).toContain("usage records, content approvals and pending requests");
    expect(settings).toContain("all profiles, libraries and both API keys");
  });
});
