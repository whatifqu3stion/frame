import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bug, Check, ChevronRight, Crown, FileText, Lock, LogOut, Moon, RefreshCw, RotateCcw, Shield, Sun, Trash2, UserCircle2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "@/components/ScreenHeader";
import { IS_CLOSED_BETA, RELEASE_CHANNEL_LABEL } from "@/constants/config";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { accentOptions, createPalette, fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
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
    prefs,
    setTheme,
    setAccent,
  } = useApp();
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
    Alert.alert("Delete all data?", "This removes saved videos, named sessions, resume positions and preferences.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => wipeAllData() },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Settings" title={"Frame\nsettings."} />
      </View>

      <Section label="Frame Premium">
        {subscriptionStatusLoading ? (
          <View style={styles.simpleRow}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={type.bodySoft}>Checking your subscription…</Text>
          </View>
        ) : isPremium ? (
          <View style={styles.premiumActive}>
            <View style={styles.premiumActiveMark}>
              <Lock size={16} color={palette.active} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.label}>Premium active</Text>
              <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>Your complete Frame library is unlocked.</Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setPaywallOpen(true)}
            style={({ pressed }) => [styles.premiumHero, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityHint="Opens subscription options"
            testID="open-premium"
          >
            <View style={styles.premiumHeroHeader}>
              <View style={styles.premiumHeroMark}>
                <Crown size={18} color={palette.accentDeep} strokeWidth={1.8} />
              </View>
              <Text style={styles.premiumEyebrow}>Make Frame yours</Text>
            </View>
            <Text style={styles.premiumTitle}>Build a library worth returning to.</Text>
            <Text style={styles.premiumSubtitle}>Save videos, resume where you stopped, and create intentional sessions.</Text>
            <View style={styles.premiumAction}>
              <Text style={styles.premiumActionText}>View Premium plans</Text>
              <ChevronRight size={17} color={palette.onDark} strokeWidth={1.8} />
            </View>
          </Pressable>
        )}
        {subscriptionStatusError ? (
          <Text style={[type.bodySoft, { color: palette.danger, marginTop: spacing.sm }]}>Couldn’t verify your status. Open Premium to retry or restore.</Text>
        ) : null}
        <Pressable onPress={() => setPaywallOpen(true)} style={styles.linkRow} testID="settings-restore-purchases">
          <RotateCcw size={14} color={palette.inkMuted} strokeWidth={1.6} />
          <Text style={[type.caption, { color: palette.inkMuted }]}>Restore purchases</Text>
        </Pressable>
      </Section>

      <Section label="Appearance" hint="Light by default. The video room always stays dark and focused.">
        <View style={styles.appearanceRow} accessibilityRole="radiogroup">
          <Pressable onPress={() => { void setTheme("warm"); }} style={[styles.appearanceChoice, prefs.theme === "warm" && styles.appearanceChoiceActive]} accessibilityRole="radio" accessibilityState={{ checked: prefs.theme === "warm" }}>
            <Sun size={18} color={prefs.theme === "warm" ? palette.active : palette.inkMuted} strokeWidth={1.7} />
            <Text style={[styles.appearanceLabel, prefs.theme === "warm" && styles.appearanceLabelActive]}>Bone</Text>
          </Pressable>
          <Pressable onPress={() => { void setTheme("ink"); }} style={[styles.appearanceChoice, prefs.theme === "ink" && styles.appearanceChoiceActive]} accessibilityRole="radio" accessibilityState={{ checked: prefs.theme === "ink" }}>
            <Moon size={18} color={prefs.theme === "ink" ? palette.active : palette.inkMuted} strokeWidth={1.7} />
            <Text style={[styles.appearanceLabel, prefs.theme === "ink" && styles.appearanceLabelActive]}>Smoked umber</Text>
          </Pressable>
        </View>
      </Section>

      <Section label="Accent" hint="Used for primary actions, selections, links, and progress.">
        <View style={styles.accentRow} accessibilityRole="radiogroup">
          {accentOptions.map((option) => {
            const isSelected = prefs.accent === option.id;
            const swatch = createPalette(isDark, option.id).accent;
            return (
              <Pressable
                key={option.id}
                onPress={() => { void setAccent(option.id); }}
                style={[styles.accentChoice, isSelected && styles.accentChoiceActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={[styles.accentSwatch, { backgroundColor: swatch }]}>
                  {isSelected ? <Check size={15} color={palette.onDark} strokeWidth={2.4} /> : null}
                </View>
                <Text style={styles.accentLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

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
          <Pressable onPress={onConnect} style={styles.accountConnect} disabled={accountBusy || importing} testID="connect-google">
            {accountBusy || importing ? (
              <ActivityIndicator color={palette.accent} />
            ) : (
              <>
                <UserCircle2 size={20} color={palette.accent} strokeWidth={1.7} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountConnectTitle}>Sign in with Google</Text>
                  <Text style={styles.accountConnectSubtitle}>
                    {googleConfigured ? "Import the channels you already follow." : "Account connection isn’t available in this build."}
                  </Text>
                </View>
                <ChevronRight size={17} color={palette.inkMuted} strokeWidth={1.7} />
              </>
            )}
          </Pressable>
        )}
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
                <Text style={[styles.interestLabel, active && { color: palette.active }]}>{i.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label="Privacy" hint="Clear controls, without behavioral personalization.">
        <View style={styles.simpleRow}>
          <Shield size={16} color={palette.accent} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Private by design</Text>
            <Text style={[type.bodySoft, { marginTop: 2, color: palette.inkMuted }]}>Your library and viewing progress stay on this device. Frame only shares information needed to play videos, connect an account, or manage Premium.</Text>
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
          <Trash2 size={16} color={palette.danger} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: palette.danger }]}>Delete all on-device data</Text>
            <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>
              Library, follows, named sessions, progress, preferences, searches, and connected account credentials. Store purchase records remain with your store account.
            </Text>
          </View>
          <ChevronRight size={16} color={palette.inkMuted} />
        </Pressable>
      </Section>

      <Section label="About">
        <Text style={[type.bodySoft, { maxWidth: 340 }]}>Frame is an intentional YouTube viewer. It keeps playback user-initiated and stops when your chosen video or finite session ends.</Text>
        <Text style={[type.caption, { color: palette.inkMuted, marginTop: spacing.lg }]}>Version 1.0</Text>
        {IS_CLOSED_BETA ? (
          <Pressable onPress={() => router.push("/diagnostics")} style={styles.linkRow} accessibilityRole="button" testID="open-diagnostics">
            <Bug size={14} color={palette.accent} strokeWidth={1.8} />
            <Text style={[type.label, { color: palette.accent }]}>{RELEASE_CHANNEL_LABEL} support</Text>
          </Pressable>
        ) : null}
      </Section>

    </ScrollView>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={styles.section}>
      <Text style={type.caption}>{label}</Text>
      {hint ? <Text style={[type.bodySoft, { marginTop: spacing.xs }]}>{hint}</Text> : null}
      <View style={{ marginTop: spacing.lg }}>{children}</View>
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  section: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  appearanceRow: { flexDirection: "row", gap: spacing.sm },
  appearanceChoice: { minHeight: 56, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
  appearanceChoiceActive: { backgroundColor: palette.activeSoft, borderColor: palette.active },
  appearanceLabel: { ...type.label, color: palette.inkMuted },
  appearanceLabelActive: { color: palette.active },
  accentRow: { flexDirection: "row", gap: spacing.sm },
  accentChoice: { minHeight: 96, flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xs, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
  accentChoiceActive: { backgroundColor: palette.activeSoft, borderColor: palette.active },
  accentSwatch: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  accentLabel: { ...type.label, color: palette.inkMuted, fontSize: 11, textAlign: "center" },
  premiumHero: { backgroundColor: palette.accentDeep, padding: spacing.lg, borderRadius: radii.large },
  premiumHeroHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  premiumHeroMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.onDark, alignItems: "center", justifyContent: "center" },
  premiumEyebrow: { ...type.caption, color: palette.onDarkSoft },
  premiumTitle: { color: palette.onDark, fontFamily: fonts.serif, fontSize: 25, lineHeight: 31, marginTop: spacing.lg, maxWidth: 300 },
  premiumSubtitle: { color: palette.onDarkSoft, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, marginTop: spacing.sm, maxWidth: 320 },
  premiumAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.onDarkSoft },
  premiumActionText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
  premiumActive: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: palette.activeSoft, padding: spacing.lg, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.active },
  premiumActiveMark: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.surfaceHigh, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.84 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.sm },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderSoft,
  },
  accountActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  accountConnect: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: palette.surface, padding: spacing.lg, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
  accountConnectTitle: { ...type.label, color: palette.ink },
  accountConnectSubtitle: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
  accountBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: palette.surface,
    borderRadius: radii.control,
  },
  interestsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.surface,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderSoft,
    minHeight: 44,
  },
  interestChipActive: { backgroundColor: palette.activeSoft, borderColor: palette.active },
  interestLabel: { ...type.label, fontSize: 13 },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderSoft,
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderSoft,
  },
  });
}
