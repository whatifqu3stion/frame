export const SOURCE_METADATA_TTL_MS = 24 * 60 * 60 * 1000;
export const SOURCE_RESOLUTION_MAX_VALUE_LENGTH = 255;

export type SourceResolutionKind = "channelId" | "handle" | "video";
export type SourceResolutionOutcome =
  | "success"
  | "invalid_request"
  | "not_found"
  | "allowance_exhausted"
  | "quota_exhausted"
  | "temporarily_unavailable"
  | "network_error";
export type SourceResolutionProvenance = "cache" | "provider";

export interface SourceResolutionInput {
  kind: SourceResolutionKind;
  value: string;
  installationToken: string;
}

export interface SanitizedSource {
  provider: "youtube";
  providerSourceId: string;
  handle: string | null;
  displayName: string;
  description: string;
  thumbnailUrl: string | null;
}

export interface SanitizedVideo {
  provider: "youtube";
  providerMediaId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isLivestream: boolean;
  isUpcomingPremiere: boolean;
}

export interface SourceResolutionSuccess {
  outcome: "success";
  source: SanitizedSource;
  video?: SanitizedVideo;
  provenance: SourceResolutionProvenance;
}

export type SourceResolutionResponse = SourceResolutionSuccess | {
  outcome: Exclude<SourceResolutionOutcome, "success">;
  message: string;
};

export type CachedResolution = {
  source: SanitizedSource;
  video?: SanitizedVideo;
};

export type ProviderResult<T> =
  | { outcome: "success"; data: T }
  | { outcome: "not_found" | "temporarily_unavailable" | "network_error" };

export interface ProviderChannel extends SanitizedSource {}
export interface ProviderVideo extends SanitizedVideo { providerSourceId: string }

export interface SourceResolutionRepository {
  findFresh(input: Pick<SourceResolutionInput, "kind" | "value">, now: Date): Promise<CachedResolution | null>;
  reserve(installationToken: string, providerCallCount: 1 | 2): Promise<"reserved" | "allowance_exhausted" | "quota_exhausted" | "temporarily_unavailable">;
  upsertSource(source: SanitizedSource, fetchedAt: Date, expiresAt: Date): Promise<SanitizedSource>;
  upsertVideo(video: SanitizedVideo, providerSourceId: string, fetchedAt: Date, expiresAt: Date): Promise<SanitizedVideo>;
  markDefinitiveNotFound(input: Pick<SourceResolutionInput, "kind" | "value">): Promise<void>;
}

export interface YouTubeResolutionProvider {
  getChannel(kind: "channelId" | "handle", value: string): Promise<ProviderResult<ProviderChannel>>;
  getVideo(videoId: string): Promise<ProviderResult<ProviderVideo>>;
}

export function validateSourceResolutionInput(input: unknown): SourceResolutionInput | null {
  if (!isPlainObject(input) || !hasExactKeys(input, ["kind", "value", "installationToken"])) return null;
  if (input.kind !== "channelId" && input.kind !== "handle" && input.kind !== "video") return null;
  if (typeof input.value !== "string" || typeof input.installationToken !== "string") return null;
  if (!/^[0-9a-f]{64}$/.test(input.installationToken)) return null;
  if (input.value.length === 0 || input.value.length > SOURCE_RESOLUTION_MAX_VALUE_LENGTH || input.value !== input.value.trim()) return null;
  if (input.kind === "channelId" && !/^UC[A-Za-z0-9_-]{22}$/.test(input.value)) return null;
  if (input.kind === "handle" && !/^[A-Za-z0-9_.-]{3,30}$/.test(input.value)) return null;
  if (input.kind === "video" && !/^[A-Za-z0-9_-]{11}$/.test(input.value)) return null;
  return { kind: input.kind, value: input.value, installationToken: input.installationToken };
}

/** Resolves only supported stable inputs, consulting fresh shared metadata before reserving quota. */
export async function executeSourceResolution(
  input: unknown,
  repository: SourceResolutionRepository,
  provider: YouTubeResolutionProvider,
  now: Date = new Date(),
): Promise<SourceResolutionResponse> {
  const validated = validateSourceResolutionInput(input);
  if (!validated) return failure("invalid_request", "Use a supported YouTube channel, @handle, or individual video link.");

  try {
    const cached = await repository.findFresh(validated, now);
    if (cached) return { outcome: "success", ...cached, provenance: "cache" };
  } catch {
    return failure("temporarily_unavailable", "Source verification is temporarily unavailable.");
  }

  const providerCallCount: 1 | 2 = validated.kind === "video" ? 2 : 1;
  let reservation: Awaited<ReturnType<SourceResolutionRepository["reserve"]>>;
  try {
    reservation = await repository.reserve(validated.installationToken, providerCallCount);
  } catch {
    return failure("temporarily_unavailable", "Source verification is temporarily unavailable.");
  }
  if (reservation !== "reserved") return failure(reservation, messageFor(reservation));

  try {
    if (validated.kind === "video") {
      const videoResult = await provider.getVideo(validated.value);
      if (videoResult.outcome !== "success") {
        if (videoResult.outcome === "not_found") await repository.markDefinitiveNotFound(validated);
        return failure(videoResult.outcome, messageFor(videoResult.outcome));
      }
      const channelResult = await provider.getChannel("channelId", videoResult.data.providerSourceId);
      if (channelResult.outcome !== "success") {
        if (channelResult.outcome === "not_found") {
          await repository.markDefinitiveNotFound({ kind: "channelId", value: videoResult.data.providerSourceId });
        }
        return failure(channelResult.outcome, messageFor(channelResult.outcome));
      }
      const expiresAt = new Date(now.getTime() + SOURCE_METADATA_TTL_MS);
      const source = await repository.upsertSource(sanitizeSource(channelResult.data), now, expiresAt);
      const video = await repository.upsertVideo(sanitizeVideo(videoResult.data), source.providerSourceId, now, expiresAt);
      return { outcome: "success", source, video, provenance: "provider" };
    }

    const channelResult = await provider.getChannel(validated.kind, validated.value);
    if (channelResult.outcome !== "success") {
      if (channelResult.outcome === "not_found") await repository.markDefinitiveNotFound(validated);
      return failure(channelResult.outcome, messageFor(channelResult.outcome));
    }
    const source = await repository.upsertSource(
      sanitizeSource(channelResult.data),
      now,
      new Date(now.getTime() + SOURCE_METADATA_TTL_MS),
    );
    return { outcome: "success", source, provenance: "provider" };
  } catch {
    return failure("temporarily_unavailable", "Source verification is temporarily unavailable.");
  }
}

export function sanitizeSource(source: SanitizedSource): SanitizedSource {
  return {
    provider: "youtube",
    providerSourceId: bounded(source.providerSourceId, 255),
    handle: source.handle ? bounded(source.handle, 255) : null,
    displayName: bounded(source.displayName, 255),
    description: bounded(source.description, 5000),
    thumbnailUrl: safeHttpsUrl(source.thumbnailUrl),
  };
}

export function sanitizeVideo(video: SanitizedVideo): SanitizedVideo {
  return {
    provider: "youtube",
    providerMediaId: bounded(video.providerMediaId, 255),
    title: bounded(video.title, 500),
    description: bounded(video.description, 5000),
    thumbnailUrl: safeHttpsUrl(video.thumbnailUrl),
    publishedAt: safeIsoDate(video.publishedAt),
    durationSeconds: typeof video.durationSeconds === "number" && Number.isInteger(video.durationSeconds) && video.durationSeconds >= 0
      ? Math.min(video.durationSeconds, 86_400)
      : null,
    isLivestream: video.isLivestream === true,
    isUpcomingPremiere: video.isUpcomingPremiere === true && video.isLivestream !== true,
  };
}

function failure(outcome: Exclude<SourceResolutionOutcome, "success">, message: string): SourceResolutionResponse {
  return { outcome, message };
}

function messageFor(outcome: Exclude<SourceResolutionOutcome, "success" | "invalid_request">): string {
  switch (outcome) {
    case "not_found": return "No supported YouTube source was found for that link.";
    case "allowance_exhausted": return "This installation has reached today’s source-verification allowance.";
    case "quota_exhausted": return "Frame’s shared YouTube allowance is reserved for the rest of today.";
    case "network_error": return "Frame could not reach YouTube. Check your connection and try again.";
    case "temporarily_unavailable": return "Source verification is temporarily unavailable.";
  }
}

function bounded(value: string, maximum: number): string {
  const printable = Array.from(value.trim(), (character: string) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 32 && codePoint !== 127 ? character : " ";
  }).join("");
  return printable.replace(/\s+/g, " ").slice(0, maximum);
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safeIsoDate(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
