import { expect, test } from "bun:test";
import { createCustomInterest, interestTopics } from "./interests";
import { DEFAULT_DISCOVERY_BRIEF } from "./discoveryBrief";
import { addedInterests, exportProfile, parseProfile } from "./profileTransfer";

const topics = interestTopics(["music", createCustomInterest("Japanese joinery")]);
test("profile round trip works without channels and keeps only portable fields", () => {
  const data = exportProfile("Studio", [], topics, "Show me artists’ processes.\nInclude interviews.");
  expect(parseProfile(data.replace(/\n/g, "\r\n"))).toEqual({ channels: [], interests: topics, brief: "Show me artists’ processes.\nInclude interviews." });
  expect(Object.keys(JSON.parse(data.split("```json\n")[1].split("\n")[0])).sort()).toEqual(["discoveryBrief", "interests"]);
  expect(parseProfile(exportProfile("Owner", [], [], DEFAULT_DISCOVERY_BRIEF)).brief).toBe(DEFAULT_DISCOVERY_BRIEF);
});
test("overlaps retain the existing spelling and independent standard choices", () => {
  const local = interestTopics(["science", createCustomInterest("Japanese JOINERY")]);
  expect(addedInterests(local, topics)).toEqual({ standard: interestTopics(["music"]), custom: [] });
  expect(addedInterests(topics, topics)).toEqual({ standard: [], custom: [] });
});
test("legacy lists carry no preferences and malformed profile data fails before review", () => {
  const file = "# Old list\n- [Studio](https://www.youtube.com/channel/UC6107grRI4m0o2-emgoDnAA)";
  expect(parseProfile(file)).toMatchObject({ interests: [], brief: null, channels: [{ title: "Studio" }] });
  const data = exportProfile("Owner", [], topics, DEFAULT_DISCOVERY_BRIEF);
  for (const bad of [data.replace("v1", "v2"), data.replace('"music"', 'false'), data.replace(DEFAULT_DISCOVERY_BRIEF, ""), data + "\ninvalid link"]) {
    expect(() => parseProfile(bad)).toThrow();
  }
});
