import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const providerPath = new URL("../providers/AppProvider.tsx", import.meta.url);
const todayPath = new URL("../app/(tabs)/index.tsx", import.meta.url);
const watchPath = new URL("../app/watch/[id].tsx", import.meta.url);

describe("Managed playback control boundaries", () => {
  test("composes controls with the existing daily allowance at status, start, checkpoint, stop, and profile switch", async () => {
    const source = await readFile(providerPath.pathname, "utf8");
    expect(source).toContain("playbackControlsService.getStatus(profile)");
    expect(source).toContain("playbackControlsService.beginPlaying(profile)");
    expect(source).toContain("playbackControlsService.checkpoint()");
    expect(source).toContain("playbackControlsService.stopPlaying()");
    expect(source).toContain("Promise.all([viewingAllowanceService.stopPlaying(stoppedAt), playbackControlsService.stopPlaying(stoppedAt)])");
  });

  test("protects mutations and fails closed before every player entry", async () => {
    const provider = await readFile(providerPath.pathname, "utf8");
    const today = await readFile(todayPath.pathname, "utf8");
    const watch = await readFile(watchPath.pathname, "utf8");
    const setter = provider.slice(provider.indexOf("const setManagedPlaybackControls"), provider.indexOf("const cancelPendingOwnerAllowance"));
    expect(setter).toContain("await authorizeProtectedAction()");
    expect(setter).toContain("if (!hasOwnerPin)");
    expect(today.indexOf("await getPlaybackAllowance(activeProfileId)")).toBeLessThan(today.indexOf("router.push({ pathname: FRAME_PLAYBACK_ROUTE"));
    expect(watch).toContain("getPlaybackAllowance().then");
    expect(watch).toContain("if (!status.canPlay)");
  });
});
