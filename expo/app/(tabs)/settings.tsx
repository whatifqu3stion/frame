import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, ChevronRight, Crown, Download, FileText, Lock, LogOut, Moon, RefreshCw, RotateCcw, Shield, ShieldCheck, Sun, Trash2, UserCircle2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "@/components/ScreenHeader";
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
    openPremium,
    isPremium,
    premiumAccessState,
    refreshPremiumAccess,
    wipeAllData,
    googleConfigured,
    googleConnected,
    googleEmail,
    importing,
    signInWithGoogle,
    signOutGoogle,
    followedChannels,
    prefs,
    setTheme,
    setAccent,
    requirePurchase,
  } = useApp();
  const [accountBusy, setAccountBusy] = useState<boolean>(false);

  const onConnect = async () => {
    if (!requirePurchase("import")) return;
    setAccountBusy(true);
    const result = await signInWithGoogle();
    setAccountBusy(false);
    Alert.alert(result.ok ? "Connected" : "Sign-in", result.message);
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

      <Section label="Account" hint="Optional. Connect Google without changing your followed sources.">
        {googleConnected ? (
          <>
            <View style={styles.accountRow}>
              <View style={styles.accountAvatar}>
                <UserCircle2 size={24} color={palette.accent} strokeWidth={1.6} />
                <View style={[styles.accountStatusDot, styles.accountStatusDotConnected]} accessibilityLabel="Signed in with Google" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.label} numberOfLines={1}>{googleEmail ?? "Google account"}</Text>
                <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>Connected · {followedChannels.length} manually selected source{followedChannels.length === 1 ? "" : "s"}</Text>
              </View>
            </View>
            <Text style={styles.accountNotice}>Selective subscription import is unavailable. Frame never follows Google subscriptions automatically.</Text>
            <View style={styles.accountActions}>
              <Pressable onPress={onSignOut} style={styles.accountBtn} testID="sign-out"><LogOut size={14} color={palette.inkMuted} strokeWidth={1.8} /><Text style={[type.label, { color: palette.inkMuted }]}>Sign out</Text></Pressable>
            </View>
          </>
        ) : (
          <View style={styles.guestCard} accessibilityLabel="Guest profile. Not signed in with Google.">
            <View style={styles.guestHeader}>
              <View style={styles.guestAvatar}><UserCircle2 size={30} color={palette.accent} strokeWidth={1.6} /><View style={styles.accountStatusDot} /></View>
              <View style={{ flex: 1 }}>
                <View style={styles.guestNameRow}><Text style={styles.guestName}>Guest profile</Text><View style={styles.guestBadge}><Text style={styles.guestBadgeText}>LOCAL</Text></View></View>
                <Text style={styles.guestSubtitle}>Your viewing stays private and on this device.</Text>
              </View>
            </View>
            <View style={styles.guestDivider} />
            <Text style={styles.guestUnlockLabel}>GOOGLE CONNECTION</Text>
            <View style={styles.guestBenefits}>
              <GuestBenefit icon={<Download size={16} color={palette.accent} strokeWidth={1.8} />} title="Connect your identity" detail="Use your Google email for this optional account connection." styles={styles} />
              <GuestBenefit icon={<RefreshCw size={16} color={palette.accent} strokeWidth={1.8} />} title="No automatic imports" detail="Your Google subscriptions will not be added or followed." styles={styles} />
              <GuestBenefit icon={<ShieldCheck size={16} color={palette.accent} strokeWidth={1.8} />} title="Stay in control" detail="Disconnect anytime without removing manually selected sources." styles={styles} />
            </View>
            <Pressable onPress={onConnect} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]} disabled={accountBusy || importing} accessibilityRole="button" accessibilityHint={googleConfigured ? "Connects your Google identity without following YouTube subscriptions" : "Explains why Google sign-in is unavailable"} testID="connect-google">
              {accountBusy || importing ? <ActivityIndicator color={palette.onDark} /> : <><Text style={styles.googleMark}>G</Text><Text style={styles.googleButtonText}>Connect Google</Text><ChevronRight size={17} color={palette.onDarkSoft} strokeWidth={1.8} /></>}
            </Pressable>
            <Text style={styles.guestFootnote}>{googleConfigured ? "Connecting does not add sources. Use a supported source link to add them manually." : "Account connection isn’t available in this build."}</Text>
          </View>
        )}
      </Section>

      {premiumAccessState !== "misconfigured" ? (
        <View style={styles.premiumSection}>
        {premiumAccessState === "checking" ? (
          <View style={styles.simpleRow}>
            <ActivityIndicator size="small" color={palette.accent} />
            <View style={{ flex: 1 }}>
              <Text style={type.label}>Checking Premium</Text>
              <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>Confirming access with the test subscription service.</Text>
            </View>
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
        ) : premiumAccessState === "inactive" ? (
          <Pressable
            onPress={() => openPremium("library")}
            style={({ pressed }) => [styles.premiumHero, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityHint="Opens beta subscription options and restore"
            testID="open-premium"
          >
            <View style={styles.premiumHeroHeader}>
              <View style={styles.premiumHeroMark}>
                <Crown size={18} color={palette.accentDeep} strokeWidth={1.8} />
              </View>
              <Text style={styles.premiumEyebrow}>Premium inactive</Text>
            </View>
            <Text style={styles.premiumTitle}>Build a library worth returning to.</Text>
            <Text style={styles.premiumSubtitle}>Pasted-link playback stays free. Premium unlocks saves, resume, interests, creators, Google connection, and named sessions.</Text>
            <View style={styles.premiumAction}>
              <Text style={styles.premiumActionText}>View beta plans or restore</Text>
              <ChevronRight size={17} color={palette.onDark} strokeWidth={1.8} />
            </View>
          </Pressable>
        ) : (
          <View style={styles.simpleRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.label}>Premium status unavailable</Text>
              <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>Frame could not verify access. Check your connection and retry.</Text>
            </View>
            <Pressable
              onPress={() => { void refreshPremiumAccess(); }}
              style={styles.statusAction}
              accessibilityRole="button"
            >
              <Text style={[type.label, { color: palette.accent }]}>Try again</Text>
            </Pressable>
          </View>
        )}
        {premiumAccessState === "inactive" || premiumAccessState === "active" ? (
          <Pressable onPress={() => openPremium("library")} style={styles.linkRow} testID="settings-restore-purchases">
            <RotateCcw size={14} color={palette.inkMuted} strokeWidth={1.6} />
            <Text style={[type.caption, { color: palette.inkMuted }]}>Restore purchases</Text>
          </Pressable>
        ) : null}
        </View>
      ) : null}

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

function GuestBenefit({ icon, title, detail, styles }: { icon: React.ReactNode; title: string; detail: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.guestBenefitRow}>
      <View style={styles.guestBenefitIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.guestBenefitTitle}>{title}</Text>
        <Text style={styles.guestBenefitDetail}>{detail}</Text>
      </View>
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
  premiumSection: { paddingHorizontal: spacing.page, paddingTop: spacing.md, paddingBottom: spacing.lg },
  appearanceRow: { flexDirection: "row", gap: spacing.sm },
  appearanceChoice: { minHeight: 56, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
  appearanceChoiceActive: { backgroundColor: palette.activeSoft, borderColor: palette.active },
  appearanceLabel: { ...type.label, color: palette.inkMuted },
  appearanceLabelActive: { color: palette.active },
  accentRow: { flexDirection: "row", gap: spacing.sm },
  accentChoice: { minHeight: 96, flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xs, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
  accentChoiceActive: { backgroundColor: palette.activeSoft, borderColor: palette.active },
  accentSwatch: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  accentLabel: { ...type.label, color: palette.inkMuted, fontSize: 11, textAlign: "center" },
  premiumHero: { backgroundColor: palette.accentDeep, padding: spacing.lg, borderRadius: radii.large },
  premiumHeroHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  premiumHeroMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.onDark, alignItems: "center", justifyContent: "center" },
  premiumEyebrow: { ...type.caption, color: palette.onDarkSoft },
  premiumTitle: { color: palette.onDark, fontFamily: fonts.serif, fontSize: 25, lineHeight: 31, marginTop: spacing.lg, maxWidth: 300 },
  premiumSubtitle: { color: palette.onDarkSoft, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, marginTop: spacing.sm, maxWidth: 320 },
  premiumAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: palette.onDarkSoft },
  premiumActionText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
  premiumActive: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: palette.activeSoft, padding: spacing.lg, borderRadius: radii.card, borderWidth: 1, borderColor: palette.active },
  premiumActiveMark: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.surfaceHigh, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.84 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.sm },
  statusAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceHigh,
  },
  accountStatusDot: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: palette.inkMuted,
    borderWidth: 2,
    borderColor: palette.surface,
  },
  accountStatusDotConnected: { backgroundColor: "#2FA36B" },
  accountNotice: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.md },
  accountActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  guestCard: {
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radii.large,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  guestHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  guestAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.activeSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  guestNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  guestName: { ...type.heading, fontSize: 19, lineHeight: 24 },
  guestBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: palette.surfaceDeep },
  guestBadgeText: { ...type.caption, color: palette.inkMuted, fontSize: 9, lineHeight: 11, letterSpacing: 1 },
  guestSubtitle: { ...type.bodySoft, color: palette.inkMuted, marginTop: 3 },
  guestDivider: { height: 1, backgroundColor: palette.borderSoft, marginVertical: spacing.lg },
  guestUnlockLabel: { ...type.caption, color: palette.accent },
  guestBenefits: { gap: spacing.md, marginTop: spacing.md },
  guestBenefitRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md },
  guestBenefitIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: palette.activeSoft },
  guestBenefitTitle: { ...type.label, color: palette.ink },
  guestBenefitDetail: { ...type.bodySoft, color: palette.inkMuted, marginTop: 1 },
  googleButton: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep },
  googleMark: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 17, width: 22, textAlign: "center" },
  googleButtonText: { flex: 1, color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
  guestFootnote: { ...type.bodySoft, color: palette.inkMuted, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: spacing.sm },
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
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  });
}
