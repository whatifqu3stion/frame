import TextField from "@/components/TextField";
import { router } from "expo-router";
import { AlertTriangle, X } from "lucide-react-native";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createExitConfirmation } from "@/domain/exitConfirmation";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Sheet from "@/components/Sheet";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

type Props = { visible: boolean; onClose: () => void; forgottenPinRecovery?: boolean };

const DELETED_ITEMS = "all profiles; Owner PIN; viewing allowances, playback schedules, Pause Frame, and usage; Managed content approvals and requests; sources; saved videos (including former Watch Later links); Sessions; progress; interests; searches; appearance; and local Google credentials";

/** Shared irreversible full-reset recovery used by Privacy & Data and Forgot PIN. */
export default function FullResetModal({ visible, onClose, forgottenPinRecovery = false }: Props) {
  const { eraseAllFrameData } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [step, setStep] = useState<"review" | "type">("review");
  const [confirmation, setConfirmation] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const locked = useRef(false);
  const decision = useRef(createExitConfirmation()).current;
  useLayoutEffect(() => {
    decision.invalidate();
    return () => decision.invalidate();
  }, [decision, visible, step, confirmation, forgottenPinRecovery]);
  useEffect(() => { if (!visible) { setStep("review"); setConfirmation(""); setBusy(false); } }, [visible]);

  const close = (): void => { if (!locked.current) { decision.invalidate(); onClose(); } };
  const finish = async (): Promise<void> => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await eraseAllFrameData(forgottenPinRecovery);
      locked.current = false;
      onClose();
      router.replace("/onboarding");
    } catch {
      locked.current = false;
      setBusy(false);
      Alert.alert("Reset couldn’t finish", "Frame couldn’t safely finish erasing local data. Some local items may already be removed; restart Frame and try again.");
    }
  };
  const confirm = (): void => {
    if (!visible || confirmation !== "RESET" || locked.current) return;
    decision.request((decide) => Alert.alert("Erase all Frame data?", "This deletion is irreversible. Frame will restart with one clean Owner profile.", [
      { text: "Cancel", style: "cancel", onPress: () => decide(false) },
      { text: "Erase everything", style: "destructive", onPress: () => decide(true) },
    ], { cancelable: true, onDismiss: () => decide(false) }), () => { void finish(); });
  };

  return <Sheet visible={visible} onClose={close} contentKey={step} animateContent={false}>
      <View style={styles.header}><View style={styles.icon}><AlertTriangle size={20} color={palette.danger} /></View><Pressable onPress={close} disabled={busy} style={styles.close} accessibilityRole="button" accessibilityLabel="Close reset"><X size={18} color={palette.inkMuted} /></Pressable></View>
      <Text style={styles.title}>Erase all Frame data and start over</Text>
      {step === "review" ? <>
        <Text style={styles.body}>This permanently deletes the following from this device:</Text>
        {DELETED_ITEMS.split("; ").map((item) => <Text key={item} style={styles.body}>• {item.replace(/^and /, "")}</Text>)}
        <Text style={styles.note}>Store purchase records remain with the app store. Nothing can be selectively preserved, and the Owner PIN cannot be recovered separately.</Text>
        <Pressable onPress={() => setStep("type")} style={styles.primary} accessibilityRole="button"><Text style={styles.primaryText}>Continue</Text></Pressable>
      </> : <>
        <Text style={styles.body}>Type RESET exactly to continue.</Text>
        <TextField value={confirmation} onChangeText={(value) => setConfirmation(value.toUpperCase().slice(0, 5))} autoCapitalize="characters" autoCorrect={false} editable={!busy} containerStyle={{ marginTop: spacing.lg }} style={styles.input} placeholder="RESET" placeholderTextColor={palette.inkMuted} accessibilityLabel="Type RESET to confirm" autoFocus />
        <View style={styles.actions}><Pressable onPress={() => { setStep("review"); setConfirmation(""); }} disabled={busy} style={styles.secondary} accessibilityRole="button"><Text style={styles.secondaryText}>Back</Text></Pressable><Pressable onPress={confirm} disabled={confirmation !== "RESET" || busy} style={[styles.danger, (confirmation !== "RESET" || busy) && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: confirmation !== "RESET" || busy }}>{busy ? <ActivityIndicator color={palette.onDanger} /> : <Text style={styles.dangerText}>Review final confirmation</Text>}</Pressable></View>
      </>}
  </Sheet>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", padding: spacing.md, backgroundColor: palette.overlay },
    card: { ...softShadow, padding: spacing.lg, borderRadius: radii.large, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: palette.surface }, close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    title: { ...type.heading, fontSize: 24, marginTop: spacing.md }, body: { ...type.body, color: palette.inkSoft, marginTop: spacing.md, lineHeight: 23 }, note: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.md },
    input: { textAlign: "center", letterSpacing: 2 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg }, primary: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, borderRadius: radii.control, backgroundColor: palette.accentDeep }, primaryText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
    secondary: { minHeight: 52, flexGrow: 1, flexBasis: 100, padding: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.control, borderWidth: 1, borderColor: palette.border }, secondaryText: { ...type.label, color: palette.accent }, danger: { minHeight: 52, flexGrow: 2, flexBasis: 170, padding: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.danger }, dangerText: { textAlign: "center", color: palette.onDanger, fontFamily: fonts.sansSemibold, fontSize: 14 }, disabled: { opacity: 0.45 },
  });
}
