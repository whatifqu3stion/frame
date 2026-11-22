import { STABLE_INTEREST_IDS } from "./weekly-picks.ts";

export const MAX_REVIEWED_PUBLICATION_BYTES = 65_536;
export const MAX_PUBLICATIONS_PER_BATCH = STABLE_INTEREST_IDS.length;
export const MAX_PICKS_PER_PUBLICATION = 3;

export interface ReviewedWeeklyPickBatch {
  periodStart: string;
  periodEnd: string;
  publications: readonly ReviewedWeeklyPickPublication[];
}

export interface ReviewedWeeklyPickPublication {
  interestId: string;
  picks: readonly ReviewedWeeklyPick[];
}

export interface ReviewedWeeklyPick {
  sourceId: string;
  featuredMediaItemId: string;
  reason: string | null;
}

const stableInterests = new Set<string>(STABLE_INTEREST_IDS);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const projectRefPattern = /^[a-z0-9-]{3,64}$/;
const urlPattern = /(?:https?:\/\/|www\.)/i;

/** Strictly parses the exact, human-reviewed payload accepted by the publisher. */
export function parseReviewedWeeklyPickBatch(
  value: unknown,
): ReviewedWeeklyPickBatch {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["periodStart", "periodEnd", "publications"])
  ) {
    throw new Error(
      "The reviewed file must contain only periodStart, periodEnd, and publications.",
    );
  }
  if (
    typeof value.periodStart !== "string" || typeof value.periodEnd !== "string"
  ) {
    throw new Error("Publication dates must be text in YYYY-MM-DD format.");
  }
  const expectedEnd = weeklyPeriodEnd(value.periodStart);
  if (value.periodEnd !== expectedEnd) {
    throw new Error(`Period end must be ${expectedEnd}.`);
  }
  if (
    !Array.isArray(value.publications) || value.publications.length < 1 ||
    value.publications.length > MAX_PUBLICATIONS_PER_BATCH
  ) {
    throw new Error(
      `A reviewed batch must contain between 1 and ${MAX_PUBLICATIONS_PER_BATCH} interests.`,
    );
  }

  const seenInterests = new Set<string>();
  const publications = value.publications.map(
    (publication, publicationIndex): ReviewedWeeklyPickPublication => {
      if (
        !isRecord(publication) ||
        !hasExactKeys(publication, ["interestId", "picks"])
      ) {
        throw new Error(
          `Publication ${publicationIndex + 1} contains unsupported fields.`,
        );
      }
      if (
        typeof publication.interestId !== "string" ||
        !stableInterests.has(publication.interestId)
      ) {
        throw new Error(
          `Publication ${
            publicationIndex + 1
          } must use a canonical Frame interest.`,
        );
      }
      if (seenInterests.has(publication.interestId)) {
        throw new Error(
          `Interest ${publication.interestId} appears more than once.`,
        );
      }
      seenInterests.add(publication.interestId);
      if (
        !Array.isArray(publication.picks) || publication.picks.length < 1 ||
        publication.picks.length > MAX_PICKS_PER_PUBLICATION
      ) {
        throw new Error(
          `Interest ${publication.interestId} must contain between 1 and ${MAX_PICKS_PER_PUBLICATION} picks.`,
        );
      }

      const seenSources = new Set<string>();
      const picks = publication.picks.map(
        (pick, pickIndex): ReviewedWeeklyPick => {
          if (
            !isRecord(pick) ||
            !hasExactKeys(pick, ["sourceId", "featuredMediaItemId", "reason"])
          ) {
            throw new Error(
              `Pick ${
                pickIndex + 1
              } for ${publication.interestId} contains unsupported fields.`,
            );
          }
          if (!isUuid(pick.sourceId) || !isUuid(pick.featuredMediaItemId)) {
            throw new Error(
              `Pick ${
                pickIndex + 1
              } for ${publication.interestId} has an invalid identifier.`,
            );
          }
          if (seenSources.has(pick.sourceId)) {
            throw new Error(
              `A source appears more than once for ${publication.interestId}.`,
            );
          }
          seenSources.add(pick.sourceId);
          if (pick.reason !== null && typeof pick.reason !== "string") {
            throw new Error(
              `Pick ${
                pickIndex + 1
              } for ${publication.interestId} has an invalid reason.`,
            );
          }
          const reason = pick.reason === null
            ? null
            : pick.reason.trim().replace(/\s+/g, " ");
          if (
            reason !== null &&
            (reason.length < 1 || reason.length > 240 ||
              urlPattern.test(reason) || hasControlCharacters(reason))
          ) {
            throw new Error(
              `Pick ${
                pickIndex + 1
              } for ${publication.interestId} has an unsafe or invalid reason.`,
            );
          }
          return {
            sourceId: pick.sourceId.toLowerCase(),
            featuredMediaItemId: pick.featuredMediaItemId.toLowerCase(),
            reason,
          };
        },
      );
      return { interestId: publication.interestId, picks };
    },
  );

  return {
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
    publications,
  };
}

/** Binds the second-step confirmation to the exact project and normalized payload. */
export async function buildPublicationConfirmation(
  projectRef: string,
  batch: ReviewedWeeklyPickBatch,
): Promise<string> {
  validateProjectRef(projectRef);
  const bytes = new TextEncoder().encode(JSON.stringify({ projectRef, batch }));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const fingerprint = [...digest].map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("").slice(0, 16);
  return `publish:${projectRef}:${batch.periodStart}:${fingerprint}`;
}

export function assertSupabaseProject(
  urlText: string,
  projectRef: string,
): URL {
  validateProjectRef(projectRef);
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    throw new Error("SUPABASE_URL is invalid.");
  }
  if (projectRef === "local") {
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
      throw new Error(
        "The local project reference requires a local Supabase URL.",
      );
    }
    return url;
  }
  if (
    url.protocol !== "https:" || url.hostname !== `${projectRef}.supabase.co`
  ) {
    throw new Error(
      "SUPABASE_URL does not match the explicitly reviewed project reference.",
    );
  }
  return url;
}

function weeklyPeriodEnd(periodStart: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
    throw new Error("Period start must use YYYY-MM-DD.");
  }
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  if (
    !Number.isFinite(start.getTime()) ||
    start.toISOString().slice(0, 10) !== periodStart || start.getUTCDay() !== 1
  ) {
    throw new Error("Period start must be a valid Monday.");
  }
  start.setUTCDate(start.getUTCDate() + 6);
  return start.toISOString().slice(0, 10);
}

function validateProjectRef(projectRef: string): void {
  if (projectRef !== "local" && !projectRefPattern.test(projectRef)) {
    throw new Error("Pass the exact Supabase project reference.");
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length &&
    [...expected].sort().every((key, index) => keys[index] === key);
}
