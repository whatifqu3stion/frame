/** Day-one entitlement policy. Existing local records remain readable after expiry. */
import { PRODUCT_LIMITS } from "@/constants/productConfig";
export type PremiumFeature =
  | "library" | "save" | "watchLater" | "resume" | "interests"
  | "creators" | "import" | "sessions" | "discovery"
  | "additionalProfiles" | "managedControls";

export type FrameCapabilities = Readonly<{
  sourceLimit: number;
  profileLimit: number;
}>;

export function capabilitiesFor(isPremium: boolean): FrameCapabilities {
  return isPremium
    ? { sourceLimit: PRODUCT_LIMITS.premiumSourcesPerProfile, profileLimit: PRODUCT_LIMITS.premiumProfilesPerHousehold }
    : { sourceLimit: 5, profileLimit: 1 };
}

export function canUseFeature(feature: PremiumFeature, isPremium: boolean): boolean {
  return isPremium || (feature !== "additionalProfiles" && feature !== "managedControls");
}
