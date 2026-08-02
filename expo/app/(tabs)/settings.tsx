import { router } from "expo-router";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronRight, FileText, Link2, Lock, LogOut, RefreshCw, RotateCcw, Shield, Trash2, UserCircle2 } from "lucide-react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import ScreenHeader from "@/components/ScreenHeader";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    interests,
    toggleInterest,
    setPaywallOpen,
    isPremium,
    subscriptionStatusLoading,
    subscriptionStatusError,
    wipeAllData,
    googleConfigured,
    googleConnected,
    googleEmail,
    importing,
    signInWithGoogle,
    signOutGoogle,
    refreshSubscriptions,
    followedChannels,
  } = useApp();
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [accountBusy, setAccountBusy] = useState<boolean>(false);

  const onConnect = async () => {
    setAccountBusy(true);
    const result = await signInWithGoogle();
    setAccountBusy(false);
    Alert.alert(result.ok ? "Connected" : "Sign-in", result.message);
  };

  const onRefresh = async () => {
    setAccountBusy(true);
    const result = await refreshSubscriptions();
    setAccountBusy(false);
    Alert.alert(result.ok ? "Synced" : "Sync", result.message);
  };

  const onSignOut = () => {
    Alert.alert("Disconnect Google?", "Frame will revoke Google access. Imported creators stay on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          setAccountBusy(true);
          const result = await signOutGoogle();
          setAccountBusy(false);
          Alert.alert(result.ok ? "Disconnected" : "Couldn't disconnect", result.message);
        },
      },
    ]);
  };

  const onWipe = () => {
    Alert.alert("Delete all data?", "This removes saved videos, queues, resume positions and preferences.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => wipeAllData() },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Settings" title={"Frame\nsettings."} />
      </View>

      <Section label="Account" hint="Optional. Bring in the channels you already follow.">
        {googleConnected ? (
          <>
            <View style={styles.accountRow}>
              <UserCircle2 size={20} color={palette.accent} strokeWidth={1.6} />
              <View style={{ flex: 1 }}>
                <Text style={type.label} numberOfLines={1}>{googleEmail ?? "Google account"}</Text>
                <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>
                  {followedChannels.length} channel{followedChannels.length === 1 ? "" : "s"} on your shelf
                </Text>
              </View>
            </View>
            <View style={styles.accountActions}>
              <Pressable onPress={onRefresh} style={styles.accountBtn} disabled={accountBusy || importing} testID="refresh-subs">
                {accountBusy || importing ? (
                  <ActivityIndicator size="small" color={palette.accent} />
                ) : (
                  <>
                    <RefreshCw size={14} color={palette.accent} strokeWidth={1.8} />
                    <Text style={[type.label, { color: palette.accent }]}>Refresh</Text>
                  </>
                )}
              </Pressable>
              <Pressable onPress={onSignOut} style={styles.accountBtn} testID="sign-out">
                <LogOut size={14} color={palette.inkMuted} strokeWidth={1.8} />
                <Text style={[type.label, { color: palette.inkMuted }]}>Sign out</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable onPress={onConnect} style={styles.cta} disabled={accountBusy || importing} testID="connect-google">
            {accountBusy || importing ? (
              <ActivityIndicator color={palette.wall} />
            ) : (
              <>
                <Text style={styles.ctaTitle}>Sign in with Google</Text>
                <Text style={styles.ctaSub}>
                  {googleConfigured ? "Import the channels you already follow." : "Needs setup — add your keys below to enable."}
                </Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable onPress={() => setAddOpen(true)} style={styles.linkRow} testID="settings-add-channel">
          <Link2 size={14} color={palette.accent} strokeWidth={1.8} />
          <Text style={[type.label, { color: palette.accent }]}>Add a channel by link</Text>
        </Pressable>
      </Section>

      <Section label="Frame Premium">
        {subscriptionStatusLoading ? (
          <View style={styles.simpleRow}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={type.bodySoft}>Checking your subscription…</Text>
          </View>
        ) : isPremium ? (
          <Row
            icon={<Lock size={16} color={palette.accent} strokeWidth={1.6} />}
            title="Premium active"
            subtitle="Saving, Watch Later, resume, and sessions are unlocked."
          />
        ) : (
          <Pressable onPress={() => setPaywallOpen(true)} style={styles.cta} testID="open-premium">
            <Text style={styles.ctaTitle}>Explore Frame Premium</Text>
            <Text style={styles.ctaSub}>See the current plans and localized store prices.</Text>
          </Pressable>
        )}
        {subscriptionStatusError ? (
          <Text style={[type.bodySoft, { color: "#8C3A2E", marginTop: spacing.sm }]}>Couldn’t verify your status. Open Premium to retry or restore.</Text>
        ) : null}
        <Pressable onPress={() => setPaywallOpen(true)} style={styles.linkRow} testID="settings-restore-purchases">
          <RotateCcw size={14} color={palette.inkMuted} strokeWidth={1.6} />
          <Text style={[type.caption, { color: palette.inkMuted }]}>Restore Purchases</Text>
        </Pressable>
      </Section>

      <Section label="Interests" hint="Seeds the Explore tab.">
        <View style={styles.interestsGrid}>
          {INTEREST_LIBRARY.map((i) => {
            const active = interests.some((s) => s.id === i.id);
            return (
              <Pressable
                key={i.id}
                onPress={() => toggleInterest(i.id)}
                style={[styles.interestChip, active && styles.interestChipActive]}
                testID={`interest-${i.id}`}
              >
                <Text style={[styles.interestEmoji, active && { color: palette.wall }]}>{i.emoji}</Text>
                <Text style={[styles.interestLabel, active && { color: palette.wall }]}>{i.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label="Privacy" hint="Clear controls, without behavioral personalization.">
        <View style={styles.simpleRow}>
          <Shield size={16} color={palette.accent} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Local library, disclosed services</Text>
            <Text style={[type.bodySoft, { marginTop: 2, color: palette.inkMuted }]}>
              Your library stays on this device. YouTube handles playback and creator lookups; Google is optional; RevenueCat and your app store verify Premium.
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.push("/privacy")} style={styles.linkRow} accessibilityRole="link">
          <FileText size={14} color={palette.accent} strokeWidth={1.8} />
          <Text style={[type.label, { color: palette.accent }]}>Privacy Policy</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/terms")} style={styles.linkRow} accessibilityRole="link">
          <FileText size={14} color={palette.accent} strokeWidth={1.8} />
          <Text style={[type.label, { color: palette.accent }]}>Terms of Use</Text>
        </Pressable>
      </Section>

      <Section label="Data">
        <Pressable onPress={onWipe} style={styles.dangerRow} testID="wipe-data">
          <Trash2 size={16} color="#8C3A2E" strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: "#8C3A2E" }]}>Delete all on-device data</Text>
            <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>
              Library, follows, queues, resume, preferences, searches, and Google credentials. Store purchase records remain with your store account.
            </Text>
          </View>
          <ChevronRight size={16} color={palette.inkMuted} />
        </Pressable>
      </Section>

      {Platform.OS === "web" ? (
        <Section label="Web preview">
          <Text style={[type.bodySoft, { maxWidth: 340 }]}>This browser version is a temporary preview. Library changes may disappear when the page refreshes, and purchases are mobile-only.</Text>
        </Section>
      ) : null}

      <Section label="About">
        <Text style={[type.bodySoft, { maxWidth: 340 }]}>Frame is an intentional YouTube viewer. It keeps playback user-initiated and stops when your chosen video or finite session ends.</Text>
        <Text style={[type.caption, { color: palette.inkMuted, marginTop: spacing.lg }]}>Version 1.0</Text>
      </Section>

      <AddChannelModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </ScrollView>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.caption}>{label}</Text>
      {hint ? <Text style={[type.bodySoft, { marginTop: spacing.xs }]}>{hint}</Text> : null}
      <View style={{ marginTop: spacing.lg }}>{children}</View>
    </View>
  );
}

function Row({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <View style={styles.simpleRow}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={type.label}>{title}</Text>
        {subtitle ? <Text style={[type.bodySoft, { marginTop: 2, color: palette.inkMuted }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  cta: {
    backgroundColor: palette.ink,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  ctaTitle: { color: palette.wall, fontFamily: "Georgia", fontSize: 22 },
  ctaSub: { color: "rgba(250,249,246,0.7)", fontSize: 13, marginTop: spacing.xs },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.sm },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  accountActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  accountBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: palette.surface,
  },
  interestsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.surface,
  },
  interestChipActive: { backgroundColor: palette.ink },
  interestEmoji: { color: palette.accent, fontSize: 14 },
  interestLabel: { ...type.label, fontSize: 13 },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
});
