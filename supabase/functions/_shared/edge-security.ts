export type EnvironmentReader = (name: string) => string | undefined;

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; message: string };

export function getAllowedPublishableKeys(readEnvironment: EnvironmentReader): readonly string[] {
  return uniqueNonEmpty([
    ...parseKeyCollection(readEnvironment("SUPABASE_PUBLISHABLE_KEYS")),
    readEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    readEnvironment("SUPABASE_ANON_KEY"),
  ]);
}

export function hasValidPublishableKey(request: Request, readEnvironment: EnvironmentReader): boolean {
  const presentedKey = request.headers.get("apikey")?.trim();
  if (!presentedKey) return false;
  return getAllowedPublishableKeys(readEnvironment).includes(presentedKey);
}

export function getSupabaseSecretKey(readEnvironment: EnvironmentReader): string | undefined {
  return uniqueNonEmpty([
    ...parseKeyCollection(readEnvironment("SUPABASE_SECRET_KEYS")),
    readEnvironment("SUPABASE_SECRET_KEY"),
    readEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  ])[0];
}

export async function readBoundedJsonBody(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, message: "Request body is too large." };
  }

  if (!request.body) return { ok: false, status: 400, message: "A JSON body is required." };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel("request body too large").catch(() => {});
        return { ok: false, status: 413, message: "Request body is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, message: "The JSON body could not be read." };
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false, status: 400, message: "A valid JSON body is required." };
  }
}

function parseKeyCollection(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === "string");
    if (isRecord(parsed)) return Object.values(parsed).filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
  return [];
}

function uniqueNonEmpty(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.flatMap((value) => typeof value === "string" && value.trim() ? [value.trim()] : []))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
