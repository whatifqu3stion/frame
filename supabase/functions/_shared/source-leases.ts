export const MAX_SOURCE_LEASES_PER_REQUEST = 25;
export const SOURCE_LEASE_DURATION_DAYS = 30;

export type SourceLeaseAction = "sync" | "release";
export type SourceLeaseResultStatus =
  | "synced"
  | "released"
  | "unknown_source"
  | "disabled"
  | "invalid_request"
  | "temporarily_unavailable";

export interface SourceLeaseInput {
  provider: string;
  providerSourceId: string;
  leaseToken: string;
}

export interface SourceLeaseIdentity {
  provider: string;
  providerSourceId: string;
}

export interface RegisteredSource extends SourceLeaseIdentity {
  sourceId: string;
}

export interface SourceLeaseResult extends SourceLeaseIdentity {
  status: SourceLeaseResultStatus;
}

export interface SourceLeaseRepository {
  isEnabled(): Promise<boolean>;
  findRegisteredSources(sources: readonly SourceLeaseIdentity[]): Promise<readonly RegisteredSource[]>;
  createOrRenew(sourceId: string, leaseTokenHash: string, expiresAt: string): Promise<void>;
  release(leaseTokenHash: string): Promise<void>;
}

export interface SourceLeaseExecution {
  status: 200 | 400;
  body: { results: SourceLeaseResult[]; message?: string };
}

type ValidatedItem = {
  index: number;
  input: SourceLeaseInput;
};

/** Executes the anonymous lease contract without creating or modifying shared sources. */
export async function executeSourceLeaseRequest(
  input: unknown,
  repository: SourceLeaseRepository,
  now: Date = new Date(),
): Promise<SourceLeaseExecution> {
  if (!isPlainObject(input) || !hasOnlyKeys(input, ["action", "sources"])) {
    return invalidRequest("A valid lease request is required.");
  }
  if (input.action !== "sync" && input.action !== "release") {
    return invalidRequest("A valid lease action is required.");
  }
  if (!Array.isArray(input.sources) || input.sources.length === 0 || input.sources.length > MAX_SOURCE_LEASES_PER_REQUEST) {
    return invalidRequest(`Send between 1 and ${MAX_SOURCE_LEASES_PER_REQUEST} sources.`);
  }

  const action = input.action;
  const results: SourceLeaseResult[] = new Array(input.sources.length);
  const validItems: ValidatedItem[] = [];
  const seen = new Set<string>();

  input.sources.forEach((value: unknown, index: number) => {
    const parsed = parseItem(value);
    if (!parsed) {
      results[index] = invalidItemResult(value);
      return;
    }
    const key = identityKey(parsed);
    if (seen.has(key)) {
      results[index] = { provider: parsed.provider, providerSourceId: parsed.providerSourceId, status: "invalid_request" };
      return;
    }
    seen.add(key);
    validItems.push({ index, input: parsed });
  });

  if (validItems.length === 0) return { status: 200, body: { results } };

  let enabled: boolean;
  try {
    enabled = await repository.isEnabled();
  } catch {
    fillValidResults(results, validItems, "temporarily_unavailable");
    return { status: 200, body: { results } };
  }
  if (!enabled) {
    fillValidResults(results, validItems, "disabled");
    return { status: 200, body: { results } };
  }

  let registered: readonly RegisteredSource[];
  try {
    registered = await repository.findRegisteredSources(validItems.map(({ input: item }) => item));
  } catch {
    fillValidResults(results, validItems, "temporarily_unavailable");
    return { status: 200, body: { results } };
  }
  const registeredByIdentity = new Map<string, RegisteredSource>(registered.map((source) => [identityKey(source), source]));
  const expiresAt = new Date(now.getTime() + SOURCE_LEASE_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const item of validItems) {
    const source = registeredByIdentity.get(identityKey(item.input));
    if (!source) {
      results[item.index] = resultFor(item.input, "unknown_source");
      continue;
    }

    try {
      const tokenHash = await hashLeaseToken(item.input.leaseToken);
      if (action === "sync") {
        await repository.createOrRenew(source.sourceId, tokenHash, expiresAt);
        results[item.index] = resultFor(item.input, "synced");
      } else {
        await repository.release(tokenHash);
        results[item.index] = resultFor(item.input, "released");
      }
    } catch {
      results[item.index] = resultFor(item.input, "temporarily_unavailable");
    }
  }

  return { status: 200, body: { results } };
}

/** Produces the lowercase SHA-256 value accepted by the trusted Round 3A functions. */
export async function hashLeaseToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte: number) => byte.toString(16).padStart(2, "0")).join("");
}

function parseItem(value: unknown): SourceLeaseInput | null {
  if (!isPlainObject(value) || !hasOnlyKeys(value, ["provider", "providerSourceId", "leaseToken"])) return null;
  if (typeof value.provider !== "string" || !/^[a-z][a-z0-9_-]{0,31}$/.test(value.provider)) return null;
  if (typeof value.providerSourceId !== "string" || !isBoundedIdentifier(value.providerSourceId, 255)) return null;
  if (typeof value.leaseToken !== "string" || !/^[0-9a-f]{64}$/.test(value.leaseToken)) return null;
  return {
    provider: value.provider,
    providerSourceId: value.providerSourceId,
    leaseToken: value.leaseToken,
  };
}

function invalidItemResult(value: unknown): SourceLeaseResult {
  const provider = isPlainObject(value) && typeof value.provider === "string" && value.provider.length <= 32 ? value.provider : "";
  const providerSourceId = isPlainObject(value) && typeof value.providerSourceId === "string" && value.providerSourceId.length <= 255
    ? value.providerSourceId
    : "";
  return { provider, providerSourceId, status: "invalid_request" };
}

function fillValidResults(results: SourceLeaseResult[], items: readonly ValidatedItem[], status: SourceLeaseResultStatus): void {
  for (const item of items) results[item.index] = resultFor(item.input, status);
}

function resultFor(item: SourceLeaseIdentity, status: SourceLeaseResultStatus): SourceLeaseResult {
  return { provider: item.provider, providerSourceId: item.providerSourceId, status };
}

function invalidRequest(message: string): SourceLeaseExecution {
  return { status: 400, body: { results: [], message } };
}

function identityKey(source: SourceLeaseIdentity): string {
  return JSON.stringify([source.provider, source.providerSourceId]);
}

function isBoundedIdentifier(value: string, maximumLength: number): boolean {
  return value.length > 0
    && value.length <= maximumLength
    && value === value.trim()
    && Array.from(value).every((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    });
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key: string) => allowed.includes(key));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
