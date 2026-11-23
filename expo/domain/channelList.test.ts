import { expect, test } from "bun:test";
import { exportChannelList, parseChannelList } from "./channelList";
import { METADATA_MAX_AGE_MS } from "./metadataRetention";
import type { FollowedChannel } from "../types";

const now = 1_800_000_000_000;
const channel: FollowedChannel = {
  id: "UC6107grRI4m0o2-emgoDnAA", title: "Music [live] \\ Studio", thumbnailUrl: "",
  source: "link", followedAt: now, fetchedAt: now - 1000,
};

test("portable lists preserve canonical identities, escaped titles and original metadata age", () => {
  const text = exportChannelList("Studio", [channel], now);
  expect(parseChannelList(text.replace(/\n/g, "\r\n"), now)).toEqual([channel]);
  expect(parseChannelList(text + text, now)).toHaveLength(1);
  expect(parseChannelList(text, now + METADATA_MAX_AGE_MS)[0].fetchedAt).toBeNull();
});

test("rejects invalid or mixed files before importing any channels", () => {
  const text = exportChannelList("Studio", [channel], now);
  for (const invalid of ["# Empty", text + "- https://example.com", text.replace("youtube.com", "youtube.com.example"), "a".repeat(1048577)]) {
    expect(() => parseChannelList(invalid)).toThrow();
  }
});
