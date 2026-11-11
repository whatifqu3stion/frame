import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Text from "@/components/FrameText";
import InfoDisclosure from "@/components/InfoDisclosure";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

const weeklyPicksNotes = [
  "Frame looks for videos of 4 minutes or longer that fit your interests. New choices shape your next edition.",
  "Start a search for up to 12 creators each week. Browse 3 at a time.",
  "If a search stops early, Frame keeps reviewed picks. If it finds none, you can retry once.",
  "Each search can use up to 25 Gemini requests plus YouTube checks. Charges may apply.",
];

export default function WeeklyPicksInfo({ anchor, onSetUpKeys }: { anchor: ReactNode; onSetUpKeys?(): void }) {
  const { palette, type } = useFrameTheme();
  return <InfoDisclosure label="How weekly picks work" anchor={anchor}>
    <View role="list" style={{ gap: spacing.sm }}>
      {weeklyPicksNotes.map((note) => <View key={note} role="listitem"><Text style={type.bodySoft}>{note}</Text></View>)}
    </View>
    <Pressable accessibilityRole="button" onPress={onSetUpKeys ?? (() => router.push("/settings/keys"))}
      style={{ minHeight: 48, alignSelf: "flex-start", justifyContent: "center" }}>
      <Text style={[type.label, { color: palette.active }]}>Manage API keys</Text>
    </Pressable>
  </InfoDisclosure>;
}
