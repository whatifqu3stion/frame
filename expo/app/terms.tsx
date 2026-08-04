import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

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
    title: "Frame Premium",
    body: "Premium subscriptions are purchased through the App Store or Play Store at the price and billing period shown before purchase. Subscriptions renew automatically unless you cancel through your store settings. Restore Purchases checks the store account currently signed in on your device.",
  },
  {
    title: "Your local library",
    body: "Your Frame library is stored on your current device. Deleting Frame, clearing its data, or losing access to the device may permanently remove that library. A Premium subscription does not include cloud backup unless Frame clearly says otherwise.",
  },
  {
    title: "Changes to Frame or these terms",
    body: "Frame may change as the product improves. If these terms change materially, they will be updated with a new effective date and the change will be presented before it applies to future use.",
  },
];

export default function TermsScreen() {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={type.caption}>Frame</Text>
      <Text style={styles.title}>Terms of Use</Text>
      <Text style={styles.updated}>Effective August 4, 2026</Text>
      <Text style={styles.intro}>By using Frame, you agree to use the app lawfully and respect the services and content it helps you access.</Text>
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
