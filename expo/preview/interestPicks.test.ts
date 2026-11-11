import { expect, test } from "bun:test";
import { sampleInterestPicks } from "./interestPicks";
import { isPreviewVideo } from "./library";

test("sample picks match selected topics and never stand in for a real creator or video", () => {
  const sample = sampleInterestPicks(["science", "design"], Date.now());
  expect(sample.items.slice(0, 2).map((pick) => pick.interestId)).toEqual(["science", "design"]);
  expect(sample.items.every((pick) => pick.featuredMedia && isPreviewVideo(pick.featuredMedia.providerMediaId))).toBe(true);
  expect(sampleInterestPicks(["custom:astronomy"], Date.now()).items).toEqual([]);
});
