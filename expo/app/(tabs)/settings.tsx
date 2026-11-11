import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import { boundedReading } from "@/constants/layout";
import { useApprovalRequestCounts } from "@/hooks/useApprovalRequestCounts";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { notifyUser } from "@/services/notifyUser";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
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
  const { activeProfileId, activeProfile, profiles, prefs, googleConnected, googleConfigured, requestOwnerAuthorization } = useApp();
  const requestCounts = useApprovalRequestCounts();
  const [reviewProfileId, setReviewProfileId] = useState<string | null>(null);
  const profileTrigger = useRef<HTMLElement | null>(null);
  const [profileControlsOpen, setProfileControlsOpen] = useState(false);
  const { busy, run } = useScreenAction(activeProfileId);
  const openProfiles = (reviewId: string | null = null) => {
    if (Platform.OS === "web" && document.activeElement instanceof HTMLElement) profileTrigger.current = document.activeElement;
    void run(() => requestOwnerAuthorization(), (authorized) => {
      if (authorized) { setReviewProfileId(reviewId); setProfileControlsOpen(true); }
    }, () => notifyUser("Couldn’t open profiles", "Try again. Protected settings remain locked."));
  };
  const open = (section: SettingsSection) => router.push({ pathname: "/settings/[section]", params: { section } });
  const keySummary = activeProfile?.role !== "owner" ? "The Owner manages keys for this device" : keyStatus.isPending ? "Checking setup…"
    : keyStatus.isError ? "Setup status unavailable"
    : !keyStatus.data?.available ? (Platform.OS === "web" ? "API keys · Set up on your phone" : "Secure storage unavailable")
    : !keyStatus.data.youtube ? "YouTube key needed · Gemini optional"
    : keyStatus.data.gemini ? "YouTube & Gemini configured" : "YouTube configured · Gemini optional";
  const appearanceSummary = `${prefs.theme === "ink" ? "Dark" : "Light"} · ${accentOptions.find((option) => option.id === prefs.accent)?.label ?? "Default accent"}`;

  return <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + spacing.xl }}>
    <View style={styles.page}>
      <ScreenHeader title="Settings" />
      <View style={styles.group}>
        <Heading style={[type.heading, styles.groupTitle]}>Your viewing</Heading>
        <SettingsRow title={SETTINGS_TITLES.today} summary={`Up to ${prefs.todayVideoCount} ${prefs.todayVideoCount === 1 ? "video" : "videos"} in Today${activeProfile?.role === "managed" ? "" : " · Weekly interests"}`} onPress={() => open("today")} testID="settings-today" />
        <SettingsRow title={SETTINGS_TITLES.appearance} summary={appearanceSummary} onPress={() => open("appearance")} testID="settings-appearance" />
      </View>
      <View style={styles.group}>
        <Heading style={[type.heading, styles.groupTitle]}>Profiles &amp; connections</Heading>
        {profiles.filter((profile) => profile.role === "managed" && (requestCounts.data?.[profile.id] ?? 0) > 0).map((profile) => {
          const count = requestCounts.data![profile.id];
          return <SettingsRow key={profile.id} title={`Review ${count === 1 ? "request" : "requests"} for ${profile.name}`} summary={`${count} awaiting Owner review`} onPress={() => openProfiles(profile.id)} busy={busy} />;
        })}
        <SettingsRow title="Profiles & viewing limits" summary={Platform.OS === "web" ? "Manage profiles here. Set daily limits and review requests on your phone." : "Daily time limits, approval requests and the Owner PIN"} onPress={() => openProfiles()} busy={busy} testID="open-profile-controls" />
        <SettingsRow title={SETTINGS_TITLES.keys} summary={keySummary} onPress={() => open("keys")} testID="settings-keys" />
        {googleConnected || googleConfigured ? <SettingsRow title={SETTINGS_TITLES.google} summary={googleConnected ? "Google connected · Choose subscriptions" : "Choose channels from your Google account"} onPress={() => open("google")} testID="settings-google" /> : null}
      </View>
      <View style={styles.group}>
        <Heading style={[type.heading, styles.groupTitle]}>Support</Heading>
        <SettingsRow title={SETTINGS_TITLES.about} summary="Using Frame, setup and troubleshooting" onPress={() => open("about")} testID="settings-about" />
        <SettingsRow title={SETTINGS_TITLES.privacy} summary="Local data, privacy policy and terms" onPress={() => open("privacy")} testID="settings-privacy" />
      </View>
    </View>
    <ProfileControlsModal returnFocusTarget={profileTrigger.current} initialReviewId={reviewProfileId} visible={profileControlsOpen} onClose={() => setProfileControlsOpen(false)} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { ...boundedReading, paddingHorizontal: spacing.page },
  group: { marginTop: spacing.lg },
  groupTitle: { marginBottom: spacing.xs },
});
