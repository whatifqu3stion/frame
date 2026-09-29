import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useApp } from "@/providers/AppProvider";
import { IS_CLOSED_BETA } from "@/constants/config";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import {
  getPremiumOffering,
  getPurchaseErrorMessage,
  hasPremiumEntitlement,
  isRevenueCatConfigured,
  purchasePremiumPackage,
  REVENUECAT_CUSTOMER_INFO_KEY,
  REVENUECAT_OFFERING_KEY,
  restorePremiumPurchases,
} from "@/services/revenueCat";

const FEATURES: string[] = [
  "Save videos and build a personal shelf",
  "Resume exactly where you stopped",
  "Create intentional one-to-three-video sessions",
  "Follow trusted sources and review weekly suggestions",
];

function packageLabel(aPackage: PurchasesPackage): string {
  return aPackage.identifier === "$rc_annual" ? "Yearly" : "Monthly";
}

function packageDetail(aPackage: PurchasesPackage): string {
  if (aPackage.identifier === "$rc_annual") {
    return `${aPackage.product.priceString} per year`;
  }
  return `${aPackage.product.priceString} per month`;
}

export default function PaywallSheet() {
  const reducedMotion = useReducedMotion();
  const { paywallOpen, paywallMessage, setPaywallOpen, isPremium } = useApp();
  const { isDark, palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedIdentifier, setSelectedIdentifier] = useState<string>("$rc_annual");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsSuccess, setFeedbackIsSuccess] = useState<boolean>(false);

  const offeringQuery = useQuery({
    queryKey: REVENUECAT_OFFERING_KEY,
    queryFn: getPremiumOffering,
    enabled: paywallOpen && isRevenueCatConfigured && Platform.OS !== "web",
    retry: 1,
  });

  const packages = useMemo<PurchasesPackage[]>(() => {
    const available = offeringQuery.data?.availablePackages ?? [];
    return available
      .filter((item) => item.identifier === "$rc_annual" || item.identifier === "$rc_monthly")
      .sort((a, b) => (a.identifier === "$rc_annual" ? -1 : b.identifier === "$rc_annual" ? 1 : 0));
  }, [offeringQuery.data]);

  useEffect(() => {
    if (packages.length === 0) return;
    const stillAvailable = packages.some((item) => item.identifier === selectedIdentifier);
    if (!stillAvailable) setSelectedIdentifier(packages[0].identifier);
  }, [packages, selectedIdentifier]);

  useEffect(() => {
    if (paywallOpen) {
      setFeedback(null);
      setFeedbackIsSuccess(false);
    }
  }, [paywallOpen]);

  const purchaseMutation = useMutation({
    mutationFn: purchasePremiumPackage,
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(REVENUECAT_CUSTOMER_INFO_KEY, customerInfo);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restorePremiumPurchases,
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(REVENUECAT_CUSTOMER_INFO_KEY, customerInfo);
    },
  });

  const selectedPackage = packages.find((item) => item.identifier === selectedIdentifier) ?? null;
  const isBusy = purchaseMutation.isPending || restoreMutation.isPending;
  const isWebPreview = Platform.OS === "web";

  const onPurchase = async (): Promise<void> => {
    if (isWebPreview) {
      setFeedbackIsSuccess(false);
      setFeedback("Premium purchases are available in the iPhone and Android apps.");
      return;
    }
    if (isPremium) {
      setPaywallOpen(false);
      return;
    }
    if (!selectedPackage) {
      setFeedbackIsSuccess(false);
      setFeedback("Subscription options are unavailable right now. Please try again.");
      return;
    }

    setFeedback(null);
    setFeedbackIsSuccess(false);
    try {
      const customerInfo = await purchaseMutation.mutateAsync(selectedPackage);
      if (hasPremiumEntitlement(customerInfo)) {
        setFeedbackIsSuccess(true);
        setFeedback("Premium is active. Your library and planning tools are unlocked.");
      } else {
        setFeedback("Your purchase is pending. Premium will activate when the store confirms it.");
      }
    } catch (error) {
      const message = getPurchaseErrorMessage(error);
      setFeedback(message ?? "Purchase cancelled. Nothing was charged.");
    }
  };

  const onRestore = async (): Promise<void> => {
    if (isWebPreview) {
      setFeedbackIsSuccess(false);
      setFeedback("Purchase restoration is available in the iPhone and Android apps.");
      return;
    }
    setFeedback(null);
    setFeedbackIsSuccess(false);
    try {
      const customerInfo = await restoreMutation.mutateAsync();
      if (hasPremiumEntitlement(customerInfo)) {
        setFeedbackIsSuccess(true);
        setFeedback("Restored successfully. Premium is active for this store account.");
      } else {
        setFeedback("Restore finished, but no active Frame Premium subscription was found for this store account.");
      }
    } catch (error) {
      setFeedback(getPurchaseErrorMessage(error) ?? "Restore cancelled. No changes were made.");
    }
  };

  if (!paywallOpen) return null;

  const Backdrop = Platform.OS === "web" ? View : BlurView;
  const backdropProps = Platform.OS === "web" ? {} : { intensity: 40, tint: isDark ? "dark" as const : "light" as const };
  const plansUnavailable = isWebPreview || !isRevenueCatConfigured || offeringQuery.isError || (!offeringQuery.isLoading && packages.length === 0);

  return (
    <Modal visible animationType={reducedMotion ? "none" : "slide"} transparent statusBarTranslucent onRequestClose={() => setPaywallOpen(false)}>
      <Backdrop {...backdropProps} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.headerRow}>
              <Text style={[type.caption, { color: palette.accent }]}>{IS_CLOSED_BETA ? "Frame Premium · beta test" : "Frame Premium"}</Text>
              <Pressable
                onPress={() => setPaywallOpen(false)}
                hitSlop={12}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close Frame Premium"
                testID="paywall-close"
              >
                <X size={20} color={palette.ink} />
              </Pressable>
            </View>

            <Text style={styles.title}>Keep only what{"\n"}matters to you.</Text>
            <Text style={styles.subtitle}>{paywallMessage}</Text>
            <Text style={styles.freeNote}>Watching a valid pasted link is always free. Premium covers every library, organization, creator, and discovery feature.</Text>

            <View style={styles.features}>
              {FEATURES.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Check size={16} color={palette.accent} strokeWidth={1.8} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={styles.plans}>
              {offeringQuery.isLoading ? (
                <View style={styles.loadingPlans}>
                  <ActivityIndicator color={palette.accent} />
                  <Text style={type.bodySoft}>Loading store prices…</Text>
                </View>
              ) : (
                packages.map((aPackage) => {
                  const isSelected = aPackage.identifier === selectedIdentifier;
                  return (
                    <Pressable
                      key={aPackage.identifier}
                      onPress={() => setSelectedIdentifier(aPackage.identifier)}
                      disabled={isBusy}
                      style={[styles.planCard, isSelected && styles.planCardSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      testID={`paywall-plan-${aPackage.identifier}`}
                    >
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.planTitleRow}>
                          <Text style={styles.planTitle}>{packageLabel(aPackage)}</Text>
                        </View>
                        <Text style={styles.planDetail}>{packageDetail(aPackage)}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {plansUnavailable ? (
              <View><Text style={styles.feedback}>{isWebPreview ? "Purchases are available in the iPhone and Android apps." : !isRevenueCatConfigured ? "Purchases aren’t available in this build." : "Store prices couldn’t load. Check your connection and try again."}</Text>{!isWebPreview && isRevenueCatConfigured ? <Pressable onPress={() => { void offeringQuery.refetch(); }} disabled={offeringQuery.isFetching} accessibilityRole="button" style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}><Text style={[type.label, { color: palette.active }]}>{offeringQuery.isFetching ? "Loading…" : "Retry store prices"}</Text></Pressable> : null}</View>
            ) : null}
            {feedback ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, feedbackIsSuccess && styles.feedbackSuccess]}>{feedback}</Text> : null}

            <Pressable
              onPress={onPurchase}
              disabled={isBusy || plansUnavailable}
              style={({ pressed }) => [
                styles.buyButton,
                (isBusy || plansUnavailable) && styles.buttonDisabled,
                pressed && !isBusy && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              testID="paywall-buy"
            >
              {purchaseMutation.isPending ? (
                <ActivityIndicator color={palette.onDark} />
              ) : (
                <Text style={styles.buyText}>{isPremium ? "Premium is active" : "Continue with Premium"}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onRestore}
              disabled={isBusy || isWebPreview || !isRevenueCatConfigured}
              hitSlop={8}
              style={styles.restoreButton}
              accessibilityRole="button"
              testID="paywall-restore"
            >
              {restoreMutation.isPending ? (
                <ActivityIndicator size="small" color={palette.inkMuted} />
              ) : (
                <Text style={[type.caption, { color: palette.inkMuted }]}>Restore Purchases</Text>
              )}
            </Pressable>

            <View style={styles.legalLinks}>
              <Pressable
                onPress={() => {
                  setPaywallOpen(false);
                  router.push("/privacy");
                }}
                accessibilityRole="link"
              >
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </Pressable>
              <Text style={styles.legalDivider}>·</Text>
              <Pressable
                onPress={() => {
                  setPaywallOpen(false);
                  router.push("/terms");
                }}
                accessibilityRole="link"
              >
                <Text style={styles.legalLink}>Terms of Use</Text>
              </Pressable>
            </View>
            <Text style={styles.legal}>
              Payment is charged to your store account. Your subscription renews automatically unless cancelled before the current period ends. Manage or cancel it in your App Store or Play Store settings.
            </Text>
            {Platform.OS === "web" ? <Text style={styles.previewNotice}>Web is a preview. Premium purchases are available in the iPhone and Android apps.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  backdrop: { backgroundColor: palette.borderSoft },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay },
  sheet: {
    maxHeight: "94%",
    backgroundColor: palette.wall,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radii.large,
    borderTopRightRadius: radii.large,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -12 },
  title: { ...type.title, marginTop: spacing.md, fontSize: 32, lineHeight: 38 },
  subtitle: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 350 },
  freeNote: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.sm, maxWidth: 360 },
  features: { marginTop: spacing.lg },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  featureText: { ...type.body, flex: 1 },
  plans: { marginTop: spacing.md, gap: spacing.sm },
  loadingPlans: {
    minHeight: 112,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radii.card,
  },
  planCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radii.card,
  },
  planCardSelected: { borderColor: palette.active, backgroundColor: palette.activeSoft },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.inkMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: palette.active },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.active },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  planTitle: { ...type.heading, fontSize: 18, lineHeight: 23 },
  planDetail: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
  feedback: { ...type.bodySoft, color: palette.danger, marginTop: spacing.md, textAlign: "center" },
  feedbackSuccess: { color: palette.success },
  buyButton: {
    minHeight: 56,
    backgroundColor: palette.accentDeep,
    marginTop: spacing.lg,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.control,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82 },
  buyText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 16, letterSpacing: 0.1 },
  restoreButton: { minHeight: 44, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
  legalLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  legalLink: { ...type.caption, color: palette.accent, textDecorationLine: "underline" },
  legalDivider: { ...type.caption, color: palette.inkMuted },
  legal: { ...type.bodySoft, color: palette.inkMuted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: spacing.sm },
  previewNotice: { ...type.bodySoft, color: palette.inkMuted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: spacing.sm },
  });
}

