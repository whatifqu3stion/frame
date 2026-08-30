import type { FollowedChannel, ServiceResult } from "@/types";

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

/**
 * Selective subscription import is intentionally unavailable in Round 1.
 * This function never reads subscriptions and therefore can never follow sources automatically.
 */
export async function fetchSubscriptions(_accessToken: string): Promise<ServiceResult<FollowedChannel[]>> {
  return {
    status: "unavailable",
    message: "Selective Google subscription import is not available yet. No sources were followed.",
  };
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
