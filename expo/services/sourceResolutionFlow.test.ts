import { describe, expect, test } from "bun:test";
import { PRODUCT_LIMITS } from "../constants/productConfig";
import { planSelectiveGoogleImport } from "./googleImportPolicy";
import { parseSourceInput } from "../domain/sourceInput";
import { confirmSourceFollow } from "./sourceResolutionFlow";
import type { FollowedChannel, SourceResolution } from "../types";

const resolution: SourceResolution = {
  provenance: "provider",
  source: {
    provider: "youtube",
    providerSourceId: "UCabcdefghijklmnopqrstuv",
    handle: "@frame",
    displayName: "Frame Source",
    description: "A source",
    thumbnailUrl: "https://example.com/image.jpg",
  },
};

describe("manual shared-source mobile flow", () => {
  test("accepts only supported source and individual-video inputs", () => {
    expect(parseSourceInput("UCabcdefghijklmnopqrstuv")).toEqual({ kind: "channelId", value: "UCabcdefghijklmnopqrstuv" });
    expect(parseSourceInput("@Frame.Handle")).toEqual({ kind: "handle", value: "frame.handle" });
    expect(parseSourceInput("https://youtube.com/channel/UCabcdefghijklmnopqrstuv")).toEqual({ kind: "channelId", value: "UCabcdefghijklmnopqrstuv" });
    expect(parseSourceInput("https://youtu.be/abcdefghijk")).toEqual({ kind: "video", value: "abcdefghijk" });
    expect(parseSourceInput("https://youtube.com/watch?v=abcdefghijk&list=PL-private").kind).toBe("unknown");
    expect(parseSourceInput("calm science videos").kind).toBe("unknown");
    expect(parseSourceInput("https://youtube.com/playlist?list=PL-private").kind).toBe("unknown");
    expect(parseSourceInput("https://example.com/@frame").kind).toBe("unknown");
  });

  test("resolution alone cannot follow; explicit confirmation saves to one profile and reconciles", async () => {
    const follows: { profileId: string; channel: FollowedChannel }[] = [];
    let reconciliations = 0;
    expect(follows).toEqual([]);
    const result = await confirmSourceFollow("profile-one", resolution, {
      followedSources: {
        async listForProfile() { return []; },
        async follow(profileId: string, channel: FollowedChannel): Promise<void> { follows.push({ profileId, channel }); },
      },
      reconcile: () => { reconciliations += 1; },
      now: () => 1234,
    });
    expect(result.ok).toBe(true);
    expect(follows).toEqual([{
      profileId: "profile-one",
      channel: {
        id: resolution.source.providerSourceId,
        title: resolution.source.displayName,
        description: resolution.source.description,
        thumbnailUrl: resolution.source.thumbnailUrl,
        followedAt: 1234,
        fetchedAt: null,
        source: "link",
      },
    }]);
    expect(reconciliations).toBe(1);
  });

  test("uses the same source ceiling as Google import without mutating a full profile", async () => {
    let writes = 0;
    const followedSources = {
      async listForProfile() { return [{ id: "another-source" } as FollowedChannel]; },
      async follow() { writes += 1; },
    };
    const full = await confirmSourceFollow("owner", resolution, { followedSources, reconcile() {}, maxSources: 1 });
    expect(full.ok).toBe(false);
    expect(writes).toBe(0);
    const duplicate = await confirmSourceFollow("owner", { ...resolution, source: { ...resolution.source, providerSourceId: "another-source" } }, { followedSources, reconcile() {}, maxSources: 1 });
    expect(duplicate.ok).toBe(true);
    expect(writes).toBe(0);
  });
});

test("library capacity is separate from the 100 participating Today sources", async () => {
  const existing = Array.from({ length: 100 }, (_, i) => ({ id: `source-${i}` } as FollowedChannel));
  let writes = 0;
  const result = await confirmSourceFollow("owner", resolution, { followedSources: { async listForProfile() { return existing; }, async follow() { writes++; } }, reconcile() {} });
  expect(PRODUCT_LIMITS.futureSourcesPerProfile).toBe(500);
  expect(PRODUCT_LIMITS.sourceFeedMaxSources).toBe(100);
  expect(result.ok).toBeTrue(); expect(writes).toBe(1); expect(existing.length).toBe(100);
  const imported = planSelectiveGoogleImport([{ id: "new" } as FollowedChannel], new Set(existing.map((item) => item.id)), PRODUCT_LIMITS.futureSourcesPerProfile);
  expect(imported.channels.map((channel) => channel.id)).toEqual(["new"]); expect(imported.overflowCount).toBe(0);
});
