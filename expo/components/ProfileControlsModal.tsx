import { Check, ChevronRight, LockKeyhole, Pencil, Plus, ShieldCheck, Trash2, UserRound, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { Profile } from "@/models/profile";
import { useApp } from "@/providers/AppProvider";

type Props = { visible: boolean; onClose: () => void };
type Editor = { kind: "create" } | { kind: "rename"; profile: Profile } | { kind: "pin" } | null;

/** Owner-authorized household profile and PIN controls. */
export default function ProfileControlsModal({ visible, onClose }: Props) {
  const {
    profiles,
    activeProfileId,
    profileSwitching,
    isOwnerAuthorized,
    ownerPinAvailability,
    hasOwnerPin,
    createStandardProfile,
    renameStandardProfile,
    deleteLocalProfile,
    switchProfile,
    saveOwnerPin,
    clearOwnerPin,
    relockOwnerAccess,
  } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [editor, setEditor] = useState<Editor>(null);
  const [value, setValue] = useState<string>("");
  const [confirmation, setConfirmation] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const close = (): void => {
    if (busy || profileSwitching) return;
    setEditor(null);
    setValue("");
    setConfirmation("");
    setFeedback(null);
    relockOwnerAccess();
    onClose();
  };

  useEffect(() => {
    if (visible && !isOwnerAuthorized) onClose();
  }, [isOwnerAuthorized, onClose, visible]);

  const begin = (next: Editor): void => {
    setEditor(next);
    setValue(next?.kind === "rename" ? next.profile.name : "");
    setConfirmation("");
    setFeedback(null);
  };

  const submitEditor = async (): Promise<void> => {
    if (!editor || busy) return;
    if (editor.kind === "pin" && value !== confirmation) {
      setFeedback({ ok: false, message: "Those PINs don’t match." });
      return;
    }
    setBusy(true);
    const result = editor.kind === "create"
      ? await createStandardProfile(value)
      : editor.kind === "rename"
        ? await renameStandardProfile(editor.profile.id, value)
        : await saveOwnerPin(value);
    setBusy(false);
    setFeedback(result);
    if (result.ok) {
      setEditor(null);
      setValue("");
      setConfirmation("");
    }
  };

  const confirmDelete = (profile: Profile): void => {
    Alert.alert(
      `Delete ${profile.name}?`,
      "This permanently removes only this profile’s sources, library, progress, sessions, interests, searches, and appearance from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete profile",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const result = await deleteLocalProfile(profile.id);
            setBusy(false);
            setFeedback(result);
          },
        },
      ],
    );
  };

  const confirmRemovePin = (): void => {
    Alert.alert("Remove Owner PIN?", "Protected household controls and Owner entry will no longer ask for a PIN.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove PIN", style: "destructive", onPress: async () => {
        setBusy(true);
        const result = await clearOwnerPin();
        setBusy(false);
        setFeedback(result);
      } },
    ]);
  };

  const chooseProfile = async (profileId: string): Promise<void> => {
    setBusy(true);
    const result = await switchProfile(profileId);
    setBusy(false);
    setFeedback(result);
    if (result.ok) close();
  };

  const standardProfiles = profiles.filter((profile) => profile.role === "standard");
  const canCreate = profiles.length < PRODUCT_LIMITS.futureProfilesPerHousehold;
  const pinUnavailable = ownerPinAvailability !== "available";

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View><Text style={styles.eyebrow}>Protected controls</Text><Text style={styles.heading}>Profiles & boundaries</Text></View>
            <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close protected controls"><X size={18} color={palette.inkMuted} /></Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.boundaryCard}><ShieldCheck size={20} color={palette.active} /><Text style={styles.boundaryText}>The Owner PIN is a household boundary inside Frame. It is not encryption, parental controls, or device-wide protection.</Text></View>

            <View style={styles.sectionHeader}><Text style={styles.sectionLabel}>Profiles · {profiles.length} of {PRODUCT_LIMITS.futureProfilesPerHousehold}</Text>{canCreate ? <Pressable onPress={() => begin({ kind: "create" })} style={styles.addButton} accessibilityRole="button"><Plus size={16} color={palette.active} /><Text style={styles.addText}>Add Standard</Text></Pressable> : null}</View>
            {profiles.filter((profile) => profile.role !== "managed").map((profile) => {
              const active = profile.id === activeProfileId;
              return (
                <View key={profile.id} style={[styles.profileRow, active && styles.profileRowActive]}>
                  <View style={styles.avatar}><UserRound size={18} color={active ? palette.active : palette.inkMuted} /></View>
                  <Pressable onPress={() => { if (!active) void chooseProfile(profile.id); }} disabled={active || busy} style={styles.profileMain} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    <Text style={styles.profileName}>{profile.name}</Text><Text style={styles.profileRole}>{profile.role === "owner" ? "Owner · preserved profile" : "Standard · local only"}</Text>
                  </Pressable>
                  {active ? <Check size={17} color={palette.active} /> : <ChevronRight size={17} color={palette.inkMuted} />}
                  {profile.role === "standard" ? <>
                    <Pressable onPress={() => begin({ kind: "rename", profile })} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Rename ${profile.name}`}><Pencil size={16} color={palette.inkMuted} /></Pressable>
                    <Pressable onPress={() => confirmDelete(profile)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Delete ${profile.name}`}><Trash2 size={16} color={palette.danger} /></Pressable>
                  </> : null}
                </View>
              );
            })}
            {standardProfiles.length === 0 ? <Text style={styles.empty}>Add a Standard profile for another person without changing the Owner’s library.</Text> : null}

            <Text style={[styles.sectionLabel, styles.pinLabel]}>Owner PIN</Text>
            <View style={styles.pinCard}>
              <View style={styles.pinIcon}><LockKeyhole size={19} color={palette.active} /></View>
              <View style={styles.flex}><Text style={styles.profileName}>{hasOwnerPin ? "PIN is on" : "PIN is off"}</Text><Text style={styles.profileRole}>{pinUnavailable ? "Persistent PIN setup requires the iPhone or Android app." : hasOwnerPin ? "Required to enter Owner and these controls from another profile." : "Optional household boundary for Owner access."}</Text></View>
            </View>
            {!pinUnavailable ? <View style={styles.actionRow}>
              <Pressable onPress={() => begin({ kind: "pin" })} style={styles.secondaryButton} accessibilityRole="button"><Text style={styles.secondaryButtonText}>{hasOwnerPin ? "Change PIN" : "Add PIN"}</Text></Pressable>
              {hasOwnerPin ? <Pressable onPress={confirmRemovePin} style={styles.secondaryButton} accessibilityRole="button"><Text style={[styles.secondaryButtonText, { color: palette.danger }]}>Remove PIN</Text></Pressable> : null}
            </View> : null}

            {editor ? <View style={styles.editor}>
              <Text style={styles.editorTitle}>{editor.kind === "create" ? "New Standard profile" : editor.kind === "rename" ? `Rename ${editor.profile.name}` : hasOwnerPin ? "Change Owner PIN" : "Add Owner PIN"}</Text>
              <TextInput
                value={value}
                onChangeText={(text) => { setValue(editor.kind === "pin" ? text.replace(/\D/g, "").slice(0, 6) : text); setFeedback(null); }}
                placeholder={editor.kind === "pin" ? "4–6 digit PIN" : "Profile name"}
                placeholderTextColor={palette.inkMuted}
                style={[styles.input, editor.kind === "pin" && styles.pinInput]}
                keyboardType={editor.kind === "pin" ? "number-pad" : "default"}
                secureTextEntry={editor.kind === "pin"}
                maxLength={editor.kind === "pin" ? 6 : 32}
                autoFocus
                accessibilityLabel={editor.kind === "pin" ? "New Owner PIN" : "Profile name"}
              />
              {editor.kind === "pin" ? <TextInput value={confirmation} onChangeText={(text) => { setConfirmation(text.replace(/\D/g, "").slice(0, 6)); setFeedback(null); }} placeholder="Repeat PIN" placeholderTextColor={palette.inkMuted} style={[styles.input, styles.pinInput]} keyboardType="number-pad" secureTextEntry maxLength={6} accessibilityLabel="Repeat new Owner PIN" /> : null}
              <View style={styles.actionRow}><Pressable onPress={() => begin(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable onPress={() => { void submitEditor(); }} disabled={busy || !value.trim()} style={[styles.primaryButton, (!value.trim() || busy) && styles.disabled]}>{busy ? <ActivityIndicator color={palette.onDark} /> : <Text style={styles.primaryButtonText}>Save</Text>}</Pressable></View>
            </View> : null}
            {feedback ? <Text style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text> : null}
            <Text style={styles.recovery}>Forgotten PINs cannot be recovered from the cloud. Frame does not yet offer a household-wide reset.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay },
    card: { ...softShadow, maxHeight: "92%", paddingTop: spacing.md, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    handle: { width: 36, height: 4, alignSelf: "center", marginBottom: spacing.md, borderRadius: 2, backgroundColor: palette.surfaceDeep },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
    eyebrow: { ...type.caption, color: palette.accent }, heading: { ...type.heading, fontSize: 24, marginTop: spacing.xs },
    closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    scroll: { marginTop: spacing.sm }, scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 44 },
    boundaryCard: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.activeSoft },
    boundaryText: { ...type.bodySoft, flex: 1, color: palette.inkMuted },
    sectionHeader: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
    sectionLabel: { ...type.caption, color: palette.inkMuted },
    addButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm }, addText: { ...type.label, color: palette.active, fontSize: 12 },
    profileRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    profileRowActive: { borderColor: palette.active, backgroundColor: palette.activeSoft },
    avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: palette.surfaceHigh },
    profileMain: { flex: 1, minHeight: 60, justifyContent: "center" }, profileName: { ...type.label, fontSize: 14 }, profileRole: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted, fontSize: 11 },
    iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, empty: { ...type.bodySoft, color: palette.inkMuted, marginBottom: spacing.sm },
    pinLabel: { marginTop: spacing.xl, marginBottom: spacing.sm }, pinCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface }, pinIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: palette.activeSoft }, flex: { flex: 1 },
    actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }, secondaryButton: { minHeight: 46, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border }, secondaryButtonText: { ...type.label, color: palette.accent },
    primaryButton: { minHeight: 46, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep }, primaryButtonText: { color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    editor: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: palette.active, backgroundColor: palette.surface }, editorTitle: { ...type.heading, fontSize: 18 },
    input: { ...type.body, minHeight: 52, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.borderSoft, borderRadius: radii.control, backgroundColor: palette.surfaceHigh }, pinInput: { textAlign: "center", letterSpacing: 7 },
    feedback: { ...type.label, marginTop: spacing.md }, recovery: { ...type.bodySoft, marginTop: spacing.xl, color: palette.inkMuted, textAlign: "center", fontSize: 11 }, disabled: { opacity: 0.45 },
  });
}
