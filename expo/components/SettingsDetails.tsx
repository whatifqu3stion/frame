import Constants from "expo-constants";
import Text from "@/components/FrameText";
import Heading from "@/components/Heading";
import SettingsRow from "@/components/SettingsRow";
import InlineHelp from "@/components/InlineHelp";
import TodaySelectionSetting from "@/components/TodaySelectionSetting";
import DiscoveryFocus from "@/components/DiscoveryFocus";
import MotionView from "@/components/motion/MotionView";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
import CustomInterestInput from "@/components/CustomInterestInput";
import ProviderKeySettings from "@/components/ProviderKeySettings";
import ChoiceOption from "@/components/ChoiceOption";
import type { SettingsSection } from "@/constants/settings";
import { useScreenAction } from "@/hooks/useScreenAction";
import Pressable from "@/components/motion/ChoicePressable";
import { useFeedback, useFeedbackPreference } from "@/hooks/useFeedback";
import { setFeedbackEnabled } from "@/services/feedback";
import { router, type Href } from "expo-router";
import { ActivityIndicator, Alert, Platform, Switch, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { ChevronRight, Link2, Moon, Sun } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FullResetModal from "@/components/FullResetModal";
import { GroupedInterestChoices } from "@/components/InterestChoices";
import { TODAY_MAX_ITEMS } from "@/constants/productConfig";
import { accentOptions, createPalette, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

export default function SettingsDetails({ section }: { section: SettingsSection }) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackAccents = width - insets.left - insets.right < 560 || fontScale > 1.3;
  const feedback = useFeedback();
  const haptics = useFeedbackPreference();
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  const [hapticsBusy, setHapticsBusy] = useState(false);
  const { isDark, palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const {
    interests, toggleInterest,
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
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={Platform.OS === "ios"} style={styles.screen} contentContainerStyle={{ width: "100%", maxWidth: 640, alignSelf: "center", paddingLeft: insets.left, paddingRight: insets.right, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
      {section === "today" ? <Section><TodaySelectionSetting /><InlineHelp label="How videos are selected"><Text style={type.bodySoft}>Videos are at least four minutes long, with up to two per source. Refresh updates details without refilling Today. Managed profiles follow their Owner’s approvals.</Text></InlineHelp></Section> : null}
      {section === "google" ? <Section label="Subscriptions" hint={googleConfigured || googleConnected ? "Choose which Google subscriptions to follow in Frame." : undefined}>
        {googleConnected ? (
          <View style={styles.accountBlock}>
            <Text style={type.bodySoft}>{googleEmail ?? "Google connected"}</Text>
            <SettingsRow title="Choose subscriptions" onPress={() => router.push("/google-import")} testID="settings-google-import" />
            <SettingsRow title="Disconnect Google" summary="Your followed sources stay in Frame." onPress={onSignOut} busy={accountBusy} destructive navigation={false} testID="sign-out-google" />
          </View>
        ) : googleConfigured ? (
          <Pressable onPress={() => { void onConnect(); }} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]} disabled={accountBusy || importing} accessibilityState={{ busy: accountBusy || importing, disabled: accountBusy || importing }} accessibilityRole="button" testID="connect-google">
            {accountBusy || importing ? <><ActivityIndicator color={palette.onDark} /><Text style={styles.googleText}>Connecting…</Text></> : <><Link2 size={18} color={palette.onDark} /><Text style={styles.googleText}>Connect Google</Text><ChevronRight size={17} color={palette.onDarkSoft} /></>}
          </Pressable>
        ) : <View style={{ gap: spacing.sm }}><Text style={type.bodySoft}>Google connection isn’t available in this version.</Text><SettingsRow title="Add a source directly" summary="Use a channel link or @handle." onPress={() => router.push("/(tabs)/sources")} /></View>}
      </Section> : null}

      {section === "interests" ? <Section label="Topics you enjoy" hint="Changes apply to your next weekly picks.">
        <Text style={[type.label, { marginBottom: spacing.md }]} accessibilityLiveRegion="polite">{interests.length} selected</Text>
        <GroupedInterestChoices selectedIds={interests.map((interest) => interest.id)} onToggle={(id) => { const done = feedback.capture(); void toggleInterest(id).then((changed) => done("selection", changed)).catch(() => Alert.alert("Couldn’t save interests", "Try again in a moment.")); }} accessibilityLabel="Weekly source interests" testIDPrefix="interest" />
        <CustomInterestInput selectedIds={interests.map((interest) => interest.id)} onAdd={toggleInterest} />
        {interests.length > 0 ? <InlineHelp label="Focus for next edition"><DiscoveryFocus key={activeProfile?.id} compact /></InlineHelp> : null}
      </Section> : null}

      {section === "appearance" ? <><Section label="Theme">
        <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
          <ChoiceOption label="Light · Bone" selected={prefs.theme === "warm"} onPress={() => { if (prefs.theme === "warm") return; const done = feedback.capture(); void setTheme("warm").then(() => done("selection")).catch(() => Alert.alert("Couldn’t save appearance", "Try again in a moment.")); }} leading={<Sun size={18} color={prefs.theme === "warm" ? palette.active : palette.inkMuted} />} style={styles.appearanceChoice} />
          <ChoiceOption label="Dark · Smoked umber" selected={prefs.theme === "ink"} onPress={() => { if (prefs.theme === "ink") return; const done = feedback.capture(); void setTheme("ink").then(() => done("selection")).catch(() => Alert.alert("Couldn’t save appearance", "Try again in a moment.")); }} leading={<Moon size={18} color={prefs.theme === "ink" ? palette.active : palette.inkMuted} />} style={styles.appearanceChoice} />
        </View>
        <Text style={[type.bodySoft, { marginTop: spacing.sm }]}>The video player stays dark in both themes.</Text>
      </Section>
      <Section label="Accent color">
        <View style={styles.accentRow} accessibilityRole="radiogroup" accessibilityLabel="Accent color">
          {accentOptions.map((option) => {
            const selected = prefs.accent === option.id;
            const swatch = createPalette(isDark, option.id).accent;
            return (
              <ChoiceOption key={option.id} label={option.label} selected={selected} onPress={() => { if (prefs.accent === option.id) return; const done = feedback.capture(); void setAccent(option.id).then(() => done("selection")).catch(() => Alert.alert("Couldn’t save appearance", "Try again in a moment.")); }} style={[styles.accentChoice, stackAccents && styles.stackedChoice]} accessibilityLabel={`${option.label} accent`} leading={<View style={[styles.swatch, { backgroundColor: swatch }]} />} />
            );
          })}
        </View>
      </Section>

      <Section label="Touch feedback">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 48 }}>
          <View style={styles.flex}><Text style={type.body}>Haptic feedback</Text><Text style={styles.supporting}>{Platform.OS === "web" ? "Available on supported phones." : "For choices and completed actions. Applies to all profiles on this device."}</Text></View>
          <Switch trackColor={{ false: palette.surfaceDim, true: palette.active }} ios_backgroundColor={palette.surfaceDim} value={Platform.OS !== "web" && haptics.enabled} disabled={Platform.OS === "web" || !haptics.ready || hapticsBusy} accessibilityLabel="Haptic feedback" onValueChange={(value) => { setHapticsBusy(true); void setFeedbackEnabled(value).catch(() => Alert.alert("Couldn’t save touch feedback", "Try again in a moment.")).finally(() => setHapticsBusy(false)); }} />
        </View>
      </Section></> : null}

      {section === "keys" ? <Section><ProviderKeySettings /></Section> : null}

      {section === "privacy" ? <>
        <Section label="Policies" hint="Your library and preferences are stored on this device.">
          <SettingsRow title="Privacy Policy" onPress={() => router.push("/privacy")} accessibilityRole="link" />
          <SettingsRow title="Terms of Use" onPress={() => router.push("/terms")} accessibilityRole="link" />
        </Section>
        <Section label="Device data">
          <Text style={type.bodySoft}>Deletes both API keys, every local profile, PIN, playback and content boundary, usage record, request, and library item. This cannot be undone.</Text>
          <SettingsRow title="Erase all Frame data" onPress={onWipe} busy={accountBusy} destructive navigation={false} testID="wipe-data" />
        </Section>
      </> : null}

      {section === "about" ? <>
      <Section label="Using Frame">{HELP_TOPICS.map((topic) => <View key={topic.title} style={styles.helpTopic}>
        <Pressable onPress={() => setHelpOpen(helpOpen === topic.title ? null : topic.title)} style={styles.linkRow} accessibilityRole="button" accessibilityState={{ expanded: helpOpen === topic.title }}><Text style={[type.body, styles.flex]}>{topic.title}</Text><DisclosureIndicator expanded={helpOpen === topic.title} color={palette.inkMuted} /></Pressable>
        {helpOpen === topic.title ? <MotionView enter style={{ paddingBottom: spacing.md, gap: spacing.sm }}><Text style={type.bodySoft}>{topic.body}</Text><Pressable onPress={() => router.push(topic.href)} style={styles.linkRow} accessibilityRole="button"><Text style={styles.linkText}>{topic.action}</Text><ChevronRight size={15} color={palette.active} /></Pressable></MotionView> : null}
      </View>)}</Section>
      <Section label="About Frame">
        <SettingsRow title="Revisit setup" onPress={() => router.push("/welcome-preview")} testID="preview-welcome" />
        <SettingsRow title="Device diagnostics" summary="View or share a report for troubleshooting" onPress={() => router.push("/diagnostics")} testID="open-diagnostics" />
        <Text style={styles.version}>Version {Constants.expoConfig?.version ?? "1.0.0"}{Platform.OS === "android" && Constants.expoConfig?.android?.versionCode ? ` · Build ${Constants.expoConfig.android.versionCode}` : ""}</Text>
      </Section>
      </> : null}
      <FullResetModal visible={fullResetOpen} onClose={() => setFullResetOpen(false)} />
    </ScrollView>
  );
}

const HELP_TOPICS: { title: string; body: string; action: string; href: Href }[] = [
  { title: "Find something to watch", body: `Choose 1–${TODAY_MAX_ITEMS} videos per day in Settings → Today’s selection. Today brings them from sources you follow. Save one for later or choose one to watch. Interests suggest sources; following a source shapes Today. Managed profiles also follow their Owner’s approvals.`, action: "Open Today", href: "/(tabs)" },
  { title: "Add a favorite creator", body: "In Sources, review a suggestion or enter a supported channel or video link, @handle, or channel ID. Review the source, then choose Follow source. Open any followed source to browse its videos.", action: "Open Sources", href: "/(tabs)/sources" },
  { title: "Change your weekly suggestions", body: "Choose interests in Settings. Changes apply to the next weekly edition; Sources shows its refresh date. Following or dismissing a pick doesn’t automatically replace it. Prepare up to 12 reviewed suggestions each week and reveal the next three when you choose. You can revisit earlier picks. An empty edition allows one recovery attempt.", action: "Choose interests", href: "/settings/interests" },
  { title: "Find or remove a saved video", body: "In Saved, choose Search & filter to find a title or source, or show videos in progress. To remove a video, choose Edit Saved, then Remove from Saved. Use Undo in the removal message to put it back.", action: "Open Saved", href: "/(tabs)/saved" },
  { title: "Resume watching or plan a session", body: `In Saved, Continue watching resumes your latest video. Open Sessions & progress to see all progress or create a session. Choose a duration, name the session, and arrange your videos. Only actual playback uses your time. At the limit, end the session or finish the current video. Frame waits for you between videos; profile limits still apply. Drafts stay on this device.`, action: "Open Saved", href: "/(tabs)/saved" },
  { title: "Review a Managed profile’s requests", body: "Open Settings → Profiles & boundaries and choose the Managed profile. Open a request to review its details. Approve video covers that video; Approve source covers videos from that creator. Viewing limits still apply. Decline request removes the request without adding an approval.", action: "Open Settings", href: "/(tabs)/settings" },
  { title: "Understand storage and offline use", body: "Profiles, saves, sources, sessions, and progress stay on this device; they don’t sync between devices. Saved videos are links, not downloads. Playback and new suggestions need internet. Removing the app or erasing Frame data can remove your local library.", action: "Open Privacy & data", href: "/settings/privacy" },
];

function Section({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return <View style={styles.section}>{label ? <Heading style={type.heading}>{label}</Heading> : null}{hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}<View style={(label || hint) ? styles.sectionContent : undefined}>{children}</View></View>;
}


function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    helpTopic: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    screen: { flex: 1, backgroundColor: "transparent" },
    flex: { flex: 1, minWidth: 0 },
    section: { paddingHorizontal: spacing.page, paddingTop: spacing.md, paddingBottom: spacing.lg },
    sectionHint: { ...type.bodySoft, marginTop: spacing.xs },
    sectionContent: { marginTop: spacing.md },
    supporting: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    accountBlock: { gap: spacing.sm },
    googleButton: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep },
    googleText: { ...type.label, flex: 1, color: palette.onDark },
    choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    appearanceChoice: { flexGrow: 1, flexBasis: 220 },
    accentRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    accentChoice: { flexGrow: 1, flexBasis: 150 },
    stackedChoice: { flexBasis: "100%" },
    swatch: { width: 24, height: 24, borderRadius: 12 },
    linkRow: { minHeight: 56, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    linkText: { ...type.label, flexShrink: 1, color: palette.accent },
    version: { ...type.caption, color: palette.inkMuted, marginTop: spacing.lg },
    pressed: { opacity: 0.78 },
  });
}
