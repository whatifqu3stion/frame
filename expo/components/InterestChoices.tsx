import { useFeedback } from "@/hooks/useFeedback";
import ChoiceOption from "@/components/ChoiceOption";
import { Lock } from "lucide-react-native";
import { Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { INTEREST_GROUPS, INTEREST_LIBRARY } from "@/constants/interests";
import { ONBOARDING_INTEREST_MAX } from "@/constants/productConfig";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { isInterestOptionDisabled } from "@/domain/interests";
import { useApp } from "@/providers/AppProvider";

export default function InterestChoices() {
  const touch = useFeedback();
  const { interests, toggleInterest } = useApp();
  const { type } = useFrameTheme();
  const ids = interests.map((item) => item.id);
  return <View style={{ gap: spacing.xl }}>
    <Text style={type.bodySoft} accessibilityLiveRegion="polite">{ids.length} of {ONBOARDING_INTEREST_MAX} selected · optional</Text>
    <GroupedInterestChoices selectedIds={ids} showLimitLock onToggle={(id) => { const done = touch.capture(); void toggleInterest(id).then((changed) => done("selection", changed)).catch(() => Alert.alert("Couldn’t save interests", "Try again in a moment.")); }} />
  </View>;
}

type GroupedInterestChoicesProps = {
  selectedIds: readonly string[];
  onToggle(id: string): void;
  busy?: boolean;
  showLimitLock?: boolean;
  accessibilityLabel?: string;
  limitHint?: string;
  testIDPrefix?: string;
};

export function GroupedInterestChoices({ selectedIds, onToggle, busy = false, showLimitLock = false, accessibilityLabel, limitHint = "Remove an interest before choosing another.", testIDPrefix }: GroupedInterestChoicesProps) {
  const { palette, type } = useFrameTheme();
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 360 || fontScale > 1.3;
  return <View style={styles.groups} accessibilityLabel={accessibilityLabel}>
    {INTEREST_GROUPS.map((group) => <View key={group.label}>
      <Text style={type.heading} accessibilityRole="header">{group.label}</Text>
      <View style={styles.choices}>
        {INTEREST_LIBRARY.filter((interest) => (group.ids as readonly string[]).includes(interest.id)).map((interest) => {
          const selected = selectedIds.includes(interest.id);
          const atLimit = isInterestOptionDisabled(selectedIds, interest.id, ONBOARDING_INTEREST_MAX);
          const disabled = busy || atLimit;
          return <ChoiceOption key={interest.id} label={interest.name} selected={selected} role="checkbox" variant="ruled" onPress={() => onToggle(interest.id)} disabled={disabled} accessibilityHint={atLimit ? limitHint : undefined} testID={testIDPrefix ? `${testIDPrefix}-${interest.id}` : undefined} style={[styles.choice, singleColumn && { flexBasis: "100%" }]} unselectedMark={atLimit && showLimitLock ? <Lock size={14} color={palette.inkMuted} /> : undefined} />;
        })}
      </View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  groups: { gap: spacing.xl },
  choices: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, marginTop: spacing.sm },
  choice: { flexGrow: 1, flexShrink: 1, flexBasis: "45%", paddingVertical: spacing.md },
});
