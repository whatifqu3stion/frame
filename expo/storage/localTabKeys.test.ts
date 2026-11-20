import { expect, test } from "bun:test";
import { createLocalTabKeys } from "./localTabKeys";

test("hosted sites and production builds cannot enable preview credentials", () => {
  expect(createLocalTabKeys(true, "localhost.example.com")).toBeNull();
  expect(createLocalTabKeys(true, "192.168.1.123")).toBeNull();
  expect(createLocalTabKeys(false, "localhost")).toBeNull();
});

test("a fresh tab cannot read a key verified in another tab", async () => {
  const first = createLocalTabKeys(true, "localhost")!;
  const fresh = createLocalTabKeys(true, "localhost")!;
  await first.save("youtube", "unit-test-placeholder-value");
  expect((await first.status()).youtube).toBe(true);
  expect(await fresh.read("youtube")).toBeNull();
  await first.clear();
  expect(await first.read("youtube")).toBeNull();
});
