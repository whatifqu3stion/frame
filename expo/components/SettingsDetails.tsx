import PrimaryAction from "@/components/PrimaryAction";
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
import { ActivityIndicator, Platform, Switch, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { ChevronRight, Link2, Moon, Sun } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FullResetModal from "@/components/FullResetModal";
import { GroupedInterestChoices } from "@/components/InterestChoices";
import { confirmUser, notifyUser } from "@/services/notifyUser";
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

  const weeklyAvailable = activeProfile?.role !== "managed";
  const selectedTopics = interests.map((item) => item.name);
  const topicSummary = selectedTopics.length > 2
    ? `${selectedTopics.slice(0, 2).join(", ")} and ${selectedTopics.length - 2} more`
    : selectedTopics.join(", ") || "Choose topics for weekly source suggestions";

  const onConnect = async (): Promise<void> => {
    await accountAction(signInWithGoogle, (result) => {
      if (result.ok) router.push("/google-import");
      else notifyUser("Google connection", result.message);
    }, () => notifyUser("Google connection", "Google couldn’t connect. Try again when you’re ready."));
  };

  const onSignOut = (): void => {
    const isCurrent = capture();
    confirmUser("Disconnect Google?", "Frame will revoke Google access. The sources you follow will stay in your library.", "Disconnect", (accepted) => {
      if (!accepted || !isCurrent()) return;
      void accountAction(signOutGoogle, (result) => {
        notifyUser(result.ok ? "Disconnected" : "Couldn’t disconnect", result.message);
      }, () => notifyUser("Couldn’t disconnect", "Check the connection status and try again."));
    }, true);
  };
  const onWipe = (): void => {
    void accountAction(() => requestOwnerAuthorization(), (authorized) => {
      if (authorized) setFullResetOpen(true);
    }, () => notifyUser("Couldn’t open data controls", "Try again. No data has been erased."));
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={Platform.OS === "ios"} style={styles.screen} contentContainerStyle={{ width: "100%", maxWidth: 640, alignSelf: "center", paddingLeft: insets.left, paddingRight: insets.right, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
      {section === "today" ? <>
        <Section><TodaySelectionSetting /></Section>
        {weeklyAvailable && <Section label="Weekly discovery"><SettingsRow title="Weekly interests" summary={topicSummary} onPress={() => router.push("/settings/interests")} testID="settings-interests" /></Section>}
      </> : null}
      {section === "google" ? <Section label={googleConnected ? "Connected account" : "Your YouTube subscriptions"} hint={googleConfigured || googleConnected ? "Choose the channels to bring into this profile. Frame follows only the ones you select." : undefined}>
        {googleConnected ? (
          <View style={styles.accountBlock}>
            <Text style={type.bodySoft}>{googleEmail ?? "Google connected"}</Text>
            <SettingsRow title="Choose subscriptions" onPress={() => router.push("/google-import")} testID="settings-google-import" />
            <SettingsRow title="Disconnect Google" summary="Your followed sources stay in Frame." onPress={onSignOut} busy={accountBusy} destructive navigation={false} testID="sign-out-google" />
          </View>
        ) : googleConfigured ? (
          <PrimaryAction depth={palette.primaryButtonDepth} onPress={() => { void onConnect(); }} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]} disabled={accountBusy || importing} accessibilityState={{ busy: accountBusy || importing, disabled: accountBusy || importing }} accessibilityRole="button" testID="connect-google">
            {accountBusy || importing ? <><ActivityIndicator color={palette.onDark} /><Text style={styles.googleText}>Connecting…</Text></> : <><Link2 size={18} color={palette.onDark} /><Text style={styles.googleText}>Connect Google</Text><ChevronRight size={17} color={palette.onDarkSoft} /></>}
          </PrimaryAction>
        ) : <View style={{ gap: spacing.sm }}><Text style={type.bodySoft}>This version of Frame supports adding channels directly.</Text><SettingsRow title="Add a source directly" summary="Use a channel link or @handle." onPress={() => router.push(activeProfile?.role === "managed" ? "/(tabs)/sources" : "/add-source")} /></View>}
      </Section> : null}

      {section === "interests" && weeklyAvailable ? <Section label="Your topics" hint="Choose interests for your next weekly source suggestions.">
        <Text style={type.label} accessibilityLiveRegion="polite">{selectedTopics.length ? topicSummary : "No topics selected"}</Text>
        {interests.length > 0 && <InlineHelp label="Prioritize up to three topics"><DiscoveryFocus key={activeProfile?.id} compact /></InlineHelp>}
        <CustomInterestInput compact selectedIds={interests.map((interest) => interest.id)} onAdd={toggleInterest} />
        <GroupedInterestChoices headingLevel={3} collapsible selectedIds={interests.map((interest) => interest.id)} onToggle={(id) => { const done = feedback.capture(); void toggleInterest(id).then((changed) => done("selection", changed)).catch(() => notifyUser("Couldn’t save interests", "Try again in a moment.")); }} accessibilityLabel="Weekly source interests" testIDPrefix="interest" />
      </Section> : null}
      {section === "interests" && !weeklyAvailable ? <Section><Text style={type.bodySoft}>Managed profiles watch videos and sources approved by the Owner.</Text><SettingsRow title="View sources" onPress={() => router.push("/(tabs)/sources")} /></Section> : null}

      {section === "appearance" ? <><Section label="Theme">
        <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
          <ChoiceOption label="Light" selected={prefs.theme === "warm"} onPress={() => { if (prefs.theme === "warm") return; const done = feedback.capture(); void setTheme("warm").then(() => done("selection")).catch(() => notifyUser("Couldn’t save appearance", "Try again in a moment.")); }} leading={<Sun size={18} color={prefs.theme === "warm" ? palette.active : palette.inkMuted} />} style={styles.appearanceChoice} />
          <ChoiceOption label="Dark" selected={prefs.theme === "ink"} onPress={() => { if (prefs.theme === "ink") return; const done = feedback.capture(); void setTheme("ink").then(() => done("selection")).catch(() => notifyUser("Couldn’t save appearance", "Try again in a moment.")); }} leading={<Moon size={18} color={prefs.theme === "ink" ? palette.active : palette.inkMuted} />} style={styles.appearanceChoice} />
        </View>
        <Text style={[type.bodySoft, { marginTop: spacing.sm }]}>The video player stays dark in both themes.</Text>
      </Section>
      <Section label="Accent color">
        <View style={styles.accentRow} accessibilityRole="radiogroup" accessibilityLabel="Accent color">
          {accentOptions.map((option) => {
            const selected = prefs.accent === option.id;
            const swatch = createPalette(isDark, option.id).accent;
            return (
              <ChoiceOption key={option.id} label={option.label} selected={selected} onPress={() => { if (prefs.accent === option.id) return; const done = feedback.capture(); void setAccent(option.id).then(() => done("selection")).catch(() => notifyUser("Couldn’t save appearance", "Try again in a moment.")); }} style={[styles.accentChoice, stackAccents && styles.stackedChoice]} accessibilityLabel={`${option.label} accent`} leading={<View style={[styles.swatch, { backgroundColor: swatch }]} />} />
            );
          })}
        </View>
      </Section>

      {Platform.OS !== "web" && <Section label="Touch feedback">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 48 }}>
          <View style={styles.flex}><Text style={type.body}>Haptic feedback</Text><Text style={styles.supporting}>Vibrate on selections and completed actions. Applies to all profiles on this device.</Text></View>
          <Switch trackColor={{ false: palette.surfaceDim, true: palette.active }} ios_backgroundColor={palette.surfaceDim} value={haptics.enabled} disabled={!haptics.ready || hapticsBusy} accessibilityLabel="Haptic feedback" onValueChange={(value) => { setHapticsBusy(true); void setFeedbackEnabled(value).catch(() => notifyUser("Couldn’t save touch feedback", "Try again in a moment.")).finally(() => setHapticsBusy(false)); }} />
        </View>
      </Section>}</> : null}

      {section === "keys" ? <Section><ProviderKeySettings /></Section> : null}

      {section === "privacy" ? <>
        <Section label="Your library" hint={Platform.OS === "web" ? "This browser preview keeps your library in memory. Refreshing the page resets it." : "Your library, settings and viewing history stay on this device. Frame has no cloud backup."}>
          <Text style={type.bodySoft}>Saved videos are links. Playback requires an internet connection.</Text>
        </Section>
        <Section label="Policies">
          <SettingsRow title="Privacy Policy" onPress={() => router.push("/privacy")} accessibilityRole="link" />
          <SettingsRow title="Terms of Use" onPress={() => router.push("/terms")} accessibilityRole="link" />
        </Section>
        <Section label="Erase device data">
          <Text style={type.bodySoft}>Erasing permanently removes all profiles, libraries and both API keys from this device. It also clears the Owner PIN, viewing limits and schedules, usage records, content approvals and pending requests.</Text>
          <SettingsRow title="Erase all Frame data" onPress={onWipe} busy={accountBusy} destructive navigation={false} testID="wipe-data" />
        </Section>
      </> : null}

      {section === "about" ? <>
      <Section label="Using Frame">{HELP_TOPICS.filter((topic) => weeklyAvailable || topic.href !== "/settings/interests").map((topic) => <View key={topic.title} style={styles.helpTopic}>
        <Pressable onPress={() => setHelpOpen(helpOpen === topic.title ? null : topic.title)} style={styles.linkRow} accessibilityRole="button" accessibilityState={{ expanded: helpOpen === topic.title }}><Text style={[type.body, styles.flex]}>{topic.title}</Text><DisclosureIndicator expanded={helpOpen === topic.title} color={palette.inkMuted} /></Pressable>
        {helpOpen === topic.title ? <MotionView enter style={{ paddingBottom: spacing.md, gap: spacing.sm }}><Text style={type.bodySoft}>{topic.body}</Text><Pressable onPress={() => router.push(topic.href)} style={styles.linkRow} accessibilityRole="button"><Text style={styles.linkText}>{topic.action}</Text><ChevronRight size={15} color={palette.active} /></Pressable></MotionView> : null}
      </View>)}</Section>
      <Section label="Setup &amp; troubleshooting">
        <SettingsRow title="Revisit setup" summary="Walk through connections, topics and sources again." onPress={() => router.push("/welcome-preview")} testID="preview-welcome" />
        <SettingsRow title="Device diagnostics" summary="Review the device report before sharing it." onPress={() => router.push("/diagnostics")} testID="open-diagnostics" />
      </Section>
      <Section label="About Frame">
        <Text style={styles.version}>Version {Constants.expoConfig?.version ?? "1.0.0"}{Platform.OS === "android" && Constants.expoConfig?.android?.versionCode ? ` · Build ${Constants.expoConfig.android.versionCode}` : ""}</Text>
        <Text style={styles.version}>Empty frames illustration by Yu luck, from the Noun Project.</Text>
      </Section>
      </> : null}
      <FullResetModal visible={fullResetOpen} onClose={() => setFullResetOpen(false)} />
    </ScrollView>
  );
}

const HELP_TOPICS: { title: string; body: string; action: string; href: Href }[] = [
  { title: "Change how many videos appear in Today", body: "Choose your daily count. The next selection arrives at 4 a.m. and draws from sources you follow.", action: "Viewing preferences", href: "/settings/today" },
  { title: "Follow a creator", body: "Open Sources and add a channel link or @handle. Managed profiles can request a creator for the Owner to review.", action: "Open Sources", href: "/(tabs)/sources" },
  { title: "Change weekly suggestions", body: "Choose topics and prioritize up to three for the next edition. Your current suggestions stay available in Discover.", action: "Choose interests", href: "/settings/interests" },
  { title: "Find a saved video or resume watching", body: "Open Videos in Saved. Continue watching shows where you left off. Use Search & filter to find a saved title or source, or Edit Saved to remove one.", action: "Saved videos", href: { pathname: "/(tabs)/saved", params: { section: "videos" } } },
  { title: "Plan a viewing session", body: "In Saved, choose Sessions. Arrange saved videos and set a playback limit. Frame pauses when that time is up.", action: "Open Sessions", href: { pathname: "/(tabs)/saved", params: { section: "sessions" } } },
  { title: "Review a profile’s requests", body: "In Settings, choose the pending requests for that profile. The Owner can approve one video or all videos from a requested source.", action: "View Settings", href: "/(tabs)/settings" },
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
    version: { ...type.caption, color: palette.inkMuted, marginBottom: spacing.sm },
    pressed: { opacity: 0.78 },
  });
}
