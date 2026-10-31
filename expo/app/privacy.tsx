import Text from "@/components/FrameText";
import { useApp } from "@/providers/AppProvider";
import { Link } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Information kept on your device",
    body: "Frame stores your saved videos, named sessions, followed creators, viewing progress, interests, preferences, and recent searches on your device. Frame does not use this information for behavioral advertising or to build an endless personalized feed.",
  },
  {
    title: "When you use online features",
    body: "Frame sends links and video or creator identifiers when needed to resolve content, load videos from sources you follow, or play a video you choose. Looking up sources and their uploaded videos uses your YouTube key directly with Google. Weekly suggestions are generated only when the Owner requests them, verified with YouTube, and stored locally for the current week. When you submit a channel search or search inside a channel, your query and chosen filters are sent directly to YouTube. Frame has no general video search. YouTube may also receive standard device and network information when its official player loads.",
  },
  {
    title: "Optional account connection",
    body: "If you choose to connect Google, Frame receives your email address and stores the sign-in credential securely on your device. Frame reads a bounded page of subscriptions only when you open the import screen and follows only sources you select. Disconnecting revokes access before removing the local credential; selected sources remain in your library.",
  },
  {
    title: "Your provider keys and AI suggestions",
    body: "YouTube and Gemini keys are stored in secure storage on your device and sent directly to the corresponding Google API over HTTPS. Frame does not send these keys to its backend or include them in support status. Keys are shared by profiles on this device and managed by the Owner. When you choose Generate picks, Gemini receives a weekly focus of your selected interest topics (including any custom topic labels) and public channel and video metadata to assess recommendation quality; it does not receive your viewing history, profile name, or library. Provider data terms apply to these requests.",
  },
  {
    title: "Your controls",
    body: "You can disconnect your account or delete all on-device Frame data from Settings. Erasing all Frame data removes both provider keys from this device. Removing a key does not revoke it with Google; revoke it in your provider account when needed.",
  },
  {
    title: "Policy changes",
    body: "If Frame changes how it handles personal information, this policy will be updated with a new effective date. Material changes will be explained before they take effect.",
  },
];

export default function PrivacyScreen() {
  const { palette, type } = useFrameTheme();
  const { googleConfigured, googleConnected } = useApp();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={type.caption}>Frame</Text>
      <Text accessibilityRole="header" style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Effective October 20, 2026</Text>
      <Text style={styles.intro}>Frame is built around a private, on-device library. This policy explains what stays on your device, when information is shared to provide a feature, and the controls available to you.</Text>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
      <Link href="/settings/privacy" asChild><Pressable accessibilityRole="button" style={{ minHeight: 48, marginTop: spacing.lg, justifyContent: "center" }}><Text style={[type.label, { color: palette.active }]}>Open device data controls</Text></Pressable></Link>
      {googleConfigured || googleConnected ? <Link href="/settings/google" asChild><Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }}><Text style={[type.label, { color: palette.active }]}>Manage Google connection</Text></Pressable></Link> : null}
    </ScrollView>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, maxWidth: 680, width: "100%", alignSelf: "center" },
  title: { ...type.title, marginTop: spacing.sm },
  updated: { ...type.caption, color: palette.inkMuted, marginTop: spacing.sm },
  intro: { ...type.body, color: palette.inkSoft, marginTop: spacing.xl, lineHeight: 25 },
  section: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: palette.border },
  heading: { ...type.heading, fontSize: 19 },
  body: { ...type.bodySoft, color: palette.inkSoft, marginTop: spacing.sm, lineHeight: 23 },
  });
}

