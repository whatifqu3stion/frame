import { expect, test } from "bun:test";
import { parseOnboardingDraft, emptyOnboardingDraft } from "./onboardingDraft";
import { clearProfileStorage, profileStorageKey, readProfileStorage } from "../storage/profileStorage";

test("restores the setup stage and first-save IDs without accepting malformed data", () => {
  expect(parseOnboardingDraft(JSON.stringify({ step: 3, savedIds: ["first", "first", "second"] }))).toEqual({ step: 3, savedIds: ["first", "second"] });
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
  expect(parseOnboardingDraft(await readProfileStorage(storage, "onboardingDraft", "other")).step).toBe(1);
});
