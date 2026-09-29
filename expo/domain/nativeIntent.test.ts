import { describe, expect, test } from "bun:test";
import { redirectSystemPath } from "../app/+native-intent";
const redirect = (path: string) => redirectSystemPath({ path, initial: true });
describe("System link recovery", () => {
  test("keeps ordinary app launches on Today", () => {
    for (const path of ["", "/", "https://frame.local/", "frame:///"]) expect(redirect(path)).toBe("/");
  });
  test("preserves supported watch links and query parameters", () => {
    const path = "/watch/abcde123456?sessionId=plan";
    expect(redirect(path)).toBe(path);
    expect(redirect(`https://frame.local${path}`)).toBe(path);
  });
  test("explains unsupported or malformed links without navigating externally", () => {
    for (const path of ["/watch/short", "/unknown", "http://[", "javascript:alert(1)"]) expect(redirect(path)).toBe("/link-unavailable");
  });
});
