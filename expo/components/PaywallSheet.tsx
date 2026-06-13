import { BlurView } from "expo-blur";
import { Check, X } from "lucide-react-native";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "@/providers/AppProvider";
import { palette, spacing, type } from "@/constants/theme";

const FEATURES = [
  "Save videos to your library, forever",
  "Build custom queues",
  "Resume where you left off",
  "Add channels manually",
  "No subscription. Pay once.",
];

export default function PaywallSheet() {
  const { paywallOpen, setPaywallOpen, markPurchased, prefs } = useApp();

  const onPurchase = async () => {
    // RevenueCat is unavailable in Expo Go. Simulate a one-time purchase locally.
    await markPurchased();
    setPaywallOpen(false);
  };

  const onRestore = async () => {
    await markPurchased();
    setPaywallOpen(false);
  };

  if (!paywallOpen) {
    return null;
  }

  const Backdrop = Platform.OS === "web" ? View : BlurView;
  const backdropProps = Platform.OS === "web" ? {} : { intensity: 40, tint: "light" as const };

  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={() => setPaywallOpen(false)}>
      <Backdrop {...backdropProps} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={[type.caption, { color: palette.accent }]}>Frame · One Time</Text>
            <Pressable onPress={() => setPaywallOpen(false)} hitSlop={12} testID="paywall-close">
              <X size={20} color={palette.ink} />
            </Pressable>
          </View>
          <Text style={styles.title}>A library{"\n"}that stays yours.</Text>
          <Text style={styles.subtitle}>
            Buy Frame once. Keep every saved video, queue, and resume position on your device — quietly, forever.
          </Text>
          <View style={{ marginTop: spacing.xl }}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Check size={16} color={palette.accent} strokeWidth={1.6} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          <View style={styles.priceBlock}>
            <Text style={type.caption}>Lifetime</Text>
            <Text style={styles.price}>$9.99</Text>
          </View>
          <Pressable onPress={onPurchase} style={styles.buyButton} testID="paywall-buy">
            <Text style={styles.buyText}>{prefs.hasPurchased ? "Already Yours" : "Unlock Frame"}</Text>
          </Pressable>
          <Pressable onPress={onRestore} hitSlop={8} style={{ alignSelf: "center", marginTop: spacing.md }}>
            <Text style={[type.caption, { color: palette.inkMuted }]}>Restore Purchase</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(250,249,246,0.72)" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(26,28,26,0.35)" },
  sheet: {
    backgroundColor: palette.wall,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { ...type.title, marginTop: spacing.lg, fontSize: 32, lineHeight: 38 },
  subtitle: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 320 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  featureText: { ...type.body, flex: 1 },
  priceBlock: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  price: { ...type.title, fontSize: 36, marginTop: spacing.xs },
  buyButton: {
    backgroundColor: palette.ink,
    paddingVertical: 18,
    alignItems: "center",
  },
  buyText: {
    color: palette.wall,
    fontFamily: "Georgia",
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
