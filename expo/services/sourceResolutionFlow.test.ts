import { describe, expect, test } from "bun:test";
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
});
