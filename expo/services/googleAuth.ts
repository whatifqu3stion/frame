import type { FollowedChannel, ServiceResult } from "@/types";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_SUBSCRIPTION_PAGES = 4;

type SubscriptionItem = {
  snippet: {
    title: string;
    description?: string;
    resourceId: { channelId: string };
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
};

function googleFailure<T>(status: number): ServiceResult<T> {
  if (status === 401) return { status: "unauthorized", message: "Your Google connection expired. Sign in again to continue." };
  if (status === 403) return { status: "quota", message: "Google couldn't complete this request right now. Try again later." };
  return { status: "failed", message: "Google couldn't complete this request. Try again." };
}

/** Fetches the signed-in account's email with explicit failure states. */
export async function fetchGoogleEmail(accessToken: string): Promise<ServiceResult<string>> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return googleFailure(response.status);
    const data = (await response.json()) as { email?: string };
    if (!data.email) return { status: "empty", data: "", message: "Google did not return an email address." };
    return { status: "success", data: data.email };
  } catch (error) {
    console.warn("[google] profile request failed", error instanceof Error ? error.message : "unknown error");
    return { status: "offline", message: "Frame couldn't reach Google. Check your connection and try again." };
  }
}

/** Fetches up to 200 subscriptions and reports truncation or authorization failures honestly. */
export async function fetchSubscriptions(accessToken: string): Promise<ServiceResult<FollowedChannel[]>> {
  const channels: FollowedChannel[] = [];
  let pageToken: string | undefined;
  const followedAt = Date.now();

  try {
    for (let page = 0; page < MAX_SUBSCRIPTION_PAGES; page += 1) {
      const url =
        `${API_BASE}/subscriptions?part=snippet&mine=true&maxResults=50&order=alphabetical` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) return googleFailure(response.status);

      const data = (await response.json()) as { items?: SubscriptionItem[]; nextPageToken?: string };
      for (const item of data.items ?? []) {
        const channelId = item.snippet.resourceId?.channelId;
        if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId ?? "")) continue;
        channels.push({
          id: channelId,
          title: item.snippet.title,
          description: item.snippet.description || undefined,
          thumbnailUrl:
            item.snippet.thumbnails?.high?.url ??
            item.snippet.thumbnails?.medium?.url ??
            item.snippet.thumbnails?.default?.url ??
            "",
          followedAt,
          source: "google",
        });
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  } catch (error) {
    console.warn("[google] subscriptions request failed", error instanceof Error ? error.message : "unknown error");
    return { status: "offline", message: "Frame couldn't reach Google. Check your connection and try again." };
  }

  if (pageToken) {
    return { status: "partial", data: channels, message: `Imported the first ${channels.length} channels. More remain in your Google account.` };
  }
  if (channels.length === 0) return { status: "empty", data: [], message: "No YouTube subscriptions were found for this account." };
  return { status: "success", data: channels };
}

/** Revokes Google authorization before local credentials are removed. */
export async function revokeGoogleAccess(accessToken: string): Promise<ServiceResult<true>> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${encodeURIComponent(accessToken)}`,
    });
    if (!response.ok) return googleFailure(response.status);
    return { status: "success", data: true };
  } catch (error) {
    console.warn("[google] revoke request failed", error instanceof Error ? error.message : "unknown error");
    return { status: "offline", message: "Frame couldn't reach Google to disconnect. Check your connection and try again." };
  }
}
