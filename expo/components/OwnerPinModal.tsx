import { LockKeyhole, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FullResetModal from "@/components/FullResetModal";
import Sheet from "@/components/Sheet";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

/** Reusable Owner authorization prompt shared by profile switching and protected controls. */
export default function OwnerPinModal() {
  const {
    ownerPinPromptOpen,
    ownerPinPromptError,
    ownerPinCooldownUntil,
    submitOwnerAuthorization,
    cancelOwnerAuthorization,
  } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [pin, setPin] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());
  const [fullResetOpen, setFullResetOpen] = useState<boolean>(false);


  const remainingSeconds = Math.max(0, Math.ceil((ownerPinCooldownUntil - now) / 1000));

  useEffect(() => {
    if (!ownerPinPromptOpen) {
      setPin("");
      setBusy(false);
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ownerPinPromptOpen]);

  const close = (): void => {
    if (busy) return;
    setPin("");
    cancelOwnerAuthorization();
  };

  const submit = async (): Promise<void> => {
    if (pin.length < 4 || busy || remainingSeconds > 0) return;
    setBusy(true);
    try { await submitOwnerAuthorization(pin); setPin(""); }
    catch { Alert.alert("Couldn’t verify PIN", "Try again. Protected controls remain locked."); }
    finally { setBusy(false); }
  };

  return (
    <>
    <Sheet visible={ownerPinPromptOpen} onClose={close}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.icon}><LockKeyhole size={20} color={palette.active} /></View>
            <Pressable disabled={busy} onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Cancel PIN entry">
              <X size={18} color={palette.inkMuted} />
            </Pressable>
          </View>
          <Text style={styles.heading}>Owner access.</Text>
          <Text style={styles.body}>Enter the household PIN to continue. This is a boundary inside Frame, not device-wide protection.</Text>
          <TextInput
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 6))}
            style={styles.input}
            placeholder="4–6 digit PIN"
            placeholderTextColor={palette.inkMuted}
            keyboardType="number-pad"
            editable={!busy}
            secureTextEntry
            autoFocus
            maxLength={6}
            textContentType="password"
            accessibilityLabel="Owner PIN"
            testID="owner-pin-input"
            onSubmitEditing={() => { void submit(); }}
          />
          {ownerPinPromptError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{ownerPinPromptError}</Text> : null}
          {remainingSeconds > 0 ? <Text style={styles.cooldown}>Try again in {remainingSeconds} seconds.</Text> : null}
          <Pressable
            onPress={() => { void submit(); }}
            disabled={pin.length < 4 || busy || remainingSeconds > 0}
            style={({ pressed }) => [styles.button, (pin.length < 4 || remainingSeconds > 0) && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="owner-pin-submit"
          >
            {busy ? <ActivityIndicator color={palette.onDark} /> : <Text style={styles.buttonText}>Continue</Text>}
          </Pressable>
          <Pressable disabled={busy} onPress={() => { setPin(""); cancelOwnerAuthorization(); setFullResetOpen(true); }} style={styles.forgot} accessibilityRole="button">
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </Pressable>
          <Text style={styles.recovery}>PIN recovery erases all local Frame data. Review the details under Forgot PIN.</Text>
    </Sheet>
    <FullResetModal visible={fullResetOpen} onClose={() => setFullResetOpen(false)} forgottenPinRecovery />
    </>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", padding: spacing.md, backgroundColor: palette.overlay },
    card: { ...softShadow, padding: spacing.lg, paddingTop: spacing.md, borderRadius: radii.large, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    handle: { width: 36, height: 4, alignSelf: "center", marginBottom: spacing.md, borderRadius: 2, backgroundColor: palette.surfaceDeep },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: palette.activeSoft },
    closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    heading: { ...type.heading, fontSize: 25, marginTop: spacing.md },
    body: { ...type.bodySoft, marginTop: spacing.sm },
    input: { ...type.heading, minHeight: 56, marginTop: spacing.lg, paddingHorizontal: spacing.md, textAlign: "center", letterSpacing: 8, borderWidth: 1, borderColor: palette.border, borderRadius: radii.control, backgroundColor: palette.surface },
    error: { ...type.label, marginTop: spacing.md, color: palette.danger },
    cooldown: { ...type.bodySoft, marginTop: spacing.xs, color: palette.inkMuted },
    button: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep },
    buttonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 15 },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
    forgot: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
    forgotText: { ...type.label, color: palette.accent },
    recovery: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", fontSize: 12 },
  });
}

