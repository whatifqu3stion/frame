import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Information kept on your device",
    body: "Frame stores your saved videos (including former Watch Later links), named sessions, followed creators, viewing progress, interests, preferences, and recent searches on your device. Frame does not use this information for behavioral advertising or to build an endless personalized feed.",
  },
  {
    title: "When you use online features",
    body: "Frame sends links and video or creator identifiers only when needed to resolve or play content you explicitly request. Live YouTube search and personalized discovery are disabled. YouTube may also receive standard device and network information when its official player loads.",
  },
  {
    title: "Optional account connection",
    body: "If you choose to connect Google, Frame receives your email address and stores the sign-in credential securely on your device. Frame does not read or automatically follow your YouTube subscriptions in this version. Disconnecting revokes access before removing the local credential; manually selected sources remain in your library.",
  },
  {
    title: "Premium purchases",
    body: "Premium purchases and restores are handled by your app store and a subscription service. Frame receives the information needed to confirm whether Premium is active, but never receives your full payment-card details.",
  },
  {
    title: "Your controls",
    body: "You can disconnect your account or delete all on-device Frame data from Settings. Deleting local data does not cancel a subscription or remove purchase records held by your app store.",
  },
  {
    title: "Policy changes",
    body: "If Frame changes how it handles personal information, this policy will be updated with a new effective date. Material changes will be explained before they take effect.",
  },
];

export default function PrivacyScreen() {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={type.caption}>Frame</Text>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Effective August 30, 2026</Text>
      <Text style={styles.intro}>Frame is built around a private, on-device library. This policy explains what stays on your device, when information is shared to provide a feature, and the controls available to you.</Text>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.wall },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, maxWidth: 680, width: "100%", alignSelf: "center" },
  title: { ...type.title, marginTop: spacing.sm },
  updated: { ...type.caption, color: palette.inkMuted, marginTop: spacing.sm },
  intro: { ...type.body, color: palette.inkSoft, marginTop: spacing.xl, lineHeight: 25 },
  section: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: palette.border },
  heading: { ...type.heading, fontSize: 19 },
  body: { ...type.bodySoft, color: palette.inkSoft, marginTop: spacing.sm, lineHeight: 23 },
  });
}
