import Text from "@/components/FrameText";
import TextField from "@/components/TextField";
import InlineHelp from "@/components/InlineHelp";
import { useFeedback } from "@/hooks/useFeedback";
import MotionView from "@/components/motion/MotionView";
import OutcomeIcon from "@/components/motion/OutcomeIcon";
import { Check, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { CUSTOM_INTEREST_MAX_LENGTH, createCustomInterest, interestTopicFromId } from "@/domain/interests";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";

export default function CustomInterestInput({ selectedIds, onAdd, disabled = false }: { selectedIds: readonly string[]; onAdd(id: string): Promise<boolean>; disabled?: boolean }) {
  const { palette, type } = useFrameTheme();
  const { activeProfileId } = useApp();
  const { busy, run } = useScreenAction(`${activeProfileId}:custom-interest`);
  const feedback = useFeedback();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);
  useEffect(() => { setDraft(""); setMessage(""); setAdded(false); }, [activeProfileId]);
  const add = async () => {
    if (busy || disabled) return;
    let topic;
    try { topic = createCustomInterest(draft); } catch (error) { setMessage(error instanceof Error ? error.message : "Use a short topic name."); return; }
    if (selectedIds.some((id) => interestTopicFromId(id)?.name.toLowerCase() === topic.name.toLowerCase())) { setMessage("That interest is already selected."); return; }
    const acknowledge = feedback.capture();
    await run(() => onAdd(topic.id), (changed) => { if (!changed) { setMessage("This interest wasn’t added. Try again."); return; } acknowledge("selection"); setDraft(""); setAdded(true); setMessage("Interest added."); }, () => setMessage("Couldn’t save this interest. Try again."));
  };
  return <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
    <InlineHelp label="Add a custom interest">
    <Text style={type.bodySoft}>Avoid personal or sensitive details. Topics are sent to Gemini when you generate picks.</Text>
    <TextField accessibilityLabel="Custom interest" placeholder="e.g. Japanese joinery or deep-sea ecology" placeholderTextColor={palette.inkMuted} value={draft} onChangeText={(value) => { setDraft(value); setMessage(""); setAdded(false); }} maxLength={CUSTOM_INTEREST_MAX_LENGTH} editable={!busy && !disabled} returnKeyType="done" onSubmitEditing={() => { void add(); }}  testID="custom-interest-input" />
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy || !draft.trim(), busy }} disabled={disabled || busy || !draft.trim()} onPress={() => { void add(); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.sm, opacity: disabled || busy || (!draft.trim() && !added) ? 0.5 : 1 }}><OutcomeIcon confirmed={added} busy={busy} color={palette.active} idle={<Plus size={18} color={palette.active} />}><Check size={18} color={palette.active} /></OutcomeIcon><Text style={[type.label, { color: palette.active }]}>{busy ? "Adding…" : added ? "Interest added" : "Add interest"}</Text></Pressable>
    {message ? <MotionView enter changeKey={message}><Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text></MotionView> : null}
    </InlineHelp>
  </View>;
}
