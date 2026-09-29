import { Check, Lock } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { ONBOARDING_INTEREST_MAX } from "@/constants/productConfig";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { isInterestOptionDisabled } from "@/domain/interests";
import { useApp } from "@/providers/AppProvider";

export default function InterestChoices() {
  const { interests, toggleInterest } = useApp();
  const { palette, type } = useFrameTheme();
  const ids = interests.map((item) => item.id);
  return <View style={{ gap: 12 }}>
    <Text style={type.bodySoft} accessibilityLiveRegion="polite">{ids.length} of {ONBOARDING_INTEREST_MAX} selected · optional</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {INTEREST_LIBRARY.map((interest) => {
        const selected = ids.includes(interest.id);
        const disabled = isInterestOptionDisabled(ids, interest.id, ONBOARDING_INTEREST_MAX);
        return <Pressable key={interest.id} onPress={() => toggleInterest(interest.id)} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} accessibilityHint={disabled ? "Remove an interest before choosing another." : undefined} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: selected ? palette.active : palette.borderSoft, backgroundColor: selected ? palette.activeSoft : palette.surface, opacity: disabled ? 0.5 : 1 }}>
          <Text style={[type.label, { color: selected ? palette.active : palette.ink }]}>{interest.name}</Text>{selected ? <Check size={16} color={palette.active} /> : disabled ? <Lock size={14} color={palette.inkMuted} /> : null}
        </Pressable>;
      })}
    </View>
  </View>;
}
