import { Info } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = { label: string; expanded: boolean; onPress(): void; onProgramme?: boolean; testID?: string };

export default function InfoButton({ label, expanded, onPress, onProgramme, testID }: Props) {
  const { palette } = useFrameTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }}
    aria-expanded={expanded} onPress={onPress} style={styles.button} testID={testID}>
    <Info size={15} strokeWidth={1.6} color={onProgramme ? (expanded ? palette.onProgramme : palette.onProgrammeSoft) : expanded ? palette.active : palette.inkMuted} />
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, flexShrink: 0, justifyContent: "center", alignItems: "flex-start", paddingLeft: spacing.sm },
});
