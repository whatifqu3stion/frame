import { describe, expect, test } from "bun:test";
import {
  executeSourceLeaseRequest,
  hashLeaseToken,
  MAX_SOURCE_LEASES_PER_REQUEST,
  type RegisteredSource,
  type SourceLeaseIdentity,
  type SourceLeaseRepository,
} from "../functions/_shared/source-leases";

const known = { provider: "youtube", providerSourceId: "UC-known", sourceId: "source-known" } as const;
const token = "a".repeat(64);
const functionPath = new URL("../functions/source-leases/index.ts", import.meta.url);

class MemoryRepository implements SourceLeaseRepository {
  enabled = true;
  readonly registered = new Map<string, RegisteredSource>([[key(known), known]]);
  readonly leases = new Map<string, { sourceId: string; expiresAt: string; renewals: number }>();
  sourceCreations = 0;

  async isEnabled(): Promise<boolean> { return this.enabled; }
  async findRegisteredSources(sources: readonly SourceLeaseIdentity[]): Promise<readonly RegisteredSource[]> {
    return sources.flatMap((source) => this.registered.get(key(source)) ?? []);
  }
  async createOrRenew(sourceId: string, leaseTokenHash: string, expiresAt: string): Promise<void> {
    const existing = this.leases.get(leaseTokenHash);
    this.leases.set(leaseTokenHash, { sourceId, expiresAt, renewals: (existing?.renewals ?? 0) + 1 });
  }
  async release(leaseTokenHash: string): Promise<void> { this.leases.delete(leaseTokenHash); }
}

function key(source: SourceLeaseIdentity): string {
  return `${source.provider}\n${source.providerSourceId}`;
}

function request(action: "sync" | "release", providerSourceId: string = known.providerSourceId, leaseToken: string = token): unknown {
  return { action, sources: [{ provider: "youtube", providerSourceId, leaseToken }] };
}

describe("Round 3B source lease Edge Function boundary", () => {
  test("a known source acquires and renews one hashed lease", async () => {
    const repository = new MemoryRepository();
    const first = await executeSourceLeaseRequest(request("sync"), repository, new Date("2026-08-30T00:00:00.000Z"));
    const second = await executeSourceLeaseRequest(request("sync"), repository, new Date("2026-09-06T00:00:00.000Z"));
    const expectedHash = await hashLeaseToken(token);

    expect(first.body.results).toEqual([{ provider: "youtube", providerSourceId: known.providerSourceId, status: "synced" }]);
    expect(second.body.results[0]?.status).toBe("synced");
    expect(repository.leases.size).toBe(1);
    expect(repository.leases.get(expectedHash)?.renewals).toBe(2);
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(repository.leases.has(token)).toBe(false);
  });

  test("an unknown source creates neither a source nor a lease", async () => {
    const repository = new MemoryRepository();
    const result = await executeSourceLeaseRequest(request("sync", "UC-unknown"), repository);
    expect(result.body.results[0]?.status).toBe("unknown_source");
    expect(repository.sourceCreations).toBe(0);
    expect(repository.leases.size).toBe(0);
  });

  test("rejects requests above the 25-source boundary", async () => {
    const repository = new MemoryRepository();
    const sources = Array.from({ length: MAX_SOURCE_LEASES_PER_REQUEST + 1 }, (_, index) => ({
      provider: "youtube",
      providerSourceId: `UC-${index}`,
      leaseToken: index.toString(16).padStart(64, "0"),
    }));
    const result = await executeSourceLeaseRequest({ action: "sync", sources }, repository);
    expect(result.status).toBe(400);
    expect(result.body.results).toEqual([]);
    expect(repository.leases.size).toBe(0);
  });

  test("validates exact fields and never echoes a plaintext token", async () => {
    const repository = new MemoryRepository();
    const extraField = await executeSourceLeaseRequest({
      action: "sync",
      sources: [{ provider: "youtube", providerSourceId: known.providerSourceId, leaseToken: token, profileId: "private" }],
    }, repository);
    const uppercaseToken = await executeSourceLeaseRequest(request("sync", known.providerSourceId, "A".repeat(64)), repository);
    expect(extraField.body.results[0]?.status).toBe("invalid_request");
    expect(uppercaseToken.body.results[0]?.status).toBe("invalid_request");
    expect(JSON.stringify(extraField.body)).not.toContain(token);
  });

  test("returns disabled and temporary states without changing leases", async () => {
    const disabledRepository = new MemoryRepository();
    disabledRepository.enabled = false;
    expect((await executeSourceLeaseRequest(request("sync"), disabledRepository)).body.results[0]?.status).toBe("disabled");

    const unavailableRepository = new MemoryRepository();
    unavailableRepository.isEnabled = async () => { throw new Error("offline"); };
    expect((await executeSourceLeaseRequest(request("sync"), unavailableRepository)).body.results[0]?.status).toBe("temporarily_unavailable");
    expect(disabledRepository.leases.size).toBe(0);
    expect(unavailableRepository.leases.size).toBe(0);
  });

  test("uses the existing client-key boundary and never creates sources or calls providers", async () => {
    const sourceCode = await Bun.file(functionPath).text();
    expect(sourceCode).toContain("hasValidPublishableKey(request, Deno.env.get)");
    expect(sourceCode).toContain('.from("service_controls")');
    expect(sourceCode).toContain('.from("sources")');
    expect(sourceCode).not.toMatch(/\.from\(["']sources["']\)\s*\.insert/);
    expect(sourceCode).not.toMatch(/youtube\.googleapis|generativelanguage|openai|anthropic|fetch\(/i);
    expect(sourceCode).not.toMatch(/console\.(?:log|warn|error)/);
  });

  test("releases only the lease matching the supplied token", async () => {
    const repository = new MemoryRepository();
    await executeSourceLeaseRequest(request("sync"), repository);
    const otherHash = await hashLeaseToken("b".repeat(64));
    repository.leases.set(otherHash, { sourceId: known.sourceId, expiresAt: "2026-10-01T00:00:00.000Z", renewals: 1 });
    const result = await executeSourceLeaseRequest(request("release"), repository);
    expect(result.body.results[0]?.status).toBe("released");
    expect(repository.leases.has(await hashLeaseToken(token))).toBe(false);
    expect(repository.leases.has(otherHash)).toBe(true);
  });
});
