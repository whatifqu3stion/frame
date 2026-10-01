import type { SettingsSection } from "@/constants/settings";
import { useScreenAction } from "@/hooks/useScreenAction";
import Pressable from "@/components/motion/ChoicePressable";
import { useFeedback, useFeedbackPreference } from "@/hooks/useFeedback";
import { setFeedbackEnabled } from "@/services/feedback";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Platform, Switch, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, ChevronRight, Crown, FileText, Link2, Lock, LogOut, Moon, RotateCcw, Sun, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FullResetModal from "@/components/FullResetModal";
import { FEATURE_FLAGS, IS_CLOSED_BETA } from "@/constants/config";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { ONBOARDING_INTEREST_MAX } from "@/constants/productConfig";
import { accentOptions, createPalette, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { isInterestOptionDisabled } from "@/domain/interests";
import { useApp } from "@/providers/AppProvider";

export default function SettingsDetails({ section }: { section: SettingsSection }) {
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const haptics = useFeedbackPreference();
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  const [hapticsBusy, setHapticsBusy] = useState(false);
  const { isDark, palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const {
    interests, toggleInterest, openPremium, isPremium, premiumAccessState, refreshPremiumAccess,
    googleConfigured, googleConnected, googleEmail, importing, signInWithGoogle,
    signOutGoogle, prefs, setTheme, setAccent, activeProfile,
    requestOwnerAuthorization,
  } = useApp();
  const { busy: accountBusy, run: accountAction, capture } = useScreenAction(`${activeProfile?.id ?? ""}:${section}`);
  const [fullResetOpen, setFullResetOpen] = useState<boolean>(false);

  const onConnect = async (): Promise<void> => {
    await accountAction(signInWithGoogle, (result) => {
      if (result.ok) router.push("/google-import");
      else Alert.alert("Google connection", result.message);
    }, () => Alert.alert("Google connection", "Google couldn’t connect. Try again when you’re ready."));
  };

  const onSignOut = (): void => {
    const isCurrent = capture();
    Alert.alert("Disconnect Google?", "Frame will revoke Google access. Followed sources stay on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => {
        if (!isCurrent()) return;
        void accountAction(signOutGoogle, (result) => {
          Alert.alert(result.ok ? "Disconnected" : "Couldn’t disconnect", result.message);
        }, () => Alert.alert("Couldn’t disconnect", "Check the connection status and try again."));
      } },
    ]);
  };
  const onWipe = (): void => {
    void accountAction(() => requestOwnerAuthorization(), (authorized) => {
      if (authorized) setFullResetOpen(true);
    }, () => Alert.alert("Couldn’t open data controls", "Try again. No data has been erased."));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ width: "100%", maxWidth: 640, alignSelf: "center", paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
      {section === "google" ? <Section hint="Choose which subscriptions to follow in Frame.">
        {googleConnected ? (
          <View style={styles.accountBlock}>
            <Text style={type.label} numberOfLines={1}>{googleEmail ?? "Google connected"}</Text>
            <Pressable onPress={() => router.push("/google-import")} style={styles.inlineAction} accessibilityRole="button" testID="settings-google-import">
              <Text style={styles.linkText}>Choose subscriptions</Text><ChevronRight size={15} color={palette.active} />
            </Pressable>
            <Pressable onPress={onSignOut} style={styles.inlineAction} disabled={accountBusy} accessibilityState={{ busy: accountBusy, disabled: accountBusy }} accessibilityRole="button" testID="sign-out-google">
              {accountBusy ? <ActivityIndicator size="small" color={palette.inkMuted} /> : <LogOut size={15} color={palette.inkMuted} />}
              <Text style={styles.inlineActionText}>Disconnect Google</Text>
            </Pressable>
          </View>
        ) : googleConfigured ? (
          <Pressable onPress={() => { void onConnect(); }} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]} disabled={accountBusy || importing} accessibilityState={{ busy: accountBusy || importing, disabled: accountBusy || importing }} accessibilityRole="button" testID="connect-google">
            {accountBusy || importing ? <><ActivityIndicator color={palette.onDark} /><Text style={styles.googleText}>Connecting…</Text></> : <><Link2 size={18} color={palette.onDark} /><Text style={styles.googleText}>Connect Google</Text><ChevronRight size={17} color={palette.onDarkSoft} /></>}
          </Pressable>
        ) : <Text style={styles.infoText}>Google connection isn’t available in this version. You can still add sources with a link or @handle.</Text>}
      </Section> : null}

      {section === "interests" ? <Section hint={`Choose up to ${ONBOARDING_INTEREST_MAX} interests for weekly source suggestions. This is optional.`}>
        <Text style={[type.label, { marginBottom: spacing.md }]} accessibilityLiveRegion="polite">{interests.length} of {ONBOARDING_INTEREST_MAX} selected</Text>
        <View style={styles.chipGrid} accessibilityLabel="Weekly source interests">
          {INTEREST_LIBRARY.map((interest) => {
            const selectedIds = interests.map((item) => item.id);
            const selected = selectedIds.includes(interest.id);
            const unavailable = isInterestOptionDisabled(selectedIds, interest.id, ONBOARDING_INTEREST_MAX);
            return (
              <Pressable key={interest.id} onPress={() => { const done = feedback.capture(); void toggleInterest(interest.id).then((changed) => done("selection", changed)).catch(() => Alert.alert("Couldn’t save interests", "Try again in a moment.")); }} disabled={unavailable} style={[styles.chip, selected && styles.chipActive, unavailable && styles.chipDisabled]} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: unavailable }} accessibilityHint={unavailable ? "Remove a selected interest before choosing this one." : undefined} testID={`interest-${interest.id}`}>
                <Check size={14} color={palette.active} style={{ opacity: selected ? 1 : 0 }} accessible={false} />
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{interest.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section> : null}

      {section === "appearance" ? <><Section label="Theme" hint="The video player always uses a dark background.">
        <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
          <AppearanceChoice label="Light · Bone" selected={prefs.theme === "warm"} onPress={() => { if (prefs.theme === "warm") return; const done = feedback.capture(); void setTheme("warm").then(() => done("selection")).catch(() => Alert.alert("Couldn’t save appearance", "Try again in a moment.")); }} icon={<Sun size={18} color={prefs.theme === "warm" ? palette.active : palette.inkMuted} />} styles={styles} />
          <AppearanceChoice label="Dark · Smoked umber" selected={prefs.theme === "ink"} onPress={() => { if (prefs.theme === "ink") return; const done = feedback.capture(); void setTheme("ink").then(() => done("selection")).catch(() => Alert.alert("Couldn’t save appearance", "Try again in a moment.")); }} icon={<Moon size={18} color={prefs.theme === "ink" ? palette.active : palette.inkMuted} />} styles={styles} />
        </View>
      </Section>
      <Section label="Accent color">
        <View style={styles.accentRow} accessibilityRole="radiogroup" accessibilityLabel="Accent color">
          {accentOptions.map((option) => {
            const selected = prefs.accent === option.id;
            const swatch = createPalette(isDark, option.id).accent;
            return (
              <Pressable key={option.id} onPress={() => { if (prefs.accent === option.id) return; const done = feedback.capture(); void setAccent(option.id).then(() => done("selection")).catch(() => Alert.alert("Couldn’t save appearance", "Try again in a moment.")); }} style={[styles.accentChoice, selected && styles.accentChoiceActive]} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${option.label} accent`}>
                <View style={[styles.swatch, { backgroundColor: swatch }]}>{selected ? <Check size={14} color={palette.onAccent} strokeWidth={2.4} /> : null}</View>
                <Text style={styles.accentText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label="Touch feedback" hint={Platform.OS === "web" ? "Touch feedback is available in the mobile app on supported phones." : "Subtle feedback for choices and completed actions. Applies to every profile on this device."}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 48 }}>
          <Text style={[type.label, styles.flex]}>Haptic feedback</Text>
          <Switch value={Platform.OS !== "web" && haptics.enabled} disabled={Platform.OS === "web" || !haptics.ready || hapticsBusy} accessibilityLabel="Haptic feedback" onValueChange={(value) => { setHapticsBusy(true); void setFeedbackEnabled(value).catch(() => Alert.alert("Couldn’t save touch feedback", "Try again in a moment.")).finally(() => setHapticsBusy(false)); }} />
        </View>
      </Section></> : null}

      {section === "premium" && FEATURE_FLAGS.paidAccess ? <Section>
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

      {section === "privacy" ? <Section hint="Your library and preferences are stored on this device.">
        <Pressable onPress={() => router.push("/privacy")} style={styles.linkRow} accessibilityRole="link"><FileText size={15} color={palette.accent} /><Text style={styles.linkText}>Privacy Policy</Text></Pressable>
        <Pressable onPress={() => router.push("/terms")} style={styles.linkRow} accessibilityRole="link"><FileText size={15} color={palette.accent} /><Text style={styles.linkText}>Terms of Use</Text></Pressable>
        <Pressable onPress={onWipe} disabled={accountBusy} accessibilityState={{ busy: accountBusy, disabled: accountBusy }} style={styles.dangerRow} accessibilityRole="button" testID="wipe-data">{accountBusy ? <ActivityIndicator color={palette.danger} /> : <Trash2 size={17} color={palette.danger} />}<View style={styles.flex}><Text style={styles.dangerText}>Erase all Frame data and start over</Text><Text style={styles.supporting}>Deletes every local profile, PIN, playback and content boundary, usage record, request, and library item.</Text></View></Pressable>
      </Section> : null}

      {section === "about" ? <>
      <Section><Text style={styles.infoText}>Frame brings together the creators you choose, with space to watch at your own pace.</Text><Text style={styles.version}>Version 1.0</Text></Section>
      <Section label="Using Frame">{HELP_TOPICS.map((topic) => <View key={topic.title} style={styles.helpTopic}>
        <Pressable onPress={() => setHelpOpen(helpOpen === topic.title ? null : topic.title)} style={styles.linkRow} accessibilityRole="button" accessibilityState={{ expanded: helpOpen === topic.title }}><Text style={[type.label, styles.flex]}>{topic.title}</Text><ChevronRight size={17} color={palette.inkMuted} style={{ transform: [{ rotate: helpOpen === topic.title ? "90deg" : "0deg" }] }} /></Pressable>
        {helpOpen === topic.title ? <Text style={[type.bodySoft, { paddingBottom: spacing.md }]}>{topic.body}</Text> : null}
      </View>)}</Section>
      {FEATURE_FLAGS.demoPaywall && !FEATURE_FLAGS.paidAccess ? <Section label="Demo"><Pressable onPress={() => router.push("/welcome-preview")} style={styles.linkRow} accessibilityRole="button" testID="preview-welcome"><RotateCcw size={17} color={palette.active} /><View style={styles.flex}><Text style={styles.linkText}>Preview welcome & Premium</Text><Text style={styles.supporting}>Replay setup and try the sample checkout. No charge.</Text></View><ChevronRight size={17} color={palette.inkMuted} /></Pressable></Section> : null}
      {IS_CLOSED_BETA ? <Section label="Beta support"><Pressable onPress={() => router.push("/diagnostics")} style={styles.linkRow} accessibilityRole="button" testID="open-beta-support"><FileText size={15} color={palette.accent} /><Text style={styles.linkText}>Device and cleanup status</Text><ChevronRight size={17} color={palette.inkMuted} /></Pressable></Section> : null}
      </> : null}
      <FullResetModal visible={fullResetOpen} onClose={() => setFullResetOpen(false)} />
    </ScrollView>
  );
}

const HELP_TOPICS = [
  { title: "How does Today choose videos?", body: "Today brings together a small, finite selection from sources you follow. Interests help you discover sources; they don’t automatically add videos to Today. Save what catches your eye, or choose a video to watch. Managed profiles also follow their Owner’s approvals." },
  { title: "How do I find and follow sources?", body: "Open Sources to review this week’s suggestions or add a supported channel or video link, @handle, or channel ID. Following is always your choice. Open a source to browse its videos directly." },
  { title: "When do suggestions change?", body: "Weekly Picks is a finite edition. Following or dismissing a suggestion won’t automatically replace it. If more are available, you can reveal another from the same edition. Interest changes shape the next weekly edition; the refresh date appears in Sources." },
  { title: "Where are my saves and viewing progress?", body: "Saved holds the videos you’ve kept. Use search and viewing filters to find one. Sessions & progress opens your viewing progress and session plans. To remove a saved video, choose Edit Saved, then Remove from Saved." },
  { title: "How do sessions work?", body: "In Saved, open Sessions & progress, then create a session. Choose up to three videos, name the session, and arrange their order. Frame pauses between videos and ends after the last one. An unfinished draft stays on this device." },
  { title: "What stays on this device?", body: "Your profiles, saves, sources, sessions, progress, and preferences are kept locally. They don’t sync to another device. Removing the app or erasing Frame data can remove them. Video playback and new suggestions need an internet connection." },
];

function Section({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return <View style={styles.section}>{label ? <Text style={type.heading} accessibilityRole="header">{label}</Text> : null}{hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}<View style={styles.sectionContent}>{children}</View></View>;
}

function AppearanceChoice({ label, selected, onPress, icon, styles }: { label: string; selected: boolean; onPress: () => void; icon: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  const { palette } = useFrameTheme();
  return <Pressable onPress={onPress} style={[styles.appearanceChoice, selected && styles.appearanceChoiceActive]} accessibilityRole="radio" accessibilityState={{ checked: selected }}>{icon}<Text style={[styles.appearanceText, selected && styles.appearanceTextActive]}>{label}</Text><Check size={16} color={palette.active} style={{ opacity: selected ? 1 : 0 }} accessible={false} /></Pressable>;
}

function StatusRow({ title, body, loading = false }: { title: string; body: string; loading?: boolean }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return <View style={styles.infoCard}>{loading ? <ActivityIndicator size="small" color={palette.active} /> : <Lock size={18} color={palette.active} />}<View style={styles.flex}><Text style={type.label}>{title}</Text><Text style={styles.supporting}>{body}</Text></View></View>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    helpTopic: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    screen: { flex: 1, backgroundColor: palette.wall },
    flex: { flex: 1 },
    section: { paddingHorizontal: spacing.page, paddingTop: spacing.md, paddingBottom: spacing.md },
    sectionHint: { ...type.bodySoft, marginTop: spacing.xs },
    sectionContent: { marginTop: spacing.md },
    supporting: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    accountBlock: { gap: spacing.sm },
    googleButton: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep },
    googleText: { ...type.label, flex: 1, color: palette.onDark },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: { minHeight: 48, maxWidth: "100%", paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: 13, borderRadius: radii.pill, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    chipActive: { backgroundColor: palette.activeSoft, borderColor: palette.border },
    chipDisabled: { opacity: 0.48 },
    chipText: { ...type.label, flexShrink: 1 },
    chipTextActive: { color: palette.active },
    choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    appearanceChoice: { minHeight: 56, flexGrow: 1, flexBasis: 180, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    appearanceChoiceActive: { backgroundColor: palette.activeSoft, borderColor: palette.border },
    appearanceText: { ...type.label, color: palette.ink, flex: 1 },
    appearanceTextActive: { color: palette.active },
    accentRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    accentChoice: { minHeight: 82, flexGrow: 1, flexBasis: 90, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xs, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    accentChoiceActive: { backgroundColor: palette.activeSoft, borderColor: palette.border },
    swatch: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
    accentText: { ...type.label, color: palette.inkMuted, fontSize: 12, textAlign: "center" },
    infoCard: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.borderSoft },
    infoText: { ...type.bodySoft, color: palette.inkMuted },
    premiumCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radii.card, backgroundColor: palette.accentDeep },
    premiumTitle: { ...type.heading, color: palette.onDark, fontSize: 18 },
    premiumBody: { ...type.bodySoft, color: palette.onDarkSoft, marginTop: 2 },
    inlineAction: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", marginTop: spacing.sm, paddingRight: spacing.md },
    inlineActionText: { ...type.label, color: palette.inkMuted },
    linkRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    linkText: { ...type.label, flexShrink: 1, color: palette.accent },
    dangerRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginTop: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    dangerText: { ...type.label, color: palette.danger },
    version: { ...type.caption, color: palette.inkMuted, marginTop: spacing.lg },
    pressed: { opacity: 0.78 },
  });
}
