import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import { boundedReading } from "@/constants/layout";
import { useApprovalRequestCounts } from "@/hooks/useApprovalRequestCounts";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import Heading from "@/components/Heading";
import SettingsRow from "@/components/SettingsRow";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProfileControlsModal from "@/components/ProfileControlsModal";
import ScreenHeader from "@/components/ScreenHeader";
import { SETTINGS_TITLES, type SettingsSection } from "@/constants/settings";
import { accentOptions, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";

export default function SettingsScreen() {
  const { type } = useFrameTheme();
  const keyStatus = useProviderKeyStatus();
  const insets = useSafeAreaInsets();
  const { bottomBarHeight } = useNavigationLayout();
  const { activeProfileId, interests, prefs, googleConnected, googleConfigured, requestOwnerAuthorization } = useApp();
  const requestCounts = useApprovalRequestCounts();
  const pendingCount = Object.values(requestCounts.data ?? {}).reduce((total, count) => total + count, 0);
  const [profileControlsOpen, setProfileControlsOpen] = useState(false);
  const { busy, run } = useScreenAction(activeProfileId);
  const openProfiles = () => {
    void run(() => requestOwnerAuthorization(), (authorized) => {
      if (authorized) setProfileControlsOpen(true);
    }, () => Alert.alert("Couldn’t open profiles", "Try again. Protected settings remain locked."));
  };
  const open = (section: SettingsSection) => router.push({ pathname: "/settings/[section]", params: { section } });
  const interestSummary = interests.length
    ? `${interests.slice(0, 2).map((item) => item.name).join(", ")}${interests.length > 2 ? ` and ${interests.length - 2} more` : ""}`
    : "Choose topics for weekly source picks";
  const keySummary = keyStatus.isPending ? "Checking setup…"
    : keyStatus.isError ? "Setup status unavailable"
    : !keyStatus.data?.available ? (Platform.OS === "web" ? "Key setup is available in the mobile app" : "Secure storage unavailable · Tap to retry")
    : !keyStatus.data.youtube ? "YouTube key needed · Gemini optional"
    : keyStatus.data.gemini ? "YouTube & Gemini configured" : "YouTube configured · Gemini optional";
  const appearanceSummary = `${prefs.theme === "ink" ? "Dark" : "Light"} · ${accentOptions.find((option) => option.id === prefs.accent)?.label ?? "Default accent"}`;

  return <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + spacing.xl }}>
    <View style={styles.page}>
      <ScreenHeader title="Settings" />
      <View style={styles.group}>
      <Heading style={[type.heading, styles.groupTitle]}>Your experience</Heading>
      <SettingsRow title="Profiles & boundaries" summary={pendingCount ? `${pendingCount} ${pendingCount === 1 ? "request" : "requests"} to review · Viewing limits & Owner PIN` : "Viewing limits, approvals & Owner PIN"} onPress={openProfiles} busy={busy} testID="open-profile-controls" />
      <SettingsRow title={SETTINGS_TITLES.today} summary={`Up to ${prefs.todayVideoCount} ${prefs.todayVideoCount === 1 ? "video" : "videos"} per day`} onPress={() => open("today")} testID="settings-today" />
      <SettingsRow title={SETTINGS_TITLES.interests} summary={interestSummary} onPress={() => open("interests")} testID="settings-interests" />
      <SettingsRow title={SETTINGS_TITLES.appearance} summary={appearanceSummary} onPress={() => open("appearance")} testID="settings-appearance" />
      </View>
      <View style={styles.group}>
      <Heading style={[type.heading, styles.groupTitle]}>Connections</Heading>
      <SettingsRow title={SETTINGS_TITLES.keys} summary={keySummary} onPress={() => open("keys")} testID="settings-keys" />
      {googleConnected || googleConfigured ? <SettingsRow title={SETTINGS_TITLES.google} summary={googleConnected ? "Connected · Choose subscriptions" : "Import subscriptions · Optional"} onPress={() => open("google")} testID="settings-google" /> : null}
      </View>
      <View style={styles.group}>
        <Heading style={[type.heading, styles.groupTitle]}>Privacy & support</Heading>
        <SettingsRow title={SETTINGS_TITLES.privacy} summary="Policies & device data" onPress={() => open("privacy")} testID="settings-privacy" />
        <SettingsRow title={SETTINGS_TITLES.about} summary="Using Frame, storage & support" onPress={() => open("about")} testID="settings-about" />
      </View>
    </View>
    <ProfileControlsModal visible={profileControlsOpen} onClose={() => setProfileControlsOpen(false)} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { ...boundedReading, paddingHorizontal: spacing.page },
  group: { marginTop: spacing.lg },
  groupTitle: { marginBottom: spacing.xs },
});
