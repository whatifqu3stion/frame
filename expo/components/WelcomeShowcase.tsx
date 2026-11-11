import { StyleSheet, useWindowDimensions, View } from "react-native";
import Text from "@/components/FrameText";
import { fonts, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

const reasons = [
  { title: "Less slop.", detail: "Choose what interests you. Frame finds weekly picks around those topics." },
  { title: "Less scrolling.", detail: "Browse three picks at a time, each with a reason to watch." },
  { title: "No autoplay.", detail: "When a video ends, you decide whether to watch another." },
];

export default function WelcomeShowcase() {
  const { palette, type } = useFrameTheme();
  const { width } = useWindowDimensions();
  const compact = width < 480;

  return (
    <View style={styles.welcome}>
      <Text accessibilityRole="header" style={[type.title, compact ? styles.mobileTitle : styles.wideTitle]}>
        Do you control your video app, or does it control you?
      </Text>
      <View role="list" style={styles.reasons}>
        {reasons.map(({ title, detail }) => (
          <View key={title} role="listitem" style={styles.reason}>
            <View style={[styles.bullet, { backgroundColor: palette.active }]} />
            <View style={styles.copy}>
              <Text style={[type.body, styles.reasonTitle]}>{title}</Text>
              <Text style={[type.bodySoft, styles.detail]}>{detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: { flexGrow: 1, justifyContent: "center", paddingTop: spacing.md, paddingBottom: spacing.xl },
  mobileTitle: { fontSize: 36, lineHeight: 41 },
  wideTitle: { fontSize: 46, lineHeight: 53 },
  reasons: { maxWidth: 500, gap: spacing.md, marginTop: spacing.xl },
  reason: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 11 },
  copy: { flex: 1, gap: spacing.xs },
  reasonTitle: { fontFamily: fonts.sansSemibold, fontSize: 21, lineHeight: 27 },
  detail: { fontSize: 18, lineHeight: 25 },
});
