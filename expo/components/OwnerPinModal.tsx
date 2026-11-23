import { LockKeyhole, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, type TextInput, View } from "react-native";
import FullResetModal from "@/components/FullResetModal";
import Text from "@/components/FrameText";
import Heading from "@/components/Heading";
import PrimaryAction from "@/components/PrimaryAction";
import Sheet from "@/components/Sheet";
import TextField from "@/components/TextField";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { notifyUser } from "@/services/notifyUser";

/** Reusable Owner authorization prompt shared by profile switching and protected controls. */
export default function OwnerPinModal() {
  const {
    ownerPinPromptOpen,
    ownerPinInstruction,
    ownerPinPromptError,
    ownerPinCooldownUntil,
    submitOwnerAuthorization,
    cancelOwnerAuthorization,
  } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const input = useRef<TextInput>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [fullResetOpen, setFullResetOpen] = useState(false);
  const remainingSeconds = Math.max(0, Math.ceil((ownerPinCooldownUntil - now) / 1000));
  const heading = ownerPinInstruction ? "Verify your new PIN" : "Owner access";
  const lockedOut = remainingSeconds > 0;
  const submitDisabled = pin.length < 4 || busy || lockedOut;

  useEffect(() => {
    if (!ownerPinPromptOpen) {
      setPin("");
      setBusy(false);
    }
  }, [ownerPinPromptOpen]);

  useEffect(() => {
    if (!ownerPinPromptOpen) return;
    setNow(Date.now());
    if (ownerPinCooldownUntil <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= ownerPinCooldownUntil) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [ownerPinPromptOpen, ownerPinCooldownUntil]);

  // The provider supplies the attempt count. The countdown below owns the
  // changing time so an expired "wait 30 seconds" instruction cannot linger.
  const cooldownEnded = !lockedOut && ownerPinPromptError?.startsWith("Too many attempts.");
  let error = ownerPinPromptError;
  if (lockedOut) error = "Too many attempts.";
  if (cooldownEnded) error = "You can try again now.";
  useEffect(() => {
    if (Platform.OS === "ios" && ownerPinPromptOpen && error) AccessibilityInfo.announceForAccessibility(error);
  }, [error, ownerPinPromptOpen]);

  useEffect(() => {
    if (ownerPinPromptOpen && ownerPinPromptError && !lockedOut && !cooldownEnded && !busy) input.current?.focus();
  }, [busy, cooldownEnded, lockedOut, ownerPinPromptError, ownerPinPromptOpen]);

  const close = (): void => {
    if (busy) return;
    setPin("");
    cancelOwnerAuthorization();
  };

  const submit = async (): Promise<void> => {
    if (submitDisabled) return;
    setBusy(true);
    try {
      await submitOwnerAuthorization(pin);
      setPin("");
    } catch {
      notifyUser("Couldn’t verify PIN", "Try again. Protected controls remain locked.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet label={heading} visible={ownerPinPromptOpen} onClose={close} tvForm>
        <View style={styles.headerRow}>
          <LockKeyhole size={21} color={palette.active} />
          <Heading style={styles.heading}>{heading}</Heading>
          <Pressable
            disabled={busy}
            onPress={close}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel PIN entry"
          >
            <X size={19} color={palette.inkMuted} />
          </Pressable>
        </View>
        <Text style={styles.body}>{ownerPinInstruction ?? "Enter your 4–6 digit Owner PIN to continue."}</Text>
        <TextField
          ref={input}
          value={pin}
          onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 6))}
          containerStyle={styles.field}
          style={[styles.input, pin.length > 0 && styles.masked]}
          placeholder="Owner PIN"
          keyboardType="number-pad"
          disableFullscreenUI
          returnKeyType="done"
          submitBehavior="submit"
          editable={!busy && !lockedOut}
          secureTextEntry
          autoFocus
          maxLength={6}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          autoCorrect={false}
          accessibilityLabel="Owner PIN, 4 to 6 digits"
          testID="owner-pin-input"
          onSubmitEditing={() => { void submit(); }}
        />
        {error && <Text accessibilityLiveRegion="polite" style={cooldownEnded ? styles.cooldown : styles.error}>{error}</Text>}
        {lockedOut && <Text style={styles.cooldown}>Try again in {remainingSeconds} {remainingSeconds === 1 ? "second" : "seconds"}.</Text>}
        <PrimaryAction
          depth={palette.primaryButtonDepth}
          onPress={() => { void submit(); }}
          disabled={submitDisabled}
          style={({ pressed }) => [styles.button, submitDisabled && styles.disabled, pressed && styles.pressed]}
          accessibilityLabel="Verify PIN"
          accessibilityState={{ busy, disabled: submitDisabled }}
          testID="owner-pin-submit"
        >
          {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.buttonText}>Verify PIN</Text>}
        </PrimaryAction>
        <Pressable
          disabled={busy}
          onPress={() => { close(); setFullResetOpen(true); }}
          style={styles.forgot}
          accessibilityRole="button"
        >
          {Platform.isTV ? <View nativeID="frame-tv-focus-surface" style={styles.recoveryPill}>
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </View> : <Text style={styles.forgotText}>Forgot PIN?</Text>}
        </Pressable>
        <Text style={styles.recovery}>Recovering a forgotten PIN requires erasing Frame’s data on this device.</Text>
      </Sheet>
      <FullResetModal visible={fullResetOpen} onClose={() => setFullResetOpen(false)} forgottenPinRecovery />
    </>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    closeButton: { width: 48, height: 48, borderRadius: radii.control, alignItems: "center", justifyContent: "center" },
    heading: { ...type.heading, flex: 1, fontSize: Platform.isTV ? 28 : 25 },
    body: { ...type.bodySoft, marginTop: spacing.xs },
    field: { marginTop: spacing.md },
    input: { textAlign: "center" },
    masked: { letterSpacing: 4 },
    error: { ...type.label, marginTop: spacing.sm, color: palette.danger },
    cooldown: { ...type.bodySoft, marginTop: spacing.xs, color: palette.inkMuted },
    button: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: spacing.md, borderRadius: radii.control, backgroundColor: palette.accent },
    buttonText: { color: palette.onAccent, fontFamily: fonts.sansSemibold, fontSize: Platform.isTV ? 18 : 15 },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.78 },
    forgot: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: spacing.xs, borderRadius: radii.control },
    recoveryPill: { minHeight: 38, paddingHorizontal: 18, justifyContent: "center", borderRadius: 19 },
    forgotText: { ...type.label, color: palette.accent },
    recovery: { ...type.bodySoft, color: palette.inkMuted, textAlign: "center", fontSize: Platform.isTV ? 16 : 13 },
  });
}
