import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
const text = (path: string): Promise<string> => readFile(new URL(path, import.meta.url).pathname,"utf8");

describe("library metadata boundaries", () => {
  test("every thumbnail surface opts out of unmanaged native disk caching", async () => {
    for (const path of ["../components/VideoCard.tsx","../components/TodayVideoCard.tsx","../components/AddChannelModal.tsx","../app/(tabs)/sources.tsx","../app/channel/[id].tsx"]) {
      const code = await text(path);
      expect(code).toContain('cachePolicy="none"');
      expect(code).not.toContain('cachePolicy="memory-disk"');
    }
    expect(await text("./thumbnailRetention.ts")).toContain("await Image.clearDiskCache()");
    expect(await text("./thumbnailRetention.ts")).toContain("if (!disk || !memory) throw");
  });
  test("expired thumbnails cannot be recreated from a saved ID", async () => {
    for (const path of ["../app/watch/[id].tsx","../app/(tabs)/saved.tsx"]) expect(await text(path)).not.toContain("https://i.ytimg.com/vi/");
  });
  test("all metadata-bearing playback entry points preserve fetch time", async () => {
    for (const path of ["../components/VideoCard.tsx","../components/AddChannelModal.tsx","../app/(tabs)/index.tsx","../app/session/[id].tsx"]) expect(await text(path)).toContain("fetchedAt:");
    expect(await text("../app/watch/[id].tsx")).toContain("expireVideo(baseVideo, retentionClock)");
  });
  test("refresh only updates existing records and cannot rewrite action timestamps", async () => {
    const db = await text("../db/database.ts");
    const refresh = db.split("export async function refreshStoredLibraryMetadata")[1]?.split("type TodaySnapshotRow")[0] ?? "";
    expect(refresh).toContain("WHERE profileId=? AND id=?");
    expect(refresh).not.toContain("INSERT INTO");
    expect(refresh).not.toContain("SET timestampSeconds");
    expect(refresh).not.toContain("savedAt=excluded");
    expect(refresh).not.toContain("followedAt=excluded");
  });
});
