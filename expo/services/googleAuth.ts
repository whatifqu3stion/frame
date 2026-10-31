import type { FollowedChannel, GoogleSubscriptionPage, ServiceResult } from "@/types";

const SUBSCRIPTIONS_URL = "https://www.googleapis.com/youtube/v3/subscriptions";
const YOUTUBE_SOURCE_ID = /^UC[A-Za-z0-9_-]{22}$/;

function isSafePageToken(value: string): boolean {
  return value.length <= 512 && !/[\u0000-\u001F\u007F]/.test(value);
}

function googleFailure<T>(status: number): ServiceResult<T> {
  if (status === 401) return { status: "unauthorized", message: "Your Google connection expired. Sign in again to continue." };
  if (status === 403) return { status: "unavailable", message: "Google couldn't read these subscriptions. Disconnect and reconnect Frame, then try again." };
  if (status === 429) return { status: "quota", message: "Google couldn't complete this request right now. Try again later." };
  return { status: "failed", message: "Google couldn't complete this request. Try again." };
}

/** Fetches the signed-in account's email with explicit failure states. */
export async function fetchGoogleEmail(accessToken: string): Promise<ServiceResult<string>> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      redirect: "error", credentials: "omit", cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return googleFailure(response.status);
    const data = (await response.json()) as { email?: string };
    if (!data.email) return { status: "empty", data: "", message: "Google did not return an email address." };
    return { status: "success", data: data.email };
  } catch {
    // Transport exceptions can contain credentials; keep diagnostics fixed.
    console.warn("[google] profile request failed");
    return { status: "offline", message: "Frame couldn't reach Google. Check your connection and try again." };
  }
}

type GoogleSubscriptionResponse = {
  nextPageToken?: unknown;
  pageInfo?: { totalResults?: unknown };
  items?: unknown;
};

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function thumbnailUrl(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const thumbnails = value as Record<string, unknown>;
  for (const size of ["high", "medium", "default"]) {
    const entry = thumbnails[size];
    if (!entry || typeof entry !== "object") continue;
    const url = text((entry as Record<string, unknown>).url, 2_048);
    if (url.startsWith("https://")) return url;
  }
  return "";
}

function parseSubscription(value: unknown, fetchedAt: number): FollowedChannel | null {
  if (!value || typeof value !== "object") return null;
  const snippet = (value as Record<string, unknown>).snippet;
  if (!snippet || typeof snippet !== "object") return null;
  const record = snippet as Record<string, unknown>;
  const resourceId = record.resourceId;
  if (!resourceId || typeof resourceId !== "object") return null;
  const id = text((resourceId as Record<string, unknown>).channelId, 64);
  const title = text(record.title, 200);
  if (!YOUTUBE_SOURCE_ID.test(id) || !title) return null;
  return {
    id,
    title,
    description: text(record.description, 2_000),
    thumbnailUrl: thumbnailUrl(record.thumbnails),
    followedAt: fetchedAt,
    source: "google",
    fetchedAt,
  };
}

/** Reads one bounded page only. Calling this never follows a source. */
export async function fetchSubscriptions(accessToken: string, pageToken?: string): Promise<ServiceResult<GoogleSubscriptionPage>> {
  if (!accessToken.trim()) return { status: "unauthorized", message: "Connect Google before importing subscriptions." };
  if (pageToken && !isSafePageToken(pageToken)) {
    return { status: "invalid_request", message: "That subscription page could not be requested." };
  }
  const params = new URLSearchParams({ part: "snippet", mine: "true", maxResults: "50", order: "alphabetical" });
  if (pageToken) params.set("pageToken", pageToken);
  try {
    const response = await fetch(`${SUBSCRIPTIONS_URL}?${params.toString()}`, {
      redirect: "error", credentials: "omit", cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return googleFailure(response.status);
    const data = (await response.json()) as GoogleSubscriptionResponse;
    if (!Array.isArray(data.items)) return { status: "failed", message: "Google returned an unexpected subscription response." };
    const fetchedAt = Date.now();
    const parsed = data.items.map((item) => parseSubscription(item, fetchedAt)).filter((item): item is FollowedChannel => Boolean(item));
    const unique = [...new Map(parsed.map((item) => [item.id, item])).values()];
    const total = data.pageInfo?.totalResults;
    const page: GoogleSubscriptionPage = {
      items: unique,
      nextPageToken: typeof data.nextPageToken === "string" && isSafePageToken(data.nextPageToken) ? data.nextPageToken : null,
      totalResults: typeof total === "number" && Number.isInteger(total) && total >= 0 ? total : null,
    };
    if (unique.length === 0) return { status: "empty", data: page, message: "No subscriptions were found on this page." };
    if (unique.length !== data.items.length) return { status: "partial", data: page, message: "Some subscriptions could not be read and were left out." };
    return { status: "success", data: page };
  } catch {
    // Transport exceptions can contain credentials; keep diagnostics fixed.
    console.warn("[google] subscription request failed");
    return { status: "offline", message: "Frame couldn't reach Google. Check your connection and try again." };
  }
}

/** Revokes Google authorization before local credentials are removed. */
export async function revokeGoogleAccess(accessToken: string): Promise<ServiceResult<true>> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      redirect: "error", credentials: "omit", cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${encodeURIComponent(accessToken)}`,
    });
    if (!response.ok) return googleFailure(response.status);
    return { status: "success", data: true };
  } catch {
    // Transport exceptions can contain credentials; keep diagnostics fixed.
    console.warn("[google] revoke request failed");
    return { status: "offline", message: "Frame couldn't reach Google to disconnect. Check your connection and try again." };
  }
}
