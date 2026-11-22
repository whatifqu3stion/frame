import { StyleSheet, useWindowDimensions, View } from "react-native";
import Text from "@/components/FrameText";
import WelcomePhone from "@/components/WelcomePhone";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function WelcomeShowcase({ onCompletionChange }: { onCompletionChange(complete: boolean): void }) {
  const { type } = useFrameTheme();
  const { width } = useWindowDimensions();
  return <View style={styles.welcome}>
    <Text accessibilityRole="header" style={[type.title, width < 480 ? styles.mobileTitle : styles.wideTitle]}>
      Do you control your video app, or does it control you?
    </Text>
    <WelcomePhone onCompletionChange={onCompletionChange} />
    <Text style={[type.bodySoft, styles.detail]}>There’s great work buried in the slop. Frame gives you a quieter place to find it, watch it, and leave when you’re ready.</Text>
  </View>;
}
const styles = StyleSheet.create({
  welcome: { flexGrow: 1, justifyContent: "center", gap: spacing.md, paddingVertical: spacing.md },
  mobileTitle: { fontSize: 36, lineHeight: 42 }, wideTitle: { fontSize: 46, lineHeight: 54 },
  detail: { fontSize: 18, lineHeight: 26, maxWidth: 490 },
});
