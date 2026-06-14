import type { FollowedChannel } from "@/types";

const API_BASE = "https://www.googleapis.com/youtube/v3";

type SubscriptionItem = {
  snippet: {
    title: string;
    description?: string;
    resourceId: { channelId: string };
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
};

/** Fetches the signed-in account's email using the OAuth access token. */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch (err) {
    console.warn("[google] email fetch failed", err);
    return null;
  }
}

/**
 * Fetches all of the signed-in account's YouTube subscriptions as followed channels.
 * Paginates through results (up to 200 to stay calm and quota-friendly).
 */
export async function fetchSubscriptions(accessToken: string): Promise<FollowedChannel[]> {
  const channels: FollowedChannel[] = [];
  let pageToken: string | undefined;
  const followedAt = Date.now();
  try {
    for (let page = 0; page < 4; page += 1) {
      const url =
        `${API_BASE}/subscriptions?part=snippet&mine=true&maxResults=50&order=alphabetical` +
        (pageToken ? `&pageToken=${pageToken}` : "");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("[google] subscriptions failed", res.status, text.slice(0, 160));
        break;
      }
      const data = (await res.json()) as { items?: SubscriptionItem[]; nextPageToken?: string };
      (data.items ?? []).forEach((item) => {
        const channelId = item.snippet.resourceId?.channelId;
        if (!channelId) return;
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
        });
      });
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  } catch (err) {
    console.warn("[google] subscriptions error", err);
  }
  return channels;
}
