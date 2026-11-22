import Text from "@/components/FrameText";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { Pressable, View } from "react-native";

export const SESSION_PAGE_SIZE = 20;
export function collectionPage(page: number, count: number) {
  return Math.max(0, Math.min(page, Math.ceil(count / SESSION_PAGE_SIZE) - 1));
}

export default function CollectionPager({ page, count, onChange }: { page: number; count: number; onChange(page: number): void }) {
  const { palette, type } = useFrameTheme();
  if (count <= SESSION_PAGE_SIZE) return null;
  const current = collectionPage(page, count);
  return <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.sm }}>
    <Text style={type.bodySoft} accessibilityLiveRegion="polite">{current * SESSION_PAGE_SIZE + 1}–{Math.min(count, (current + 1) * SESSION_PAGE_SIZE)} of {count} sessions</Text>
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      {[{ label: "Previous", delta: -1, disabled: current === 0 }, { label: "Next", delta: 1, disabled: (current + 1) * SESSION_PAGE_SIZE >= count }].map(action => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={`${action.label} sessions`} accessibilityState={{ disabled: action.disabled }} disabled={action.disabled} onPress={() => onChange(current + action.delta)} style={{ minHeight: 48, minWidth: 48, justifyContent: "center", opacity: action.disabled ? 0.45 : 1 }}>
        <Text style={[type.label, { color: palette.active }]}>{action.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
