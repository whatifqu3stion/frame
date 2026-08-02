import { ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, spacing, type } from "@/constants/theme";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "What stays on your device",
    body: "Frame stores your saved videos, Watch Later items, queues, follows, resume positions, interests, preferences, and recent searches locally. Frame does not use viewing or completion history to personalize discovery.",
  },
  {
    title: "YouTube",
    body: "When you play, search for, or resolve YouTube content, the requested video, creator, link, or search term is sent to YouTube through its player or Frame's protected metadata service. YouTube may process device and network information under Google's privacy terms.",
  },
  {
    title: "Optional Google connection",
    body: "If you choose Google sign-in, Google provides your email and YouTube subscriptions. The access credential is kept in secure device storage. Disconnecting asks Google to revoke access before Frame removes the credential; imported creators remain as local follows.",
  },
  {
    title: "Premium purchases",
    body: "RevenueCat and your App Store or Play Store account process subscription status, purchases, and restores. Frame receives entitlement status, not your full payment-card details. Store purchase records remain associated with your store account after local data is deleted.",
  },
  {
    title: "Deletion and web preview",
    body: "Delete all on-device data from Settings to remove Frame's local library, preferences, searches, follows, and Google credential. The browser version is a temporary preview and its local library may disappear when the page refreshes.",
  },
  {
    title: "Diagnostics and future digest",
    body: "Frame does not currently use viewing history for ads or personalization. If privacy-preserving diagnostics or the weekly digest are introduced, Frame will disclose the exact data sent and provide the controls described in the product before enabling them.",
  },
];

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={type.caption}>Frame</Text>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Effective August 2, 2026</Text>
      <Text style={styles.intro}>Frame is designed around a local library and intentional playback. Some features still require clearly disclosed third-party services.</Text>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.wall },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, maxWidth: 680, width: "100%", alignSelf: "center" },
  title: { ...type.title, marginTop: spacing.sm },
  updated: { ...type.caption, color: palette.inkMuted, marginTop: spacing.sm },
  intro: { ...type.body, color: palette.inkSoft, marginTop: spacing.xl, lineHeight: 25 },
  section: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: palette.border },
  heading: { ...type.heading, fontSize: 19 },
  body: { ...type.bodySoft, color: palette.inkSoft, marginTop: spacing.sm, lineHeight: 23 },
});
