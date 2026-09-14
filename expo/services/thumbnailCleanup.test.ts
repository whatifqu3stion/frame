import { describe, expect, test } from "bun:test";
import { createThumbnailCleanup } from "./thumbnailCleanup";

describe("thumbnail cleanup lifecycle", () => {
  test("coalesces overlapping calls and reports success only after both settle", async () => {
    let finishDisk: (value: boolean) => void = () => {};
    let calls = 0;
    const service = createThumbnailCleanup({ isWeb: false, now: () => 100,
      clearDisk: () => { calls++; return new Promise<boolean>((resolve) => { finishDisk = resolve; }); },
      clearMemory: async () => true,
    });
    const first = service.run();
    const second = service.run();
    expect(first).toBe(second);
    await Promise.resolve();
    expect(calls).toBe(1);
    expect(service.getStatus().state).toBe("running");
    finishDisk(true);
    await first;
    expect(service.getStatus()).toEqual({ state: "succeeded", attemptedAt: 100, completedAt: 100, diskCleared: true, memoryCleared: true });
  });

  test("disk bridge errors do not skip memory cleanup and retry can recover", async () => {
    let fails = true;
    let memoryCalls = 0;
    const service = createThumbnailCleanup({ isWeb: false, now: () => 200,
      clearDisk: () => { if (fails) throw new Error("sensitive native details"); return Promise.resolve(true); },
      clearMemory: async () => { memoryCalls++; return true; },
    });
    await expect(service.run()).rejects.toThrow("Thumbnail cleanup is pending");
    expect(memoryCalls).toBe(1);
    expect(service.getStatus()).toMatchObject({ state: "pending", diskCleared: false, memoryCleared: true });
    expect(JSON.stringify(service.getStatus())).not.toContain("sensitive");
    fails = false;
    await service.run();
    expect(memoryCalls).toBe(2);
    expect(service.getStatus().state).toBe("succeeded");
  });

  test("false results and memory rejections never count as success", async () => {
    const service = createThumbnailCleanup({ isWeb: false, now: () => 300,
      clearDisk: async () => false,
      clearMemory: async () => { throw new Error("unavailable"); },
    });
    await expect(service.run()).rejects.toThrow();
    expect(service.getStatus()).toMatchObject({ state: "pending", diskCleared: false, memoryCleared: false });
  });

  test("web never invokes native cleanup or claims native success", async () => {
    let calls = 0;
    const clear = async (): Promise<boolean> => { calls++; return true; };
    const service = createThumbnailCleanup({ isWeb: true, now: () => 400, clearDisk: clear, clearMemory: clear });
    await service.run();
    expect(calls).toBe(0);
    expect(service.getStatus()).toMatchObject({ state: "web-unmanaged", attemptedAt: null, completedAt: null });
  });

  test("a later failed foreground attempt replaces earlier success", async () => {
    let succeeds = true;
    const service = createThumbnailCleanup({ isWeb: false, now: () => 500,
      clearDisk: async () => succeeds, clearMemory: async () => true,
    });
    await service.run();
    const snapshot = service.getStatus();
    snapshot.state = "pending";
    expect(service.getStatus().state).toBe("succeeded");
    succeeds = false;
    await expect(service.run()).rejects.toThrow();
    expect(service.getStatus().state).toBe("pending");
  });
});
