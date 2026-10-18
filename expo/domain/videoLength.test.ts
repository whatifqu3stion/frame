import { describe, expect, test } from "bun:test";
import { isLongFormDuration, videoLengthMessage } from "./videoLength";

describe("Frame's length-based short-form policy", () => {
  test("excludes the complete three-minute boundary regardless of URL or format", () => {
    for (const seconds of [1, 60, 179, 180]) expect(isLongFormDuration(seconds)).toBeFalse();
    for (const seconds of [181, 482, 3600]) expect(isLongFormDuration(seconds)).toBeTrue();
  });

  test("fails closed for unknown, malformed, and non-finite durations", () => {
    for (const seconds of [undefined, null, 0, -1, NaN, Infinity, "600", 180.5]) expect(isLongFormDuration(seconds)).toBeFalse();
    expect(videoLengthMessage(0)).toContain("confirmed video length");
    expect(videoLengthMessage(180)).toContain("3 minutes or less");
  });
});
