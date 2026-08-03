import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Frame's role",
    body: "Frame is an independent interface for intentionally watching YouTube videos. YouTube hosts and controls the content, player, availability, advertising, captions, and playback restrictions. Using YouTube remains subject to YouTube's terms.",
  },
  {
    title: "Your choices",
    body: "You are responsible for the links, creators, and videos you choose to add or watch. Do not use Frame to violate another person's rights, bypass access controls, or automate abusive requests.",
  },
  {
    title: "Availability",
    body: "Videos and creators may be removed, made private, blocked by region or age, or disabled for embedding. Frame will show those states honestly when they are known, but cannot guarantee that third-party content remains available.",
  },
  {
    title: "Frame Premium",
    body: "Premium subscriptions are offered through the App Store or Play Store at the localized price shown before purchase. Subscriptions renew automatically unless cancelled through the relevant store. Restore Purchases checks the current store account. Features may be unavailable while entitlement status cannot be verified.",
  },
  {
    title: "Local data",
    body: "Your Frame library is primarily stored on the current device. Removing the app or deleting local data may permanently remove that library. The web build is a preview and does not promise durable storage or production purchase support.",
  },
  {
    title: "Changes",
    body: "Frame may update these terms as the product changes. Material changes should be presented with a new effective date before they apply to new use.",
  },
];

export default function TermsScreen() {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={type.caption}>Frame</Text>
      <Text style={styles.title}>Terms of Use</Text>
      <Text style={styles.updated}>Effective August 2, 2026</Text>
      <Text style={styles.intro}>By using Frame, you agree to use the app and its third-party services lawfully and intentionally.</Text>
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
