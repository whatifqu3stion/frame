import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProfileControlsModal from "@/components/ProfileControlsModal";
import ScreenHeader from "@/components/ScreenHeader";
import { FEATURE_FLAGS, IS_CLOSED_BETA } from "@/constants/config";
import { SETTINGS_TITLES, type SettingsSection } from "@/constants/settings";
import { accentOptions, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useFrameTheme();
  const { activeProfileId, interests, prefs, googleConnected, googleConfigured, requestOwnerAuthorization, isPremium } = useApp();
  const [profileControlsOpen, setProfileControlsOpen] = useState(false);
  const { busy, run } = useScreenAction(activeProfileId);
  const openProfiles = () => {
    void run(() => requestOwnerAuthorization(), (authorized) => {
      if (authorized) setProfileControlsOpen(true);
    }, () => Alert.alert("Couldn’t open profiles", "Try again. Protected settings remain locked."));
  };
  const open = (section: SettingsSection) => router.push({ pathname: "/settings/[section]", params: { section } });
  const interestSummary = interests.length
    ? `${interests.slice(0, 2).map((item) => item.name).join(", ")}${interests.length > 2 ? ` +${interests.length - 2}` : ""}`
    : "Choose topics for weekly source picks";
  const appearanceSummary = `${prefs.theme === "ink" ? "Dark" : "Light"} · ${accentOptions.find((option) => option.id === prefs.accent)?.label ?? "Default accent"} · Haptics`;

  return <ScrollView style={{ flex: 1, backgroundColor: palette.wall }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
    <View style={styles.page}>
      <ScreenHeader title="Settings" />
      <SettingsRow title="Profiles & boundaries" summary="Viewing limits, approvals & Owner PIN" onPress={openProfiles} busy={busy} testID="open-profile-controls" />
      <SettingsRow title={SETTINGS_TITLES.interests} summary={interestSummary} onPress={() => open("interests")} testID="settings-interests" />
      <SettingsRow title={SETTINGS_TITLES.appearance} summary={appearanceSummary} onPress={() => open("appearance")} testID="settings-appearance" />
      <SettingsRow title={SETTINGS_TITLES.google} summary={googleConnected ? "Connected · Import or disconnect" : googleConfigured ? "Import subscriptions · Optional" : "Unavailable in this build"} onPress={() => open("google")} testID="settings-google" />
      {FEATURE_FLAGS.paidAccess ? <SettingsRow title={SETTINGS_TITLES.premium} summary={isPremium ? "Active · Plans & restore" : "Plans & restore purchases"} onPress={() => open("premium")} testID="settings-premium" /> : null}
      <View style={styles.secondary}>
        <SettingsRow title={SETTINGS_TITLES.privacy} summary="Privacy policy, terms & erase data" onPress={() => open("privacy")} testID="settings-privacy" />
        <SettingsRow title={SETTINGS_TITLES.about} summary={["About Frame", FEATURE_FLAGS.demoPaywall && !FEATURE_FLAGS.paidAccess ? "welcome preview" : null, IS_CLOSED_BETA ? "beta support" : null].filter(Boolean).join(" · ")} onPress={() => open("about")} testID="settings-about" />
      </View>
    </View>
    <ProfileControlsModal visible={profileControlsOpen} onClose={() => setProfileControlsOpen(false)} />
  </ScrollView>;
}

function SettingsRow({ title, summary, onPress, busy = false, testID }: { title: string; summary: string; onPress(): void; busy?: boolean; testID: string }) {
  const { palette, type } = useFrameTheme();
  return <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} testID={testID} style={({ pressed }) => [styles.row, { borderBottomColor: palette.borderSoft }, pressed && styles.pressed]}>
    <View style={styles.copy}><Text style={type.label}>{title}</Text><Text style={[type.bodySoft, styles.summary]}>{summary}</Text></View>
    {busy ? <ActivityIndicator color={palette.active} /> : <ChevronRight size={18} color={palette.inkMuted} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: spacing.page },
  row: { minHeight: 76, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, minWidth: 0 },
  summary: { marginTop: spacing.xs },
  secondary: { marginTop: spacing.lg },
  pressed: { opacity: 0.72 },
});
