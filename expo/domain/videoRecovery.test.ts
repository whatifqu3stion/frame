import { expect, test } from "bun:test";
import { validRecoveredVideo } from "./videoRecovery";
import { METADATA_MAX_AGE_MS } from "./metadataRetention";
import type { Video } from "../types";
const now = Date.parse("2026-10-02T12:00:00Z");
const video: Video = { id: "video000001", channelId: "UCabcdefghijklmnopqrstuv", title: "Fresh title", channelTitle: "Source", thumbnailUrl: "", publishedAt: "", durationSeconds: 600, fetchedAt: now };
test("recovery accepts only current matching media with verified source identity", () => {
  expect(validRecoveredVideo(video.id, video, now)).toBeTrue();
  for (const invalid of [null, { ...video, id: "video000002" }, { ...video, channelId: "" }, { ...video, title: " " }, { ...video, fetchedAt: now - METADATA_MAX_AGE_MS }, { ...video, fetchedAt: now + 1 }]) expect(validRecoveredVideo(video.id, invalid, now)).toBeFalse();
});

test("metadata recovery cannot restore playback for short or unknown-length content", () => {
  for (const durationSeconds of [0, 60, 180]) expect(validRecoveredVideo(video.id, { ...video, durationSeconds }, now)).toBeFalse();
  expect(validRecoveredVideo(video.id, { ...video, durationSeconds: 181 }, now)).toBeTrue();
});
