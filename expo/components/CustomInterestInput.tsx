import Text from "@/components/FrameText";
import TextField from "@/components/TextField";
import InlineHelp from "@/components/InlineHelp";
import { useFeedback } from "@/hooks/useFeedback";
import MotionView from "@/components/motion/MotionView";
import OutcomeIcon from "@/components/motion/OutcomeIcon";
import { Check, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { radii, spacing } from "@/constants/theme";
import { CUSTOM_INTEREST_LIMIT, isCustomInterest, CUSTOM_INTEREST_MAX_LENGTH, createCustomInterest, interestTopicFromId } from "@/domain/interests";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";

export default function CustomInterestInput({ selectedIds, onAdd, disabled = false, compact = false, expanded = false }: { selectedIds: readonly string[]; onAdd(id: string): Promise<boolean>; disabled?: boolean; compact?: boolean; expanded?: boolean }) {
  const { palette, type, isDark } = useFrameTheme();
  const { activeProfileId } = useApp();
  const { busy, run } = useScreenAction(`${activeProfileId}:custom-interest`);
  const feedback = useFeedback();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [addedId, setAddedId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [ready, setReady] = useState(false);
  const reduced = useReducedMotion();
  const added = addedId !== null && selectedIds.includes(addedId);
  useEffect(() => { setDraft(""); setMessage(""); setAddedId(null); setReady(false); }, [activeProfileId]);
  useEffect(() => {
    if (!expanded || !draft.trim() || ready) return;
    const timeout = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(timeout);
  }, [draft, expanded, ready]);
  const full = selectedIds.filter(isCustomInterest).length >= CUSTOM_INTEREST_LIMIT;
  const add = async () => {
    if (busy || disabled || full) return;
    let topic;
    try { topic = createCustomInterest(draft); } catch (error) { setMessage(error instanceof Error ? error.message : "Use a short topic name."); return; }
    if (selectedIds.some((id) => interestTopicFromId(id)?.name.toLowerCase() === topic.name.toLowerCase())) { setMessage("That interest is already selected."); return; }
    if (expanded && !isCustomInterest(topic.id)) { setMessage("That’s a standard topic. You can select it on the previous screen."); return; }
    const acknowledge = feedback.capture();
    await run(() => onAdd(topic.id), (changed) => { if (!changed) { setMessage("This interest wasn’t added. Try again."); return; } acknowledge("selection"); setDraft(""); setReady(false); setAddedId(topic.id); setMessage(""); }, () => setMessage("Couldn’t save this interest. Try again."));
  };
  const changeDraft = (value: string) => { setDraft(value); setMessage(""); setAddedId(null); if (!value.trim()) setReady(false); };
  const readyToAdd = ready && !!draft.trim();
  const form = <View style={{ gap: spacing.sm }}>
    {full ? <Text style={type.bodySoft}>Remove a custom interest to add another.</Text> : <>
    {!expanded && <Text style={type.bodySoft}>Avoid personal or sensitive details. Topics are sent to Gemini when you generate picks.</Text>}
    {expanded ? <>
      <Text style={type.label}>Type an interest, then tap + to add.</Text>
      <View style={{ position: "relative", minHeight: 56 }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radii.pill, borderCurve: "continuous", borderWidth: 1, borderColor: palette.active, backgroundColor: palette.activeSoft, opacity: readyToAdd ? 1 : 0, transitionProperty: "opacity", transitionDuration: "180ms", transitionTimingFunction: "ease-out" }]} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: 0, height: 1, backgroundColor: focused ? palette.active : palette.border, opacity: readyToAdd ? 0 : 1, transitionProperty: "opacity", transitionDuration: "180ms" }} />
        <TextField accessibilityLabel="Custom interest" accessibilityHint="Type one interest. After a brief pause, tap the plus to add it, or use the keyboard Done key."
          placeholder="e.g. Japanese joinery" placeholderTextColor={isDark ? "#A89E95" : "#746E67"}
          containerStyle={{ borderWidth: 0, backgroundColor: "transparent", paddingRight: spacing.xs, minHeight: 56 }}
          onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); if (draft.trim()) setReady(true); }}
          value={draft} onChangeText={changeDraft} maxLength={CUSTOM_INTEREST_MAX_LENGTH} editable={!busy && !disabled}
          returnKeyType="done" submitBehavior="submit" onSubmitEditing={() => { void add(); }} testID="custom-interest-input"
          trailing={<Animated.View pointerEvents={readyToAdd ? "auto" : "none"} aria-hidden={!readyToAdd} accessibilityElementsHidden={!readyToAdd} importantForAccessibility={readyToAdd ? "auto" : "no-hide-descendants"}
            style={{ opacity: readyToAdd ? 1 : 0, transform: [{ scale: reduced || readyToAdd ? 1 : 0.95 }], transitionProperty: ["opacity", "transform"], transitionDuration: "180ms", transitionTimingFunction: "ease-out" }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Add ${draft.trim() || "interest"}`} accessibilityState={{ disabled: disabled || busy || !readyToAdd, busy }}
              disabled={disabled || busy || !readyToAdd} onPress={() => { void add(); }} testID="add-custom-interest" pressRetentionOffset={16}
              style={({ pressed }) => ({ width: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, opacity: pressed || disabled ? 0.55 : 1 })}>
              {busy ? <ActivityIndicator size="small" color={palette.active} /> : <Plus size={22} color={palette.active} />}
            </Pressable>
          </Animated.View>} />
      </View>
    </> : <View style={{ gap: spacing.sm }}>
      <TextField accessibilityLabel="Custom interest" accessibilityHint="Type one interest, then press Add interest to save it." placeholder="e.g. Japanese joinery or deep-sea ecology"
        placeholderTextColor={palette.inkMuted}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        value={draft} onChangeText={changeDraft} maxLength={CUSTOM_INTEREST_MAX_LENGTH} editable={!busy && !disabled} returnKeyType="done" onSubmitEditing={() => { void add(); }} testID="custom-interest-input" />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy || !draft.trim(), busy }} disabled={disabled || busy || !draft.trim()} onPress={() => { void add(); }}
        testID="add-custom-interest"
        style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.sm, opacity: pressed || disabled || busy || (!draft.trim() && !added) ? 0.5 : 1 })}
      ><OutcomeIcon confirmed={added} busy={busy} color={palette.active} idle={<Plus size={18} color={palette.active} />}><Check size={18} color={palette.active} /></OutcomeIcon><Text style={[type.label, { color: palette.active }]}>{busy ? "Adding…" : added ? "Interest added" : "Add interest"}</Text></Pressable>
    </View>}
    </>}
    {message ? <MotionView enter changeKey={message}><Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text></MotionView> : null}
  </View>;
  return expanded ? form : <View style={{ marginTop: compact ? 0 : spacing.xl }}><InlineHelp label={compact ? "Add your own topic" : "Add a custom interest"}>{form}</InlineHelp></View>;
}
