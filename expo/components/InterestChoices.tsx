import Text from "@/components/FrameText";
import Heading from "@/components/Heading";
import { useFeedback } from "@/hooks/useFeedback";
import ChoiceOption from "@/components/ChoiceOption";
import CustomInterestInput from "./CustomInterestInput";
import { Alert, StyleSheet, View, useWindowDimensions } from "react-native";
import { INTEREST_GROUPS, INTEREST_LIBRARY } from "@/constants/interests";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { interestTopicFromId } from "@/domain/interests";
import { useApp } from "@/providers/AppProvider";

export default function InterestChoices() {
  const touch = useFeedback();
  const { interests, toggleInterest } = useApp();
  const { type } = useFrameTheme();
  const ids = interests.map((item) => item.id);
  return <View style={{ gap: spacing.xl }}>
    <Text style={type.bodySoft} accessibilityLiveRegion="polite">{ids.length} selected · optional</Text>
    <GroupedInterestChoices headingLevel={3} selectedIds={ids} onToggle={(id) => { const done = touch.capture(); void toggleInterest(id).then((changed) => done("selection", changed)).catch(() => Alert.alert("Couldn’t save interests", "Try again in a moment.")); }} />
    <CustomInterestInput selectedIds={ids} onAdd={toggleInterest} />
  </View>;
}

type GroupedInterestChoicesProps = {
  headingLevel?: 2 | 3;
  selectedIds: readonly string[];
  onToggle(id: string): void;
  busy?: boolean;
  accessibilityLabel?: string;
  testIDPrefix?: string;
};

export function GroupedInterestChoices({ headingLevel = 2, selectedIds, onToggle, busy = false, accessibilityLabel, testIDPrefix }: GroupedInterestChoicesProps) {
  const { type } = useFrameTheme();
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 360 || fontScale > 1.3;
  return <View style={styles.groups} accessibilityLabel={accessibilityLabel}>
    {selectedIds.some((id) => id.startsWith("custom:")) ? <View>
      <Heading level={headingLevel} style={type.heading}>Your specific interests</Heading>
      {selectedIds.filter((id) => id.startsWith("custom:")).map((id) => <ChoiceOption key={id} label={interestTopicFromId(id)?.name ?? "Interest"} selected role="checkbox" variant="ruled" onPress={() => onToggle(id)} disabled={busy} accessibilityHint="Remove this interest from future weekly selections." />)}
    </View> : null}
    {INTEREST_GROUPS.map((group) => <View key={group.label}>
      <Heading level={headingLevel} style={type.heading}>{group.label}</Heading>
      <View style={styles.choices}>
        {INTEREST_LIBRARY.filter((interest) => (group.ids as readonly string[]).includes(interest.id)).map((interest) => {
          const selected = selectedIds.includes(interest.id);
          const disabled = busy;
          return <ChoiceOption key={interest.id} label={interest.name} selected={selected} role="checkbox" variant="ruled" onPress={() => onToggle(interest.id)} disabled={disabled} testID={testIDPrefix ? `${testIDPrefix}-${interest.id}` : undefined} style={[styles.choice, singleColumn && { flexBasis: "100%" }]} />;
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
