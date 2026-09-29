import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, ChevronRight, Crown, FileText, Lock, LogOut, Moon, RotateCcw, Shield, Sun, Trash2, UserCircle2, UsersRound } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "@/components/ScreenHeader";
import ProfileControlsModal from "@/components/ProfileControlsModal";
import FullResetModal from "@/components/FullResetModal";
import { FEATURE_FLAGS, IS_CLOSED_BETA } from "@/constants/config";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { ONBOARDING_INTEREST_MAX } from "@/constants/productConfig";
import { accentOptions, createPalette, fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { isInterestOptionDisabled } from "@/domain/interests";
import { useApp } from "@/providers/AppProvider";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const {
    interests, toggleInterest, openPremium, isPremium, premiumAccessState, refreshPremiumAccess,
    googleConfigured, googleConnected, googleEmail, importing, signInWithGoogle,
    signOutGoogle, prefs, setTheme, setAccent, activeProfile, profiles,
    requestOwnerAuthorization,
  } = useApp();
  const accountLock = useRef(false);
  const [accountBusy, setAccountBusy] = useState<boolean>(false);
  const [profileControlsOpen, setProfileControlsOpen] = useState<boolean>(false);
  const [fullResetOpen, setFullResetOpen] = useState<boolean>(false);

  const onConnect = async (): Promise<void> => {
    if (accountLock.current) return;
    accountLock.current = true; setAccountBusy(true);
    try {
      const result = await signInWithGoogle();
      if (result.ok) router.push("/google-import");
      else Alert.alert("Sign-in", result.message);
    } catch { Alert.alert("Sign-in", "Google couldn’t connect. Try again when you’re ready."); }
    finally { accountLock.current = false; setAccountBusy(false); }
  };
  const onSignOut = (): void => {
    Alert.alert("Disconnect Google?", "Frame will revoke Google access. Manually followed sources stay on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => {
        if (accountLock.current) return;
        accountLock.current = true; setAccountBusy(true);
        try {
          const result = await signOutGoogle();
          Alert.alert(result.ok ? "Disconnected" : "Couldn't disconnect", result.message);
        } catch { Alert.alert("Couldn’t disconnect", "Check the connection status and try again."); }
        finally { accountLock.current = false; setAccountBusy(false); }
      } },
    ]);
  };
  const onWipe = async (): Promise<void> => {
    if (await requestOwnerAuthorization()) setFullResetOpen(true);
  };
  const openProfileControls = async (): Promise<void> => {
    const authorized = await requestOwnerAuthorization();
    if (authorized) setProfileControlsOpen(true);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 104 }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><ScreenHeader eyebrow="Settings" title={"Frame\nsettings."} /></View>

      <Section label="Profile" hint="Each profile has its own sources, saved videos, sessions, and preferences on this device.">
        <View style={styles.profileCard} accessible accessibilityLabel={`${activeProfile?.name ?? "Owner"} profile`}>
          <View style={styles.profileAvatar}><UserCircle2 size={25} color={palette.active} strokeWidth={1.6} /></View>
          <View style={styles.flex}><Text style={styles.profileName}>{activeProfile?.name ?? "Owner"}</Text><Text style={styles.supporting}>{activeProfile?.role === "owner" ? "Owner" : activeProfile?.role === "managed" ? "Managed" : "Standard"} · {profiles.length} local {profiles.length === 1 ? "profile" : "profiles"}</Text></View>
        </View>
        <Pressable onPress={() => { void openProfileControls(); }} style={({ pressed }) => [styles.protectedRow, pressed && styles.pressed]} accessibilityRole="button" testID="open-profile-controls">
          <View style={styles.protectedIcon}><UsersRound size={19} color={palette.active} /></View><View style={styles.flex}><Text style={type.label}>Profiles & boundaries</Text><Text style={styles.supporting}>Manage profiles, viewing time, schedules, content approvals, and the Owner PIN.</Text></View><ChevronRight size={17} color={palette.inkMuted} />
        </Pressable>
        {googleConnected ? (
          <View style={styles.accountBlock}>
            <Text style={type.label} numberOfLines={1}>{googleEmail ?? "Google connected"}</Text>
            <Text style={styles.supporting}>Choose which YouTube subscriptions to follow in Frame.</Text>
            <Pressable onPress={() => router.push("/google-import")} style={styles.inlineAction} accessibilityRole="button" testID="settings-google-import">
              <Text style={styles.linkText}>Choose subscriptions</Text><ChevronRight size={15} color={palette.active} />
            </Pressable>
            <Pressable onPress={onSignOut} style={styles.inlineAction} disabled={accountBusy} accessibilityRole="button" testID="sign-out-google">
              {accountBusy ? <ActivityIndicator size="small" color={palette.inkMuted} /> : <LogOut size={15} color={palette.inkMuted} />}
              <Text style={styles.inlineActionText}>Disconnect Google</Text>
            </Pressable>
          </View>
        ) : googleConfigured ? (
          <Pressable onPress={() => { void onConnect(); }} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]} disabled={accountBusy || importing} accessibilityRole="button" testID="connect-google">
            {accountBusy || importing ? <ActivityIndicator color={palette.onDark} /> : <><Text style={styles.googleMark}>G</Text><Text style={styles.googleText}>Connect Google</Text><ChevronRight size={17} color={palette.onDarkSoft} /></>}
          </Pressable>
        ) : <Text style={styles.infoText}>Google connection isn’t available in this version. You can still add sources with a link or @handle.</Text>}
      </Section>

      <Section label={`Interests · ${interests.length} of ${ONBOARDING_INTEREST_MAX}`} hint="Choose up to five interests for weekly source suggestions. This is optional.">
        <View style={styles.chipGrid} accessibilityRole="list">
          {INTEREST_LIBRARY.map((interest) => {
            const selectedIds = interests.map((item) => item.id);
            const selected = selectedIds.includes(interest.id);
            const unavailable = isInterestOptionDisabled(selectedIds, interest.id, ONBOARDING_INTEREST_MAX);
            return (
              <Pressable key={interest.id} onPress={() => toggleInterest(interest.id)} disabled={unavailable} style={[styles.chip, selected && styles.chipActive, unavailable && styles.chipDisabled]} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: unavailable }} accessibilityHint={unavailable ? "Remove a selected interest before choosing this one." : undefined} testID={`interest-${interest.id}`}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{interest.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label="Appearance" hint="The video player always uses a dark background.">
        <View style={styles.choiceRow} accessibilityRole="radiogroup">
          <AppearanceChoice label="Light · Bone" selected={prefs.theme === "warm"} onPress={() => { void setTheme("warm"); }} icon={<Sun size={18} color={prefs.theme === "warm" ? palette.active : palette.inkMuted} />} styles={styles} />
          <AppearanceChoice label="Dark · Smoked umber" selected={prefs.theme === "ink"} onPress={() => { void setTheme("ink"); }} icon={<Moon size={18} color={prefs.theme === "ink" ? palette.active : palette.inkMuted} />} styles={styles} />
        </View>
        <View style={styles.accentRow} accessibilityRole="radiogroup">
          {accentOptions.map((option) => {
            const selected = prefs.accent === option.id;
            const swatch = createPalette(isDark, option.id).accent;
            return (
              <Pressable key={option.id} onPress={() => { void setAccent(option.id); }} style={[styles.accentChoice, selected && styles.accentChoiceActive]} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${option.label} accent`}>
                <View style={[styles.swatch, { backgroundColor: swatch }]}>{selected ? <Check size={14} color={palette.onAccent} strokeWidth={2.4} /> : null}</View>
                <Text style={styles.accentText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label="Focus and boundaries">
        <View style={styles.infoCard} accessible>
          <Lock size={18} color={palette.active} strokeWidth={1.7} />
          <View style={styles.flex}><Text style={type.label}>A clear place to stop</Text><Text style={styles.supporting}>Today offers a limited selection. In a session, you choose when to play the next video.</Text></View>
        </View>
      </Section>

      {FEATURE_FLAGS.paidAccess ? <Section label="Premium">
        {premiumAccessState === "checking" ? <StatusRow title="Checking Premium" body="Confirming your access." loading />
          : isPremium ? <StatusRow title="Premium active" body="Your complete Frame library is unlocked." />
          : premiumAccessState === "inactive" ? (
            <Pressable onPress={() => openPremium("library")} style={({ pressed }) => [styles.premiumCard, pressed && styles.pressed]} accessibilityRole="button" testID="open-premium">
              <Crown size={19} color={palette.onAccent} /><View style={styles.flex}><Text style={styles.premiumTitle}>Frame Premium</Text><Text style={styles.premiumBody}>View plans or restore your purchase.</Text></View><ChevronRight size={17} color={palette.onDarkSoft} />
            </Pressable>
          ) : premiumAccessState === "unavailable" ? (
            <View><StatusRow title="Premium status unavailable" body="Frame could not verify access." /><Pressable onPress={() => { void refreshPremiumAccess(); }} style={styles.inlineAction}><Text style={styles.linkText}>Try again</Text></Pressable></View>
          ) : <Text style={styles.infoText}>Premium is not configured for this build.</Text>}
        {premiumAccessState === "inactive" || premiumAccessState === "active" ? (
          <Pressable onPress={() => openPremium("library")} style={styles.inlineAction} accessibilityRole="button" testID="settings-restore-purchases"><RotateCcw size={15} color={palette.inkMuted} /><Text style={styles.inlineActionText}>Restore purchases</Text></Pressable>
        ) : null}
      </Section> : null}

      <Section label="Privacy and data" hint="Manage what Frame keeps on this device.">
        <View style={styles.infoCard}><Shield size={18} color={palette.active} /><View style={styles.flex}><Text style={type.label}>Private by design</Text><Text style={styles.supporting}>Your library and preferences are stored on this device.</Text></View></View>
        <Pressable onPress={() => router.push("/privacy")} style={styles.linkRow} accessibilityRole="link"><FileText size={15} color={palette.accent} /><Text style={styles.linkText}>Privacy Policy</Text></Pressable>
        <Pressable onPress={() => router.push("/terms")} style={styles.linkRow} accessibilityRole="link"><FileText size={15} color={palette.accent} /><Text style={styles.linkText}>Terms of Use</Text></Pressable>
        <Pressable onPress={() => { void onWipe(); }} style={styles.dangerRow} accessibilityRole="button" testID="wipe-data"><Trash2 size={17} color={palette.danger} /><View style={styles.flex}><Text style={styles.dangerText}>Erase all Frame data and start over</Text><Text style={styles.supporting}>Deletes every local profile, PIN, playback and content boundary, usage record, request, and library item.</Text></View></Pressable>
      </Section>

      <Section label="About"><Text style={styles.infoText}>Frame brings together the YouTube sources you choose, with space to watch at your own pace.</Text><Text style={styles.version}>Version 1.0</Text></Section>
      {IS_CLOSED_BETA ? <Section label="Beta support"><Pressable onPress={() => router.push("/diagnostics")} style={styles.linkRow} accessibilityRole="button" testID="open-beta-support"><FileText size={15} color={palette.accent} /><Text style={styles.linkText}>Device and cleanup status</Text><ChevronRight size={17} color={palette.inkMuted} /></Pressable></Section> : null}
      <ProfileControlsModal visible={profileControlsOpen} onClose={() => setProfileControlsOpen(false)} />
      <FullResetModal visible={fullResetOpen} onClose={() => setFullResetOpen(false)} />
    </ScrollView>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return <View style={styles.section}><Text style={type.heading} accessibilityRole="header">{label}</Text>{hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}<View style={styles.sectionContent}>{children}</View></View>;
}

function AppearanceChoice({ label, selected, onPress, icon, styles }: { label: string; selected: boolean; onPress: () => void; icon: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  return <Pressable onPress={onPress} style={[styles.appearanceChoice, selected && styles.appearanceChoiceActive]} accessibilityRole="radio" accessibilityState={{ checked: selected }}>{icon}<Text style={[styles.appearanceText, selected && styles.appearanceTextActive]}>{label}</Text></Pressable>;
}

function StatusRow({ title, body, loading = false }: { title: string; body: string; loading?: boolean }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return <View style={styles.infoCard}>{loading ? <ActivityIndicator size="small" color={palette.active} /> : <Lock size={18} color={palette.active} />}<View style={styles.flex}><Text style={type.label}>{title}</Text><Text style={styles.supporting}>{body}</Text></View></View>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.wall }, header: { paddingHorizontal: spacing.page }, flex: { flex: 1 },
    section: { paddingHorizontal: spacing.page, paddingTop: spacing.xl, paddingBottom: spacing.md }, sectionHint: { ...type.bodySoft, marginTop: spacing.xs }, sectionContent: { marginTop: spacing.md },
    profileCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
    profileAvatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: palette.activeSoft }, profileName: { ...type.heading, fontSize: 18 }, supporting: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    protectedRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface }, protectedIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: palette.activeSoft },
    accountBlock: { marginTop: spacing.sm, padding: spacing.md, backgroundColor: palette.surface, borderRadius: radii.card }, googleButton: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep }, googleMark: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 17, width: 22, textAlign: "center" }, googleText: { ...type.label, flex: 1, color: palette.onDark },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 13, borderRadius: radii.pill, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft }, chipActive: { backgroundColor: palette.activeSoft, borderColor: palette.active }, chipDisabled: { opacity: 0.48, borderStyle: "dashed" }, chipText: { ...type.label }, chipTextActive: { color: palette.active },
    choiceRow: { flexDirection: "row", gap: spacing.sm }, appearanceChoice: { minHeight: 56, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft }, appearanceChoiceActive: { backgroundColor: palette.activeSoft, borderColor: palette.active }, appearanceText: { ...type.label, color: palette.inkMuted, flexShrink: 1 }, appearanceTextActive: { color: palette.active },
    accentRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }, accentChoice: { minHeight: 82, flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xs, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft }, accentChoiceActive: { backgroundColor: palette.activeSoft, borderColor: palette.active }, swatch: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 }, accentText: { ...type.label, color: palette.inkMuted, fontSize: 12, textAlign: "center" },
    infoCard: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.borderSoft }, infoText: { ...type.bodySoft, color: palette.inkMuted },
    premiumCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radii.card, backgroundColor: palette.accentDeep }, premiumTitle: { ...type.heading, color: palette.onDark, fontSize: 18 }, premiumBody: { ...type.bodySoft, color: palette.onDarkSoft, marginTop: 2 },
    inlineAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", marginTop: spacing.sm, paddingRight: spacing.md }, inlineActionText: { ...type.label, color: palette.inkMuted },
    linkRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm }, linkText: { ...type.label, color: palette.accent },
    dangerRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginTop: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft }, dangerText: { ...type.label, color: palette.danger }, version: { ...type.caption, color: palette.inkMuted, marginTop: spacing.lg }, pressed: { opacity: 0.78 },
  });
}

