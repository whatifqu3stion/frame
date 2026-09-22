import { ArrowDown, ArrowUp, Check, ChevronRight, Clock3, LockKeyhole, Pencil, Plus, ShieldCheck, Trash2, UserRound, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AllowancePicker from "@/components/AllowancePicker";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { ManagedAllowance } from "@/models/dailyAllowance";
import type { ViewingAllowance, ViewingAllowanceStatus } from "@/models/viewingAllowance";
import type { Profile } from "@/models/profile";
import { useApp } from "@/providers/AppProvider";
import { OWNER_AUTHORIZATION_MS } from "@/domain/ownerAuthorization";

type Props = { visible: boolean; onClose: () => void };
type Editor =
  | { kind: "createStandard" }
  | { kind: "createManaged" }
  | { kind: "rename"; profile: Profile }
  | { kind: "allowance"; profile: Profile }
  | { kind: "pin" }
  | { kind: "removePin" }
  | null;

/** Owner-authorized household profile, allowance, and PIN controls. */
export default function ProfileControlsModal({ visible, onClose }: Props) {
  const {
    profiles, activeProfileId, profileSwitching, isOwnerAuthorized, ownerPinAvailability, hasOwnerPin,
    createStandardProfile, createManagedProfile, renameLocalProfile, reorderLocalProfile, deleteLocalProfile,
    setProfileViewingAllowance, cancelPendingOwnerAllowance, getPlaybackAllowance, switchProfile, saveOwnerPin, clearOwnerPin, relockOwnerAccess,
  } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [editor, setEditor] = useState<Editor>(null);
  const [value, setValue] = useState<string>("");
  const [confirmation, setConfirmation] = useState<string>("");
  const [currentPin, setCurrentPin] = useState<string>("");
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);
  const [allowance, setAllowance] = useState<ViewingAllowance>({ mode: "dailyLimit", minutes: 30 });
  const [allowanceStatus, setAllowanceStatus] = useState<Record<string, ViewingAllowanceStatus>>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const refreshAllowances = useCallback(async (): Promise<void> => {
    const entries = await Promise.all(profiles.map(async (profile) => [profile.id, await getPlaybackAllowance(profile.id)] as const));
    setAllowanceStatus(Object.fromEntries(entries));
  }, [getPlaybackAllowance, profiles]);

  useEffect(() => { if (visible) void refreshAllowances(); }, [refreshAllowances, visible]);
  useEffect(() => { if (visible && !isOwnerAuthorized) onClose(); }, [isOwnerAuthorized, onClose, visible]);
  useEffect(() => {
    if (!visible || !hasOwnerPin) return;
    const timer = setTimeout(() => { relockOwnerAccess(); onClose(); }, OWNER_AUTHORIZATION_MS);
    return () => clearTimeout(timer);
  }, [hasOwnerPin, onClose, relockOwnerAccess, visible]);

  const close = (): void => {
    if (busy || profileSwitching) return;
    setEditor(null); setValue(""); setConfirmation(""); setCurrentPin(""); setFeedback(null);
    relockOwnerAccess(); onClose();
  };

  const begin = (next: Editor): void => {
    setEditor(next);
    setValue(next?.kind === "rename" ? next.profile.name : "");
    setConfirmation(""); setCurrentPin(""); setFeedback(null);
    if (next?.kind === "allowance") {
      if (!hasOwnerPin) {
        Alert.alert("Create an Owner PIN first", "Viewing allowances need the existing protected-action boundary. Add an Owner PIN before enabling or changing one.", [{ text: "Not now", style: "cancel" }, { text: "Add PIN", onPress: () => begin({ kind: "pin" }) }]);
        return;
      }
      const status = allowanceStatus[next.profile.id];
      setAllowance(status?.kind === "unlimited" ? { mode: "unlimited" } : status?.kind === "limited" || status?.kind === "complete" ? { mode: "dailyLimit", minutes: status.allowanceMinutes } : { mode: "dailyLimit", minutes: 30 });
    } else if (next?.kind === "createManaged") setAllowance({ mode: "dailyLimit", minutes: 30 });
  };

  const beginAllowanceEditor = (profile: Profile): void => {
    if (profile.role === "owner" && allowanceStatus[profile.id]?.kind === "unlimited") {
      Alert.alert("A personal Frame boundary", "Your Owner limit starts immediately. Later increases or Unlimited changes wait 24 hours, cannot be bypassed with the PIN, and never block Settings.", [
        { text: "Cancel", style: "cancel" },
        { text: "I understand", onPress: () => begin({ kind: "allowance", profile }) },
      ]);
      return;
    }
    begin({ kind: "allowance", profile });
  };

  const submitEditor = async (): Promise<void> => {
    if (!editor || busy) return;
    if (editor.kind === "pin" && value !== confirmation) return setFeedback({ ok: false, message: "Those PINs don’t match." });
    setBusy(true);
    const result = editor.kind === "createStandard" ? await createStandardProfile(value)
      : editor.kind === "createManaged" ? await createManagedProfile(value, allowance as ManagedAllowance)
        : editor.kind === "rename" ? await renameLocalProfile(editor.profile.id, value)
          : editor.kind === "allowance" ? await setProfileViewingAllowance(editor.profile.id, allowance)
            : editor.kind === "removePin" ? await clearOwnerPin(currentPin)
              : await saveOwnerPin(value, currentPin);
    setBusy(false); setFeedback(result);
    if (result.ok) {
      const createdManagedWithoutPin = editor.kind === "createManaged" && !hasOwnerPin;
      setEditor(null); setValue(""); setConfirmation(""); setCurrentPin("");
      await refreshAllowances();
      if (createdManagedWithoutPin) Alert.alert("Add an Owner PIN when ready", "Managed settings are not meaningfully protected until an Owner PIN is set in this existing protected-controls screen.");
    }
  };

  const confirmDelete = (profile: Profile): void => {
    Alert.alert(`Delete ${profile.name}?`, "This permanently removes only this profile’s sources, library, progress, sessions, interests, appearance, and Daily Frame time from this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete profile", style: "destructive", onPress: async () => { setBusy(true); const result = await deleteLocalProfile(profile.id); setBusy(false); setFeedback(result); } },
    ]);
  };

  const cancelPending = async (): Promise<void> => {
    setBusy(true);
    const result = await cancelPendingOwnerAllowance();
    setBusy(false);
    setFeedback(result);
    if (result.ok) await refreshAllowances();
  };

  const confirmRemovePin = (): void => begin({ kind: "removePin" });

  const chooseProfile = async (profileId: string): Promise<void> => {
    setBusy(true); const result = await switchProfile(profileId); setBusy(false); setFeedback(result);
    if (result.ok) close();
  };

  const reorder = async (profileId: string, direction: "up" | "down"): Promise<void> => {
    setBusy(true); const result = await reorderLocalProfile(profileId, direction); setBusy(false); setFeedback(result);
  };

  const statusLabel = (profile: Profile): string => {
    const role = profile.role === "owner" ? "Owner" : profile.role === "managed" ? "Managed" : "Standard";
    const status = allowanceStatus[profile.id];
    if (!status) return `${role} · checking allowance…`;
    if (status.kind === "unlimited") return `${role} · Unlimited`;
    if (status.kind === "ownerReview") return `${role} · Owner review needed`;
    return `${role} · ${status.allowanceMinutes} min daily`;
  };

  const canCreate = profiles.length < PRODUCT_LIMITS.futureProfilesPerHousehold;
  const localProfiles = profiles.filter((profile) => profile.role !== "owner");
  const pinUnavailable = ownerPinAvailability !== "available";
  const editorNeedsName = editor?.kind === "createStandard" || editor?.kind === "createManaged" || editor?.kind === "rename";
  const allowanceInvalid = allowance.mode === "dailyLimit" && (!Number.isInteger(allowance.minutes) || allowance.minutes < 1 || allowance.minutes > 1_440);

  return (
    <Modal visible={visible} animationType={reduceMotion ? "none" : "slide"} transparent statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}><View style={styles.card}>
        <View style={styles.handle} />
        <View style={styles.headerRow}><View><Text style={styles.eyebrow}>Protected controls</Text><Text style={styles.heading}>Profiles & boundaries</Text></View><Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close protected controls"><X size={18} color={palette.inkMuted} /></Pressable></View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.boundaryCard}><ShieldCheck size={20} color={palette.active} /><Text style={styles.boundaryText}>Daily Frame time limits playback only inside Frame. It does not block YouTube, browsers, or other apps.</Text></View>
          <View style={styles.sectionHeader}><Text style={styles.sectionLabel}>Profiles · {profiles.length} of {PRODUCT_LIMITS.futureProfilesPerHousehold}</Text></View>
          {canCreate ? <View style={styles.actionRow}><Pressable onPress={() => begin({ kind: "createStandard" })} style={styles.secondaryButton}><Plus size={15} color={palette.active} /><Text style={styles.secondaryButtonText}>Add Standard</Text></Pressable><Pressable onPress={() => begin({ kind: "createManaged" })} style={styles.secondaryButton}><Clock3 size={15} color={palette.active} /><Text style={styles.secondaryButtonText}>Add Managed</Text></Pressable></View> : null}
          <View style={styles.profileList}>{profiles.map((profile) => {
            const active = profile.id === activeProfileId;
            const localIndex = localProfiles.findIndex((candidate) => candidate.id === profile.id);
            return <View key={profile.id} style={[styles.profileRow, active && styles.profileRowActive]}>
              <View style={styles.avatar}>{profile.role === "managed" ? <Clock3 size={18} color={active ? palette.active : palette.inkMuted} /> : <UserRound size={18} color={active ? palette.active : palette.inkMuted} />}</View>
              <Pressable onPress={() => { if (!active) void chooseProfile(profile.id); }} disabled={active || busy} style={styles.profileMain} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={styles.profileName}>{profile.name}</Text><Text style={styles.profileRole}>{statusLabel(profile)}</Text></Pressable>
              {active ? <Check size={17} color={palette.active} /> : <ChevronRight size={17} color={palette.inkMuted} />}
              <Pressable onPress={() => beginAllowanceEditor(profile)} style={styles.iconButton} accessibilityLabel={`Edit daily viewing allowance for ${profile.name}`}><Clock3 size={16} color={palette.active} /></Pressable>
              {profile.role !== "owner" ? <View style={styles.rowActions}>
                <Pressable onPress={() => begin({ kind: "rename", profile })} style={styles.iconButton} accessibilityLabel={`Rename ${profile.name}`}><Pencil size={15} color={palette.inkMuted} /></Pressable>
                <Pressable onPress={() => { void reorder(profile.id, "up"); }} disabled={localIndex <= 0 || busy} style={styles.smallIcon} accessibilityLabel={`Move ${profile.name} up`}><ArrowUp size={14} color={palette.inkMuted} /></Pressable>
                <Pressable onPress={() => { void reorder(profile.id, "down"); }} disabled={localIndex < 0 || localIndex >= localProfiles.length - 1 || busy} style={styles.smallIcon} accessibilityLabel={`Move ${profile.name} down`}><ArrowDown size={14} color={palette.inkMuted} /></Pressable>
                <Pressable onPress={() => confirmDelete(profile)} style={styles.iconButton} accessibilityLabel={`Delete ${profile.name}`}><Trash2 size={15} color={palette.danger} /></Pressable>
              </View> : null}
            </View>;
          })}</View>

          {profiles.map((profile) => {
            const status = allowanceStatus[profile.id];
            const pending = status && "pendingChange" in status ? status.pendingChange : undefined;
            if (!pending) return null;
            const label = pending.allowance.mode === "unlimited" ? "Unlimited" : `${pending.allowance.minutes} minutes`;
            return <View key={`pending-${profile.id}`} style={styles.pendingCard} accessible accessibilityLabel={`Pending Owner allowance change to ${label}`}><Clock3 size={18} color={palette.active} /><View style={styles.flex}><Text style={styles.profileName}>Pending Owner change</Text><Text style={styles.profileRole}>{label} activates {new Date(pending.activatesAt).toLocaleString()}.</Text></View><Pressable onPress={() => { void cancelPending(); }} disabled={busy} style={styles.cancelPending} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable></View>;
          })}

          <Text style={[styles.sectionLabel, styles.pinLabel]}>Owner PIN</Text>
          <View style={styles.pinCard}><View style={styles.pinIcon}><LockKeyhole size={19} color={palette.active} /></View><View style={styles.flex}><Text style={styles.profileName}>{hasOwnerPin ? "PIN is on" : "PIN is off"}</Text><Text style={styles.profileRole}>{pinUnavailable ? "Persistent PIN setup requires the iPhone or Android app." : hasOwnerPin ? "Protects Managed controls and Owner entry." : "Managed settings are not meaningfully protected without one."}</Text></View></View>
          {!pinUnavailable ? <View style={styles.actionRow}><Pressable onPress={() => begin({ kind: "pin" })} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{hasOwnerPin ? "Change PIN" : "Add PIN"}</Text></Pressable>{hasOwnerPin ? <Pressable onPress={confirmRemovePin} style={styles.secondaryButton}><Text style={[styles.secondaryButtonText, { color: palette.danger }]}>Remove PIN</Text></Pressable> : null}</View> : null}

          {editor ? <View style={styles.editor}>
            <Text style={styles.editorTitle}>{editor.kind === "createStandard" ? "New Standard profile" : editor.kind === "createManaged" ? "New Managed profile" : editor.kind === "rename" ? `Rename ${editor.profile.name}` : editor.kind === "allowance" ? `${editor.profile.name} · Daily viewing allowance` : editor.kind === "removePin" ? "Remove Owner PIN" : hasOwnerPin ? "Change Owner PIN" : "Add Owner PIN"}</Text>
            {(editor.kind === "pin" && hasOwnerPin || editor.kind === "removePin") ? <TextInput value={currentPin} onChangeText={(text) => setCurrentPin(text.replace(/\D/g, "").slice(0, 6))} placeholder="Current Owner PIN" placeholderTextColor={palette.inkMuted} style={[styles.input, styles.pinInput]} keyboardType="number-pad" secureTextEntry maxLength={6} autoFocus accessibilityLabel="Current Owner PIN" /> : null}
            {editorNeedsName || editor.kind === "pin" ? <TextInput value={value} onChangeText={(text) => { setValue(editor.kind === "pin" ? text.replace(/\D/g, "").slice(0, 6) : text); setFeedback(null); }} placeholder={editor.kind === "pin" ? "4–6 digit PIN" : "Profile name"} placeholderTextColor={palette.inkMuted} style={[styles.input, editor.kind === "pin" && styles.pinInput]} keyboardType={editor.kind === "pin" ? "number-pad" : "default"} secureTextEntry={editor.kind === "pin"} maxLength={editor.kind === "pin" ? 6 : 32} autoFocus={!hasOwnerPin || editor.kind !== "pin"} accessibilityLabel={editor.kind === "pin" ? "New Owner PIN" : "Profile name"} /> : null}
            {editor.kind === "pin" ? <TextInput value={confirmation} onChangeText={(text) => { setConfirmation(text.replace(/\D/g, "").slice(0, 6)); setFeedback(null); }} placeholder="Repeat PIN" placeholderTextColor={palette.inkMuted} style={[styles.input, styles.pinInput]} keyboardType="number-pad" secureTextEntry maxLength={6} accessibilityLabel="Repeat new Owner PIN" /> : null}
            {editor.kind === "createManaged" || editor.kind === "allowance" ? <AllowancePicker value={allowance} onChange={setAllowance} /> : null}
            {editor.kind === "allowance" && editor.profile.role === "owner" ? <Text style={styles.ownerDelayNote}>Enabling or reducing your Owner limit is immediate. Increasing it or choosing Unlimited takes effect 24 hours later. There is no PIN bypass or “add time” action.</Text> : null}
            <View style={styles.actionRow}><Pressable onPress={() => begin(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable onPress={() => { void submitEditor(); }} disabled={busy || allowanceInvalid || ((editorNeedsName || editor.kind === "pin") && !value.trim()) || ((editor.kind === "pin" && hasOwnerPin || editor.kind === "removePin") && currentPin.length < 4)} style={[styles.primaryButton, (busy || allowanceInvalid || ((editorNeedsName || editor.kind === "pin") && !value.trim()) || ((editor.kind === "pin" && hasOwnerPin || editor.kind === "removePin") && currentPin.length < 4)) && styles.disabled]}>{busy ? <ActivityIndicator color={palette.onDark} /> : <Text style={styles.primaryButtonText}>{editor.kind === "removePin" ? "Remove PIN" : "Save"}</Text>}</Pressable></View>
          </View> : null}
          {feedback ? <Text style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text> : null}
          <Text style={styles.recovery}>The Owner PIN and allowances are boundaries inside Frame, not encryption or device-level parental controls. There is no cloud PIN recovery. Forgotten PIN recovery erases all local Frame data.</Text>
        </ScrollView>
      </View></View>
    </Modal>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay },
    card: { ...softShadow, maxHeight: "94%", paddingTop: spacing.md, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    handle: { width: 36, height: 4, alignSelf: "center", marginBottom: spacing.md, borderRadius: 2, backgroundColor: palette.surfaceDeep },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
    eyebrow: { ...type.caption, color: palette.accent }, heading: { ...type.heading, fontSize: 24, marginTop: spacing.xs }, closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    scroll: { marginTop: spacing.sm }, scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 44 },
    boundaryCard: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.activeSoft }, boundaryText: { ...type.bodySoft, flex: 1, color: palette.inkMuted },
    sectionHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg }, sectionLabel: { ...type.caption, color: palette.inkMuted },
    profileList: { marginTop: spacing.md, gap: spacing.sm }, profileRow: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface }, profileRowActive: { borderColor: palette.active, backgroundColor: palette.activeSoft },
    avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: palette.surfaceHigh }, profileMain: { flex: 1, minHeight: 60, justifyContent: "center" }, profileName: { ...type.label, fontSize: 14 }, profileRole: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted, fontSize: 11 },
    rowActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 92 }, iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, smallIcon: { width: 28, height: 32, alignItems: "center", justifyContent: "center" },
    pendingCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.activeSoft, borderWidth: 1, borderColor: palette.active }, cancelPending: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
    pinLabel: { marginTop: spacing.xl, marginBottom: spacing.sm }, pinCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface }, pinIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: palette.activeSoft }, flex: { flex: 1 },
    actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }, secondaryButton: { minHeight: 46, flex: 1, flexDirection: "row", gap: spacing.xs, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border }, secondaryButtonText: { ...type.label, color: palette.accent, fontSize: 12 },
    primaryButton: { minHeight: 46, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep }, primaryButtonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    editor: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: palette.active, backgroundColor: palette.surface }, editorTitle: { ...type.heading, fontSize: 18 }, input: { ...type.body, minHeight: 52, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.borderSoft, borderRadius: radii.control, backgroundColor: palette.surfaceHigh }, pinInput: { textAlign: "center", letterSpacing: 7 },
    ownerDelayNote: { ...type.bodySoft, marginTop: spacing.md, color: palette.inkMuted },
    feedback: { ...type.label, marginTop: spacing.md }, recovery: { ...type.bodySoft, marginTop: spacing.xl, color: palette.inkMuted, textAlign: "center", fontSize: 11 }, disabled: { opacity: 0.45 },
  });
}
