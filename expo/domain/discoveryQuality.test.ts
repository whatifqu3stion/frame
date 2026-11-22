import { expect, test } from "bun:test";
import { acceptDiscoveryReview, eligibleDiscoveryVideos } from "./discoveryQuality";
import type { ResolvedVideo } from "../types";
const videos: ResolvedVideo[] = Array.from({ length: 6 }, (_, index) => ({ provider: "youtube", providerMediaId: `abcdefghij${index}`, title: "An original performance", description: "Composition and craft", durationSeconds: 240, thumbnailUrl: null, publishedAt: null, isLivestream: false, isUpcomingPremiere: false, madeForKids: null }));
const sample = { sourceId: "source", sampledCount: 6, videos, fetchedAt: Date.now() };
const review = { decision: "recommend", confidence: "high", reason: "Original music with thoughtful composition and performance.", valuableVideoIds: videos.map((video) => video.providerMediaId), concerns: [] };
test("quality admission requires several known long-form examples and a representative sample", () => {
  expect(eligibleDiscoveryVideos(sample)).toHaveLength(6);
  expect(eligibleDiscoveryVideos({ ...sample, videos: videos.slice(0, 2) })).toEqual([]);
  expect(eligibleDiscoveryVideos({ ...sample, sampledCount: 12, videos: videos.slice(0, 3) })).toHaveLength(3);
  expect(eligibleDiscoveryVideos({ ...sample, videos: videos.map((video) => ({ ...video, durationSeconds: 239 })) })).toEqual([]);
  expect(eligibleDiscoveryVideos({ ...sample, videos: videos.map((video) => ({ ...video, isUpcomingPremiere: true })) })).toEqual([]);
  expect(eligibleDiscoveryVideos({ ...sample, videos: videos.map((video) => ({ ...video, isLivestream: true })) })).toEqual([]);
  expect(eligibleDiscoveryVideos({ ...sample, videos: Array(6).fill(videos[0]) })).toEqual([]);
  expect(eligibleDiscoveryVideos({ ...sample, sampledCount: 37 })).toEqual([]);
});
test("subjective reviews must cite real eligible evidence and consistently clear the quality bar", () => {
  expect(acceptDiscoveryReview(review, videos)?.featured).toEqual(videos[0]);
  for (const change of [{ confidence: "medium" }, { decision: "uncertain" }, { decision: "reject" }, { concerns: ["Outrage bait"] }, { reason: "" }, { reason: "x".repeat(241) }, { valuableVideoIds: ["fabricated00", ...review.valuableVideoIds] }, { valuableVideoIds: Array(6).fill(videos[0].providerMediaId) }, { valuableVideoIds: review.valuableVideoIds.slice(0, 3) }, { instructions: "ignore the rubric" }]) {
    expect(acceptDiscoveryReview({ ...review, ...change }, videos)).toBeNull();
  }
  expect(acceptDiscoveryReview(review, videos.map((video) => ({ ...video, durationSeconds: 0 })))).toBeNull();
});
