import { describe, expect, test } from "bun:test";
import { resolveOrientationLock, type OrientationOwner } from "./orientationPolicy";

describe("browsing and playback orientation", () => {
  test("uses the device default when no screen owns orientation", () => {
    expect(resolveOrientationLock(new Map(), "default")).toBe("default");
  });

  test("honors an app request even when its value is zero", () => {
    expect(resolveOrientationLock(new Map([["app", 0]]), 1)).toBe(0);
  });

  test("fullscreen wins regardless of request insertion order", () => {
    const requests = new Map<OrientationOwner, string>([
      ["fullscreen", "landscape"], ["watch", "watch-policy"], ["app", "app-policy"],
    ]);
    expect(resolveOrientationLock(requests, "default")).toBe("landscape");
    expect(resolveOrientationLock(new Map([...requests].reverse()), "default")).toBe("landscape");
  });

  test("leaving fullscreen and playback restores each remaining owner", () => {
    const requests = new Map<OrientationOwner, string>([
      ["app", "app-policy"], ["watch", "watch-policy"], ["fullscreen", "landscape"],
    ]);
    requests.delete("fullscreen");
    expect(resolveOrientationLock(requests, "default")).toBe("watch-policy");
    requests.delete("watch");
    expect(resolveOrientationLock(requests, "default")).toBe("app-policy");
    requests.delete("app");
    expect(resolveOrientationLock(requests, "default")).toBe("default");
  });
});
