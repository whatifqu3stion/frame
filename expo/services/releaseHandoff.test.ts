import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const text = (path: string): Promise<string> => readFile(new URL(path, import.meta.url).pathname, "utf8");

describe("pre-design release handoff", () => {
  test("keeps the native acceptance guide aligned with the current feature contract", async () => {
    const smoke = await text("../docs/SMOKE_TEST.md");
    for (const boundary of [
      "Today, Sources, Saved, and Settings",
      "Selected Videos",
      "Approved Sources",
      "Daily time and Managed playback controls",
      "Finite Today",
      "one to three videos",
      "Selective Google import",
      "database version 9",
    ]) expect(smoke).toContain(boundary);
    expect(smoke).toContain("Premium in test mode");
    expect(smoke).not.toContain("add it to Watch Later");
  });

  test("records the Rork/Codex boundary without assigning product logic to native plumbing", async () => {
    const handoff = await text("../docs/RORK_HANDOFF.md");
    expect(handoff).toContain("Rork owns next");
    expect(handoff).toContain("Codex retains");
    expect(handoff).toContain("without rewriting product logic");
    expect(handoff).toContain("Day-one Premium capability logic");
    expect(handoff).toContain("Unreviewed or automatic Weekly Picks publication");
  });

  test("reset disclosure includes Managed content state", async () => {
    const settings = await text("../app/(tabs)/settings.tsx");
    expect(settings).toContain("playback and content boundary");
    expect(settings).toContain("usage record, request, and library item");
  });
});
