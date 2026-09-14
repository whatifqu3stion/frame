import { Platform } from "react-native";
import { APP_ENV, FEATURE_FLAGS } from "@/constants/config";
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
  if (Platform.OS === "web") return undefined;
  if (APP_ENV !== "production") return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;

  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: undefined,
  });
}

const revenueCatApiKey = getRevenueCatApiKey();
export const isRevenueCatConfigured = Boolean(revenueCatApiKey);

if (FEATURE_FLAGS.paidAccess && revenueCatApiKey) {
  Purchases.configure({ apiKey: revenueCatApiKey });
}

/** Returns whether the Frame Premium entitlement is currently active. */
export function hasPremiumEntitlement(customerInfo: CustomerInfo | undefined): boolean {
  return Boolean(customerInfo?.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
}

/** Loads the current Frame Premium offering. */
export async function getPremiumOffering(): Promise<PurchasesOffering> {
  if (!FEATURE_FLAGS.paidAccess || !isRevenueCatConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }

  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[PREMIUM_OFFERING_ID] ?? offerings.current;
  if (!offering) {
    throw new Error("Frame Premium is temporarily unavailable.");
  }
  return offering;
}

/** Subscribes to entitlement updates emitted by the RevenueCat SDK. */
export function subscribeToRevenueCatCustomerInfo(
  listener: (customerInfo: CustomerInfo) => void,
): () => void {
  if (!FEATURE_FLAGS.paidAccess || !isRevenueCatConfigured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** Loads the latest subscription entitlement state from RevenueCat. */
export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo> {
  if (!FEATURE_FLAGS.paidAccess || !isRevenueCatConfigured) {
    throw new Error("RevenueCat is not configured for this build.");
  }
  return Purchases.getCustomerInfo();
}

/** Purchases one of the packages in the current Frame Premium offering. */
export async function purchasePremiumPackage(aPackage: PurchasesPackage): Promise<CustomerInfo> {
  if (!FEATURE_FLAGS.paidAccess || Platform.OS === "web" || !isRevenueCatConfigured) {
    throw new Error("Premium purchases are available in the iPhone and Android apps.");
  }
  const result = await Purchases.purchasePackage(aPackage);
  return result.customerInfo;
}

/** Restores purchases associated with the current store account. */
export async function restorePremiumPurchases(): Promise<CustomerInfo> {
  if (!FEATURE_FLAGS.paidAccess || Platform.OS === "web" || !isRevenueCatConfigured) {
    throw new Error("Purchase restoration is available in the iPhone and Android apps.");
  }
  return Purchases.restorePurchases();
}

export type PurchaseErrorDetails = {
  code?: unknown;
  message?: unknown;
  userCancelled?: unknown;
};

function normalizePurchaseErrorCode(code: unknown): string {
  if (typeof code !== "string" && typeof code !== "number") return "";
  return String(code).toUpperCase();
}

/** Maps RevenueCat errors to calm, user-facing purchase feedback. */
export function getPurchaseErrorMessage(error: unknown): string | null {
  const details: PurchaseErrorDetails = typeof error === "object" && error !== null
    ? (error as PurchaseErrorDetails)
    : {};

  if (details.userCancelled === true) return null;

  const code = normalizePurchaseErrorCode(details.code);
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
