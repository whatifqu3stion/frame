import Constants from "expo-constants";
import Text from "@/components/FrameText";
import Heading from "@/components/Heading";
import SettingsRow from "@/components/SettingsRow";
import TodaySelectionSetting from "@/components/TodaySelectionSetting";
import DiscoveryFocus from "@/components/DiscoveryFocus";
import { HELP_TOPICS } from "@/constants/helpTopics";
import SettingsGroup from "@/components/SettingsGroup";
import CustomInterestInput from "@/components/CustomInterestInput";
import ProviderKeySettings from "@/components/ProviderKeySettings";
import ChoiceOption from "@/components/ChoiceOption";
import type { SettingsSection } from "@/constants/settings";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useFeedback, useFeedbackPreference } from "@/hooks/useFeedback";
import { setFeedbackEnabled } from "@/services/feedback";
import { router } from "expo-router";
import { Platform, Switch, ScrollView, StyleSheet, View } from "react-native";
import { Moon, Sun } from "lucide-react-native";
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
  const feedback = useFeedback();
  const haptics = useFeedbackPreference();
  const [hapticsBusy, setHapticsBusy] = useState(false);
  const { isDark, palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const {
    interests, toggleInterest,
    hasLegacyGoogleConnection, googleEmail,
    signOutGoogle, prefs, setTheme, setAccent, setHouseLights, activeProfile,
    requestOwnerAuthorization,
  } = useApp();
  const { busy: accountBusy, run: accountAction, capture } = useScreenAction(`${activeProfile?.id ?? ""}:${section}`);
  const [fullResetOpen, setFullResetOpen] = useState<boolean>(false);

  const weeklyAvailable = activeProfile?.role !== "managed";
  const selectedTopics = interests.map((item) => item.name);
  const topicSummary = selectedTopics.length > 2
    ? `${selectedTopics.slice(0, 2).join(", ")} and ${selectedTopics.length - 2} more`
    : selectedTopics.join(", ") || "Choose topics for weekly source suggestions";

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
      {section === "google" ? <Section label="Previous Google connection" hint="Google account import is no longer part of Frame. Add sources by channel link or @handle.">
        {hasLegacyGoogleConnection ? <View style={styles.accountBlock}>
          <Text style={type.bodySoft}>{googleEmail ?? "Connection saved by an earlier version"}</Text>
          <SettingsRow title="Disconnect Google" summary="Your followed sources stay in Frame." onPress={onSignOut} busy={accountBusy} destructive navigation={false} testID="sign-out-google" />
        </View> : <SettingsRow title="Add a source" summary="Use a channel link or @handle." onPress={() => router.push(activeProfile?.role === "managed" ? "/(tabs)/sources" : "/add-source")} />}
      </Section> : null}

      {section === "interests" && weeklyAvailable ? <View style={styles.helpGroups}>
        <Text style={type.bodySoft}>Frame uses these interests to find creators for your next weekly picks.</Text>
        <SettingsGroup label="Your topics">
          <SettingsRow grouped last title={interests.length ? "Edit topics" : "Choose topics"} summary={selectedTopics.join(", ") || "Pick from the list or add an interest of your own."} onPress={() => router.push("/settings/topics")} testID="edit-weekly-topics" />
        </SettingsGroup>
        {interests.length > 0 && <DiscoveryFocus key={activeProfile?.id} overview />}
      </View> : null}
      {section === "topics" && weeklyAvailable ? <Section hint="Open a category to select topics. Your changes save as you go.">
        <GroupedInterestChoices customLast customAction={<CustomInterestInput compact selectedIds={interests.map((interest) => interest.id)} onAdd={toggleInterest} />} headingLevel={3} collapsible selectedIds={interests.map((interest) => interest.id)} onToggle={(id) => { const done = feedback.capture(); void toggleInterest(id).then((changed) => done("selection", changed)).catch(() => notifyUser("Couldn’t save interests", "Try again in a moment.")); }} accessibilityLabel="Weekly source interests" testIDPrefix="interest" />
      </Section> : null}
      {section === "priorities" && weeklyAvailable ? <Section><DiscoveryFocus key={activeProfile?.id} /></Section> : null}
      {["interests", "topics", "priorities"].includes(section) && !weeklyAvailable ? <Section><Text style={type.bodySoft}>Managed profiles watch videos and sources approved by the Owner.</Text><SettingsRow title="View sources" onPress={() => router.push("/(tabs)/sources")} /></Section> : null}

      {section === "appearance" ? <><Section label="Theme">
        <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
          <ChoiceOption label="Light" selected={prefs.theme === "warm"} onPress={() => { if (prefs.theme === "warm") return; const done = feedback.capture(); void setTheme("warm").then(() => done("selection")).catch(() => notifyUser("Couldn’t save appearance", "Try again in a moment.")); }} leading={<Sun size={18} color={prefs.theme === "warm" ? palette.active : palette.inkMuted} />} style={styles.appearanceChoice} />
          <ChoiceOption label="Dark" selected={prefs.theme === "ink"} onPress={() => { if (prefs.theme === "ink") return; const done = feedback.capture(); void setTheme("ink").then(() => done("selection")).catch(() => notifyUser("Couldn’t save appearance", "Try again in a moment.")); }} leading={<Moon size={18} color={prefs.theme === "ink" ? palette.active : palette.inkMuted} />} style={styles.appearanceChoice} />
        </View>

      </Section>
      <Section label="Accent color">
        <View style={styles.accentRow} accessibilityRole="radiogroup" accessibilityLabel="Accent color">
          {accentOptions.map((option) => {
            const selected = prefs.accent === option.id;
            const swatch = createPalette(isDark, option.id).accent;
            return (
              <ChoiceOption key={option.id} label={option.label} selected={selected} onPress={() => { if (prefs.accent === option.id) return; const done = feedback.capture(); void setAccent(option.id).then(() => done("selection")).catch(() => notifyUser("Couldn’t save appearance", "Try again in a moment.")); }} variant="ruled" style={styles.accentChoice} accessibilityLabel={`${option.label} accent`} leading={<View style={[styles.swatch, { backgroundColor: swatch }]} />} />
            );
          })}
        </View>
      </Section>

      <Section label="Viewing room">
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={type.body}>House lights</Text>
            <Text style={styles.supporting}>Dim the viewing screen during playback. Bring the lights up when you finish.</Text>
          </View>
          <Switch accessibilityLabel="House lights" testID="settings-house-lights"
            trackColor={{ false: palette.surfaceDim, true: palette.active }} thumbColor={palette.surfaceHigh} ios_backgroundColor={palette.surfaceDim}
            value={prefs.houseLights} onValueChange={value => {
              if (value === prefs.houseLights) return;
              const acknowledge = feedback.capture();
              void setHouseLights(value).then(() => acknowledge("selection")).catch(() => notifyUser("Couldn’t save house lights", "Try again in a moment."));
            }} />
        </View>
      </Section>
      {Platform.OS !== "web" && <Section label="Touch feedback">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 48 }}>
          <View style={styles.flex}><Text style={type.body}>Haptic feedback</Text><Text style={styles.supporting}>For all profiles on this device.</Text></View>
          <Switch trackColor={{ false: palette.surfaceDim, true: palette.active }} thumbColor={palette.surfaceHigh} ios_backgroundColor={palette.surfaceDim} value={haptics.enabled} disabled={!haptics.ready || hapticsBusy} accessibilityLabel="Haptic feedback" onValueChange={(value) => { setHapticsBusy(true); void setFeedbackEnabled(value).then(() => { if (value) feedback.selection(); }).catch(() => notifyUser("Couldn’t save touch feedback", "Try again in a moment.")).finally(() => setHapticsBusy(false)); }} />
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
      <View style={styles.helpGroups}>
        <SettingsGroup label="Using Frame">{HELP_TOPICS.filter(topic => weeklyAvailable || topic.id !== "interests").map(topic =>
          <SettingsRow key={topic.id} grouped last={topic.id === "requests"} title={topic.title} onPress={() => router.push({ pathname: "/help/[topic]", params: { topic: topic.id } })} />
        )}</SettingsGroup>
        <SettingsGroup label="Setup & troubleshooting">
          <SettingsRow grouped title="Revisit setup" onPress={() => router.push("/welcome-preview")} testID="preview-welcome" />
          <SettingsRow grouped last title="Device diagnostics" onPress={() => router.push("/diagnostics")} testID="open-diagnostics" />
        </SettingsGroup>
      </View>
      <Section label="About Frame">
        <Text style={styles.version}>Version {Constants.expoConfig?.version ?? "1.0.0"}{Platform.OS === "android" && Constants.expoConfig?.android?.versionCode ? ` · Build ${Constants.expoConfig.android.versionCode}` : ""}</Text>
        <Text style={styles.version}>Empty frames illustration by Yu luck, from the Noun Project.</Text>
      </Section>
      </> : null}
      <FullResetModal visible={fullResetOpen} onClose={() => setFullResetOpen(false)} />
    </ScrollView>
  );
}

function Section({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return <View style={styles.section}>{label ? <Heading style={type.caption}>{label}</Heading> : null}{hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}<View style={(label || hint) ? styles.sectionContent : undefined}>{children}</View></View>;
}


function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    helpGroups: { paddingHorizontal: spacing.page, gap: spacing.lg },
    screen: { flex: 1, backgroundColor: "transparent" },
    flex: { flex: 1, minWidth: 0 },
    section: { paddingHorizontal: spacing.page, paddingTop: spacing.md, paddingBottom: spacing.lg },
    sectionHint: { ...type.bodySoft, marginTop: spacing.xs },
    sectionContent: { marginTop: spacing.md },
    supporting: { ...type.bodySoft, color: palette.inkMuted, marginTop: 2 },
    accountBlock: { gap: spacing.sm },
    choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 },
    appearanceChoice: { flexGrow: 1, flexBasis: 118, paddingHorizontal: spacing.md },
    accentRow: { backgroundColor: palette.surfaceHigh, borderRadius: radii.card, borderCurve: "continuous", overflow: "hidden" },
    accentChoice: { paddingHorizontal: spacing.md, borderRadius: 0 },
    swatch: { width: 24, height: 24, borderRadius: 12 },
    version: { ...type.caption, color: palette.inkMuted, marginBottom: spacing.sm },
  });
}
