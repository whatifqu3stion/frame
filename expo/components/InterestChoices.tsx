import type { ReactNode } from "react";
import Text from "@/components/FrameText";
import InlineHelp from "@/components/InlineHelp";
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
  customLast?: boolean;
  customAction?: ReactNode;
  selectedIds: readonly string[];
  onToggle(id: string): void;
  busy?: boolean;
  collapsible?: boolean;
  accessibilityLabel?: string;
  testIDPrefix?: string;
};

export function GroupedInterestChoices({ headingLevel = 2, selectedIds, onToggle, busy = false, collapsible = false, accessibilityLabel, testIDPrefix, customLast = false, customAction }: GroupedInterestChoicesProps) {
  const { type } = useFrameTheme();
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 360 || fontScale > 1.3;
  const customSection = (selectedIds.some((id) => id.startsWith("custom:")) || customAction) ? <View>
      <Heading level={headingLevel} style={customLast ? type.caption : type.heading}>Your specific interests</Heading>
      {selectedIds.filter((id) => id.startsWith("custom:")).map((id) => <ChoiceOption key={id} label={interestTopicFromId(id)?.name ?? "Interest"} selected role="checkbox" variant="ruled" onPress={() => onToggle(id)} disabled={busy} accessibilityHint="Remove this interest from future weekly selections." />)}
      {customAction}
    </View> : null;
  return <View style={collapsible ? undefined : styles.groups} accessibilityLabel={accessibilityLabel}>
    {!customLast && customSection}
    {INTEREST_GROUPS.map((group) => {
      const topics = INTEREST_LIBRARY.filter((topic) => (group.ids as readonly string[]).includes(topic.id));
      const count = topics.filter((topic) => selectedIds.includes(topic.id)).length;
      const choices = <View style={styles.choices}>{topics.map((topic) => (
        <ChoiceOption key={topic.id} label={topic.name} selected={selectedIds.includes(topic.id)} role="checkbox" variant="ruled" onPress={() => onToggle(topic.id)} disabled={busy} testID={testIDPrefix ? `${testIDPrefix}-${topic.id}` : undefined} style={[styles.choice, singleColumn && { flexBasis: "100%" }]} />
      ))}</View>;
      return collapsible
        ? <InlineHelp key={group.label} label={`${group.label}${count ? ` · ${count} selected` : ""}`}>{choices}</InlineHelp>
        : <View key={group.label}><Heading level={headingLevel} style={type.heading}>{group.label}</Heading>{choices}</View>;
    })}
    {customLast && <View style={{ marginTop: spacing.md }}>{customSection}</View>}
  </View>;
}

const styles = StyleSheet.create({
  groups: { gap: spacing.xl },
  choices: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, marginTop: spacing.sm },
  choice: { flexGrow: 1, flexShrink: 1, flexBasis: "45%", paddingVertical: spacing.md },
});
