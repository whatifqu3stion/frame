import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import { boundedReading } from "@/constants/layout";
import { useApprovalRequestCounts } from "@/hooks/useApprovalRequestCounts";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { notifyUser } from "@/services/notifyUser";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import SettingsGroup from "@/components/SettingsGroup";
import TodaySelectionSetting from "@/components/TodaySelectionSetting";
import { BookOpen, Compass, KeyRound, ListVideo, Palette, ShieldCheck, UsersRound, Inbox } from "lucide-react-native";
import SettingsRow from "@/components/SettingsRow";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProfileControlsModal from "@/components/ProfileControlsModal";
import ScreenHeader from "@/components/ScreenHeader";
import { SETTINGS_TITLES, type SettingsSection } from "@/constants/settings";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";

export default function SettingsScreen() {
  const { palette } = useFrameTheme();
  const keyStatus = useProviderKeyStatus();
  const insets = useSafeAreaInsets();
  const { bottomBarHeight } = useNavigationLayout();
  const { activeProfileId, activeProfile, profiles, prefs, interests, hasLegacyGoogleConnection, requestOwnerAuthorization } = useApp();
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
  const keys = keyStatus.data;
  const connectionValue = activeProfile?.role !== "owner" ? "Owner managed"
    : keyStatus.isPending ? "Checking…" : keyStatus.isError ? "Unavailable"
    : !keys?.available ? (Platform.OS === "web" ? "On your phone" : "Unavailable")
    : keys.youtube && keys.gemini ? "Both keys saved" : keys.youtube ? "YouTube key saved" : keys.gemini ? "Gemini key saved" : "Set up";
  const icon = (Icon: typeof Palette) => <Icon size={19} strokeWidth={1.65} color={palette.inkSoft} />;

  return <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, bottomBarHeight) + spacing.xl }}>
    <View style={styles.page}>
      <ScreenHeader title="Settings" />
      <SettingsGroup label="Viewing">
        <TodaySelectionSetting compact />
        {activeProfile?.role !== "managed" && <SettingsRow grouped leading={icon(Compass)} title="Weekly interests" value={interests.length ? `${interests.length} ${interests.length === 1 ? "topic" : "topics"}` : "Choose"} onPress={() => open("interests")} testID="settings-interests" />}
        <SettingsRow grouped last leading={icon(Palette)} title={SETTINGS_TITLES.appearance} value={prefs.theme === "ink" ? "Dark" : "Light"} onPress={() => open("appearance")} testID="settings-appearance" />
      </SettingsGroup>
      <SettingsGroup label="Profiles & connections">
        {profiles.filter((profile) => profile.role === "managed" && (requestCounts.data?.[profile.id] ?? 0) > 0).map((profile) => {
          const count = requestCounts.data![profile.id];
          return <SettingsRow grouped leading={icon(Inbox)} key={profile.id} title={`Requests for ${profile.name}`} value={`${count} pending`} onPress={() => openProfiles(profile.id)} busy={busy} />;
        })}
        <SettingsRow grouped leading={icon(UsersRound)} title="Profiles & viewing limits" onPress={() => openProfiles()} busy={busy} testID="open-profile-controls" />
        <SettingsRow grouped leading={icon(ListVideo)} title={SETTINGS_TITLES.channels} onPress={() => open("channels")} testID="settings-transfer-channels" />
        <SettingsRow grouped last={!hasLegacyGoogleConnection} leading={icon(KeyRound)} title={SETTINGS_TITLES.keys} value={connectionValue} onPress={() => open("keys")} testID="settings-keys" />
        {hasLegacyGoogleConnection ? <SettingsRow grouped last leading={icon(ListVideo)} title={SETTINGS_TITLES.google} onPress={() => open("google")} testID="settings-google" /> : null}
      </SettingsGroup>
      <SettingsGroup label="Support">
        <SettingsRow grouped leading={icon(BookOpen)} title={SETTINGS_TITLES.about} onPress={() => open("about")} testID="settings-about" />
        <SettingsRow grouped last leading={icon(ShieldCheck)} title={SETTINGS_TITLES.privacy} onPress={() => open("privacy")} testID="settings-privacy" />
      </SettingsGroup>
    </View>
    <ProfileControlsModal returnFocusTarget={profileTrigger.current} initialReviewId={reviewProfileId} visible={profileControlsOpen} onClose={() => setProfileControlsOpen(false)} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { ...boundedReading, paddingHorizontal: spacing.page, gap: spacing.md },
});
