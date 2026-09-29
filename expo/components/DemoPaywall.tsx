import { Check, CircleCheck } from "lucide-react-native";
import { useMemo, useReducer } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DEMO_PLANS, demoCheckoutReducer } from "@/domain/onboarding";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

/** A local interaction preview. No billing, entitlements, accounts, or persisted plan. */
type Props = { savedCount: number; sourceCount: number; onCompletionChange(value: boolean): void };

export default function DemoPaywall({ savedCount, sourceCount, onCompletionChange }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [state, dispatch] = useReducer(demoCheckoutReducer, { plan: "annual", completed: false });
  const plan = DEMO_PLANS.find((item) => item.id === state.plan)!;
  return <View style={styles.root}>
    <Text style={styles.heading} accessibilityRole="header">Make this your{"\n"}way to watch.</Text>
    <Text style={styles.body}>Frame Premium gives your favorite videos a home—and makes it easier to decide what to watch next.</Text>
    {savedCount > 0 || sourceCount > 0 ? <View style={styles.yourFrame}>
      <Text style={styles.yourFrameTitle}>Your Frame is taking shape.</Text>
      <Text style={styles.yourFrameBody}>{[sourceCount > 0 ? `${sourceCount} ${sourceCount === 1 ? "source" : "sources"} followed` : null, savedCount > 0 ? `${savedCount} ${savedCount === 1 ? "video" : "videos"} saved during setup` : null].filter(Boolean).join(" · ")}</Text>
      <Text style={styles.yourFrameBody}>Your choices stay yours, whichever plan you preview.</Text>
    </View> : null}
    <View style={styles.features}>
      {["Keep a personal library of videos worth returning to", "Continue a video from where you stopped", "Turn up to three videos into a session with an end", "Explore weekly source picks shaped by your interests"].map((label) => <View style={styles.feature} key={label}><Check size={18} color={palette.active} /><Text style={styles.featureText}>{label}</Text></View>)}
    </View>
    <View style={styles.disclosure}><Text style={type.label}>Demo · no charge</Text><Text style={styles.body}>These prices are illustrative. Previewing a plan makes no purchase and starts no subscription.</Text></View>
    {state.completed ? <View style={styles.confirmation} accessibilityLiveRegion="polite">
      <CircleCheck size={25} color={palette.success} />
      <Text style={type.heading} accessibilityRole="header">Preview complete</Text>
      <Text style={styles.body}>You selected {plan.title.toLowerCase()} at {plan.price} {plan.period}. No payment was taken. All demo features remain available.</Text>
      <Pressable onPress={() => { dispatch({ type: "reset" }); onCompletionChange(false); }} accessibilityRole="button" style={styles.textButton}><Text style={styles.link}>Review sample plans</Text></Pressable>
    </View> : <>
      <View accessibilityRole="radiogroup" accessibilityLabel="Sample Premium plans" style={styles.plans}>
        {DEMO_PLANS.map((item) => <Pressable key={item.id} onPress={() => dispatch({ type: "select", plan: item.id })} accessibilityRole="radio" accessibilityState={{ checked: state.plan === item.id }} accessibilityLabel={`${item.title}, ${item.price} ${item.period}, US dollars, sample price`} style={[styles.plan, state.plan === item.id && styles.selected]}>
          <View style={styles.planTitle}><Text style={type.label}>{item.title}</Text>{state.plan === item.id ? <Check size={18} color={palette.active} /> : null}</View>
          <Text style={styles.price}>{item.price} <Text style={styles.period}>{item.period}</Text></Text>
          <Text style={type.caption}>{item.detail}</Text>
        </Pressable>)}
      </View>
      <Pressable onPress={() => { dispatch({ type: "preview" }); onCompletionChange(true); }} accessibilityRole="button" style={styles.previewButton} testID="demo-checkout"><Text style={styles.previewLabel}>Preview {plan.title.toLowerCase()} · {plan.price} {plan.period}</Text></Pressable>
    </>}
  </View>;
}
function createStyles(p: FramePalette, t: FrameType) {
  return StyleSheet.create({
    yourFrame: { backgroundColor: p.programme, padding: spacing.lg, borderRadius: radii.card, gap: spacing.sm }, yourFrameTitle: { ...t.heading, color: p.onProgramme }, yourFrameBody: { ...t.bodySoft, color: p.onProgrammeSoft },
    root: { gap: spacing.lg }, heading: { ...t.title, fontSize: 34, lineHeight: 42 }, body: { ...t.bodySoft },
    features: { gap: spacing.md }, feature: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }, featureText: { ...t.body, flex: 1 },
    disclosure: { gap: spacing.xs, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border },
    plans: { gap: spacing.sm }, plan: { padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: p.border, borderRadius: radii.control, backgroundColor: p.surface }, selected: { borderColor: p.active, backgroundColor: p.activeSoft },
    planTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, price: { ...t.heading }, period: { ...t.bodySoft },
    previewButton: { minHeight: 52, padding: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: p.accentDeep }, previewLabel: { ...t.label, color: p.onDark, textAlign: "center" },
    confirmation: { gap: spacing.sm }, textButton: { minHeight: 48, justifyContent: "center" }, link: { ...t.label, color: p.active },
  });
}
