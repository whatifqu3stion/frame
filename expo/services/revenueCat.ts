import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

export const PREMIUM_ENTITLEMENT_ID = "premium";
export const PREMIUM_OFFERING_ID = "frame_premium";
export const REVENUECAT_CUSTOMER_INFO_KEY = ["revenuecat", "customerInfo"] as const;
export const REVENUECAT_OFFERING_KEY = ["revenuecat", "offering"] as const;

function getRevenueCatApiKey(): string | undefined {
  if (__DEV__ || Platform.OS === "web") {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  }

  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
  });
}

const revenueCatApiKey = getRevenueCatApiKey();
export const isRevenueCatConfigured = Boolean(revenueCatApiKey);

if (revenueCatApiKey) {
  Purchases.configure({ apiKey: revenueCatApiKey });
}

/** Returns whether the Frame Premium entitlement is currently active. */
export function hasPremiumEntitlement(customerInfo: CustomerInfo | undefined): boolean {
  return Boolean(customerInfo?.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
}

/** Loads the current Frame Premium offering. */
export async function getPremiumOffering(): Promise<PurchasesOffering> {
  if (!isRevenueCatConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }

  const offerings = await Purchases.getOfferings();
  const offering = offerings.current ?? offerings.all[PREMIUM_OFFERING_ID];
  if (!offering) {
    throw new Error("Frame Premium is temporarily unavailable.");
  }
  return offering;
}

/** Subscribes to entitlement updates emitted by the RevenueCat SDK. */
export function subscribeToRevenueCatCustomerInfo(
  listener: (customerInfo: CustomerInfo) => void,
): () => void {
  if (!isRevenueCatConfigured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** Loads the latest subscription entitlement state from RevenueCat. */
export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo> {
  if (!isRevenueCatConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }
  return Purchases.getCustomerInfo();
}

/** Purchases one of the packages in the current Frame Premium offering. */
export async function purchasePremiumPackage(aPackage: PurchasesPackage): Promise<CustomerInfo> {
  const result = await Purchases.purchasePackage(aPackage);
  return result.customerInfo;
}

/** Restores purchases associated with the current store account. */
export async function restorePremiumPurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export type PurchaseErrorDetails = {
  code?: string;
  message?: string;
  userCancelled?: boolean;
};

/** Maps RevenueCat errors to calm, user-facing purchase feedback. */
export function getPurchaseErrorMessage(error: unknown): string | null {
  const details = typeof error === "object" && error !== null
    ? (error as PurchaseErrorDetails)
    : {};

  if (details.userCancelled) return null;

  const code = details.code?.toUpperCase() ?? "";
  if (code.includes("NETWORK") || code.includes("OFFLINE")) {
    return "You appear to be offline. Reconnect and try again.";
  }
  if (code.includes("PAYMENT_PENDING")) {
    return "Your purchase is pending approval. Premium will activate when the store confirms it.";
  }
  if (code.includes("PRODUCT_NOT_AVAILABLE") || code.includes("STORE_PROBLEM")) {
    return "The store could not complete this purchase right now. Please try again later.";
  }

  return "The purchase could not be completed. Please try again.";
}
