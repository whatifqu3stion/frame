import Text from "@/components/FrameText";
import { useApp } from "@/providers/AppProvider";
import { Link } from "expo-router";
import { useMemo } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

const HELP_LINKS = [
  { label: "YouTube Terms of Service", url: "https://www.youtube.com/t/terms" },
];

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Frame's role",
    body: "Frame is an independent app for intentionally watching YouTube videos. YouTube hosts and controls its content, player, availability, advertising, captions, and playback restrictions. Your use of YouTube content remains subject to YouTube's terms.",
  },
  {
    title: "Using Frame responsibly",
    body: "You are responsible for the links, creators, and videos you choose to add or watch. Do not use Frame to infringe another person's rights, bypass access controls, interfere with the service, or make abusive automated requests.",
  },
  {
    title: "Content and availability",
    body: "Videos and creators may be removed, made private, restricted by age or region, or disabled for playback outside YouTube. Frame cannot guarantee that third-party content or every app feature will always remain available without interruption.",
  },
  {
    title: "Full access and provider usage",
    body: "This edition includes the full Frame app without subscription tiers or purchases. You supply your own YouTube and optional Gemini keys. You are responsible for your provider account, API restrictions, usage quotas, and any provider charges. AI suggestions can be inaccurate; source verification confirms existence, not quality, safety, or suitability. Review sources before following them.",
  },
  {
    title: "Your local library",
    body: "Your Frame library is stored on your current device. Deleting Frame, clearing its data, or losing access to the device may permanently remove that library. This edition does not include cloud backup.",
  },
  {
    title: "Changes to Frame or these terms",
    body: "Frame may change as the product improves. If these terms change materially, they will be updated with a new effective date and the change will be presented before it applies to future use.",
  },
];

export default function TermsScreen() {
  const { palette, type } = useFrameTheme();
  const { googleConfigured, googleConnected } = useApp();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={type.caption}>Frame</Text>
      <Text accessibilityRole="header" style={styles.title}>Terms of Use</Text>
      <Text style={styles.updated}>Effective October 20, 2026</Text>
      <Text style={styles.intro}>By using Frame, you agree to use the app lawfully and respect the services and content it helps you access.</Text>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Service help</Text>
        {HELP_LINKS.map(({ label, url }) => <Pressable key={url} accessibilityRole="link" accessibilityHint="Opens your browser" onPress={() => { void Linking.openURL(url).catch(() => Alert.alert("Couldn’t open link", "Try again when your browser is available.")); }} style={{ minHeight: 48, justifyContent: "center", paddingVertical: spacing.sm }}><Text style={[type.label, { color: palette.active }]}>{label}</Text></Pressable>)}
      </View>
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

