import { expect, test } from "bun:test";
import { parseOnboardingDraft, emptyOnboardingDraft } from "./onboardingDraft";
import { clearProfileStorage, profileStorageKey, readProfileStorage } from "../storage/profileStorage";

test("restores the setup stage and first-save IDs without accepting malformed data", () => {
  expect(parseOnboardingDraft(JSON.stringify({ step: 3, savedIds: ["first", "first", "second"] }))).toEqual({ version: 8, step: 8, path: "creator", savedIds: ["first", "second"] });
  for (const raw of [null, "bad", "null", JSON.stringify({ step: 4, savedIds: [] }), JSON.stringify({ step: 1.5, savedIds: [] }), JSON.stringify({ step: 2, savedIds: [5] })]) expect(parseOnboardingDraft(raw)).toEqual(emptyOnboardingDraft);
});
test("setup drafts stay profile-local and are erased with profile data", async () => {
  const values = new Map<string, string>();
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); }, async removeItem(key: string) { values.delete(key); } };
  await storage.setItem(profileStorageKey("onboardingDraft", "owner"), '{"step":3,"savedIds":["first"]}');
  await storage.setItem(profileStorageKey("onboardingDraft", "other"), '{"step":1,"savedIds":[]}');
  expect(await readProfileStorage(storage, "onboardingDraft", "third")).toBeNull();
  await clearProfileStorage(storage, "owner");
  expect(await readProfileStorage(storage, "onboardingDraft", "owner")).toBeNull();
  expect(parseOnboardingDraft(await readProfileStorage(storage, "onboardingDraft", "other")).step).toBe(6);
});

test("restores the Google Cloud instruction, never credential fields or unrecognized progress", () => {
  const base = { version: 5, step: 1, savedIds: [] };
  const restored = (youtubeGuide: unknown) => parseOnboardingDraft(JSON.stringify({ ...base, youtubeGuide, key: "not-a-secret", draft: "do not restore" }));
  expect(restored("credentials")).toEqual({ ...base, version: 8, step: 0, youtubeGuide: "credentials" });
  expect(restored("verified")).toEqual({ ...base, version: 8, step: 0 });
});

test("an interrupted creator setup restores only the recognized YouTube identity", () => {
  const draft = { version: 5, step: 1, path: "creator", savedIds: [] };
  const restore = (sourceLink: string) => parseOnboardingDraft(JSON.stringify({ ...draft, sourceLink })).sourceLink;
  expect(restore("https://www.youtube.com/watch?v=YE7VzlLtp-4&t=20&si=unrelated")).toBe("https://youtu.be/YE7VzlLtp-4");
  expect(restore("https://youtube.com/@Blender")).toBe("@blender");
  expect(restore("https://example.org/private")).toBeUndefined();
  expect(restore("https://youtube.com/shorts/YE7VzlLtp-4")).toBeUndefined();
  expect(parseOnboardingDraft(JSON.stringify({ ...draft, path: undefined, sourceLink: "@blender" })).sourceLink).toBeUndefined();
});
test("restores the connection detour only on its matching setup step", () => {
  const restore = (step: number, returnTo: string) => parseOnboardingDraft(JSON.stringify({ version: 5, step, returnTo, savedIds: [] })).returnTo;
  expect(restore(1, "your-frame")).toBe("your-frame");
  expect(restore(1, "source")).toBe("source");
  expect(restore(0, "source")).toBeUndefined();
  expect(restore(1, "unrecognized")).toBeUndefined();
});

test("restores legacy progress in the keys-first flow without losing saves", () => {
  for (const step of [0, 1, 2, 3]) {
    expect(parseOnboardingDraft(JSON.stringify({ step, savedIds: ["kept"] }))).toEqual({ version: 8, step: [0, 6, 6, 8][step], savedIds: ["kept"], ...(step > 1 ? { path: "creator" } : {}) });
  }
});
test("inserting key setup preserves each version-two stage and saved videos", () => {
  for (const step of [0, 1, 2]) {
    expect(parseOnboardingDraft(JSON.stringify({ version: 2, step, savedIds: ["kept"] }))).toEqual({ version: 8, step: [6, 6, 8][step], savedIds: ["kept"], ...(step > 0 ? { path: "creator" } : {}) });
  }
});
test("new drafts restore directly and reject unknown versions or out-of-range stages", () => {
  for (const step of [0, 1, 2, 3]) expect(parseOnboardingDraft(JSON.stringify({ version: 3, step, savedIds: ["kept"] }))).toEqual({ version: 8, step: [0, 6, 6, 8][step], savedIds: ["kept"], ...(step > 1 ? { path: "creator" } : {}) });
  for (const step of [0, 1, 2]) expect(parseOnboardingDraft(JSON.stringify({ version: 4, step, savedIds: ["kept"] }))).toEqual({ version: 8, step: [0, 6, 8][step], savedIds: ["kept"] });
  for (const step of [0, 1, 2, 3]) expect(parseOnboardingDraft(JSON.stringify({ version: 5, step, savedIds: ["kept"], path: "creator" }))).toEqual({ version: 8, step: [4, 0, 6, 8][step], savedIds: ["kept"], path: "creator" });
  for (const step of [0, 1, 2, 3]) expect(parseOnboardingDraft(JSON.stringify({ version: 6, step, savedIds: ["kept"] }))).toEqual({ version: 8, step: [0, 4, 6, 8][step], savedIds: ["kept"] });
  for (let step = 0; step < 7; step++) expect(parseOnboardingDraft(JSON.stringify({ version: 7, step, savedIds: [] })).step).toBe([0, 1, 4, 5, 6, 7, 8][step]);
  for (let step = 0; step < 9; step++) expect(parseOnboardingDraft(JSON.stringify({ version: 8, step, savedIds: [] })).step).toBe(step);
  expect(parseOnboardingDraft(JSON.stringify({ version: 5, step: 4, savedIds: [] }))).toEqual(emptyOnboardingDraft);
  expect(parseOnboardingDraft(JSON.stringify({ version: 4, step: 3, savedIds: [] }))).toEqual(emptyOnboardingDraft);
  expect(parseOnboardingDraft(JSON.stringify({ version: 3, step: 4, savedIds: [] }))).toEqual(emptyOnboardingDraft);
  expect(parseOnboardingDraft(JSON.stringify({ version: 2, step: 3, savedIds: [] }))).toEqual(emptyOnboardingDraft);
  expect(parseOnboardingDraft(JSON.stringify({ version: 99, step: 1, savedIds: [] }))).toEqual(emptyOnboardingDraft);
});
