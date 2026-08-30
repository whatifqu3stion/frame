import { FOUNDATION_CAPABILITIES } from "../constants/productConfig";
import type { AddChannelResult } from "../types";

export const GOOGLE_SELECTIVE_IMPORT_UNAVAILABLE_MESSAGE = "Google is connected. Selective subscription import is not available yet; no sources were followed.";

/** Automatic following is intentionally disabled until selective import is designed. */
export function isAutomaticGoogleFollowingEnabled(): boolean {
  return FOUNDATION_CAPABILITIES.automaticGoogleFollowing;
}

/** Returns the truthful Round 1 import state without reading subscriptions or following sources. */
export async function getGoogleImportAvailability(): Promise<AddChannelResult> {
  return { ok: false, message: GOOGLE_SELECTIVE_IMPORT_UNAVAILABLE_MESSAGE };
}
