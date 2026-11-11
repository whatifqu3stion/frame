import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ArrowRight, Plus } from "lucide-react-native";
import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

// Original frame outlines by Yu luck, from the Noun Project.
const frames = [
  "M49,42H14v27h35V42z M45,65H18V46h27V65z",
  "M36,89h34V73H36V89z M40,77h26v8H40V77z",
  "M53,51h25V26H53V51z M57,30h17v17H57V30z",
  "M30,38h19V12H30V38z M34,16h11v18H34V16z",
  "M53,69h39V55H53V69z M57,59h31v6H57V59z",
].join(" ");

type Action = { label: string; onPress(): void; prominentAdd?: boolean; testID?: string };

export function CollectionAction({ label, onPress, prominentAdd, testID }: Action) {
  const { palette, type } = useFrameTheme();
  return <PrimaryAction depth={palette.primaryButtonDepth} onPress={onPress} testID={testID}
    style={({ pressed }) => [styles.button, prominentAdd && styles.prominent, { backgroundColor: palette.accentDeep }, pressed && styles.pressed]}>
    {prominentAdd && <Plus size={22} color={palette.onDark} />}
    <Text style={[type.label, prominentAdd && styles.prominentLabel, { color: palette.onDark }]}>{label}</Text>
    {!prominentAdd && <ArrowRight size={16} color={palette.onDark} />}
  </PrimaryAction>;
}

export default function CollectionPrompt({ caption, action }: { caption: string; action?: Action }) {
  const { isDark, palette, type } = useFrameTheme();
  return <View style={styles.group}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={80} height={80} viewBox="10 8 86 85">
        <Path d={frames} fill={isDark ? palette.onProgrammeSoft : palette.programme} opacity={isDark ? 0.34 : 0.29} />
      </Svg>
    </View>
    <Text style={[type.bodySoft, styles.caption]}>{caption}</Text>
    {action && <CollectionAction {...action} />}
  </View>;
}

const styles = StyleSheet.create({
  group: { alignItems: "center", paddingTop: spacing.lg },
  button: { alignSelf: "stretch", minHeight: 48, marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.control, gap: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  prominent: { minHeight: 60 },
  prominentLabel: { fontSize: 17, lineHeight: 24 },
  pressed: { opacity: 0.74 },
  caption: { marginTop: spacing.md, fontSize: 15, lineHeight: 22, textAlign: "center" },
});
