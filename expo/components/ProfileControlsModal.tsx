import TextField from "@/components/TextField";
import { useDiscardChanges } from "@/hooks/useDiscardChanges";
import { useFeedback } from "@/hooks/useFeedback";
import { ArrowLeft, Check, ChevronRight, Clock3, LockKeyhole, Plus, UserRound, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Sheet from "@/components/Sheet";
import AllowancePicker from "@/components/AllowancePicker";
import ManagedPlaybackControlsEditor from "@/components/ManagedPlaybackControlsEditor";
import ManagedContentAccessEditor from "@/components/ManagedContentAccessEditor";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { fonts, radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { ManagedAllowance } from "@/models/dailyAllowance";
import type { ViewingAllowance, ViewingAllowanceStatus } from "@/models/viewingAllowance";
import type { Profile } from "@/models/profile";
import type { ManagedPlaybackControls } from "@/models/playbackControls";
import type { ManagedApprovalRequest, ManagedContentMode, ManagedContentOverview } from "@/models/managedContentAccess";
import { DEFAULT_MANAGED_PLAYBACK_CONTROLS, validateManagedPlaybackControls } from "@/domain/playbackControls";
import { useApp } from "@/providers/AppProvider";
import { OWNER_AUTHORIZATION_MS } from "@/domain/ownerAuthorization";

type Props = { visible: boolean; onClose: () => void };
type Editor =
  | { kind: "createStandard" }
  | { kind: "createManaged" }
  | { kind: "rename"; profile: Profile }
  | { kind: "allowance"; profile: Profile }
  | { kind: "controls"; profile: Profile }
  | { kind: "content"; profile: Profile }
  | { kind: "pin" }
  | { kind: "removePin" }
  | null;

/** Owner-authorized household profile, allowance, and PIN controls. */
export default function ProfileControlsModal({ visible, onClose }: Props) {
  const touch = useFeedback(visible);
  const {
    profiles, activeProfileId, profileSwitching, isOwnerAuthorized, ownerPinAvailability, hasOwnerPin,
    createStandardProfile, createManagedProfile, renameLocalProfile, reorderLocalProfile, deleteLocalProfile,
    setProfileViewingAllowance, getManagedPlaybackControls, setManagedPlaybackControls, cancelPendingOwnerAllowance, getPlaybackAllowance, switchProfile, saveOwnerPin, clearOwnerPin, relockOwnerAccess,
    getManagedContentOverview, setManagedContentMode, reviewManagedApprovalRequest, revokeManagedContent,
  } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [editor, setEditor] = useState<Editor>(null);
  const [value, setValue] = useState<string>("");
  const [confirmation, setConfirmation] = useState<string>("");
  const [currentPin, setCurrentPin] = useState<string>("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const [allowance, setAllowance] = useState<ViewingAllowance>({ mode: "dailyLimit", minutes: 30 });
  const [playbackTimesValid, setPlaybackTimesValid] = useState(true);
  const [playbackControls, setPlaybackControls] = useState<ManagedPlaybackControls>({ ...DEFAULT_MANAGED_PLAYBACK_CONTROLS });
  const initialAllowance = useRef(JSON.stringify({ mode: "dailyLimit", minutes: 30 }));
  const initialControls = useRef(JSON.stringify(DEFAULT_MANAGED_PLAYBACK_CONTROLS));
  const dirty = Boolean(editor && (
    (editor.kind === "rename" && value !== editor.profile.name) ||
    (editor.kind === "createStandard" && value.length > 0) ||
    (editor.kind === "createManaged" && (value.length > 0 || JSON.stringify(allowance) !== initialAllowance.current)) ||
    (editor.kind === "allowance" && JSON.stringify(allowance) !== initialAllowance.current) ||
    (editor.kind === "controls" && (!playbackTimesValid || JSON.stringify(playbackControls) !== initialControls.current)) ||
    (editor.kind === "pin" && Boolean(value || confirmation || currentPin)) ||
    (editor.kind === "removePin" && currentPin.length > 0)
  ));
  const [contentOverview, setContentOverview] = useState<ManagedContentOverview | null>(null);
  const [allowanceStatus, setAllowanceStatus] = useState<Record<string, ViewingAllowanceStatus>>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const confirmExit = useDiscardChanges(dirty, `${activeProfileId}:${selectedProfileId}:${editor?.kind}`, visible && isOwnerAuthorized && !profileSwitching && !busy);

  const refreshAllowances = useCallback(async (): Promise<void> => {
    const entries = await Promise.all(profiles.map(async (profile) => [profile.id, await getPlaybackAllowance(profile.id)] as const));
    setAllowanceStatus(Object.fromEntries(entries));
  }, [getPlaybackAllowance, profiles]);

  useEffect(() => { if (visible) void refreshAllowances().catch(() => setFeedback({ ok: false, message: "Allowances couldn’t load. Close this panel and try again." })); else { setSelectedProfileId(null); setEditor(null); setValue(""); setConfirmation(""); setCurrentPin(""); setFeedback(null); } }, [refreshAllowances, visible]);
  useEffect(() => { if (visible && !isOwnerAuthorized) onClose(); }, [isOwnerAuthorized, onClose, visible]);
  useEffect(() => {
    if (!visible || !hasOwnerPin) return;
    const timer = setTimeout(() => { relockOwnerAccess(); onClose(); }, OWNER_AUTHORIZATION_MS);
    return () => clearTimeout(timer);
  }, [hasOwnerPin, onClose, relockOwnerAccess, visible]);

  const close = (): void => {
    if (busy || profileSwitching) return;
    confirmExit(() => {
      setSelectedProfileId(null); setEditor(null); setValue(""); setConfirmation(""); setCurrentPin(""); setFeedback(null);
      relockOwnerAccess(); onClose();
    });
  };

  const begin = (next: Editor): void => {
    setPlaybackTimesValid(true);
    setEditor(next);
    setValue(next?.kind === "rename" ? next.profile.name : "");
    setConfirmation(""); setCurrentPin(""); setFeedback(null);
    if (next?.kind === "allowance") {
      if (!hasOwnerPin) {
        Alert.alert("Create an Owner PIN first", "Add an Owner PIN before enabling or changing viewing allowances.", [{ text: "Not now", style: "cancel" }, { text: "Add PIN", onPress: () => begin({ kind: "pin" }) }]);
        return;
      }
      const status = allowanceStatus[next.profile.id];
      const initial: ViewingAllowance = status?.kind === "unlimited" ? { mode: "unlimited" } : status?.kind === "limited" || status?.kind === "complete" ? { mode: "dailyLimit", minutes: status.allowanceMinutes } : { mode: "dailyLimit", minutes: 30 };
      initialAllowance.current = JSON.stringify(initial);
      setAllowance(initial);
    } else if (next?.kind === "createManaged") {
      initialAllowance.current = JSON.stringify({ mode: "dailyLimit", minutes: 30 });
      setAllowance({ mode: "dailyLimit", minutes: 30 });
    }
  };

  const beginAllowanceEditor = (profile: Profile): void => {
    if (profile.role === "owner" && allowanceStatus[profile.id]?.kind === "unlimited") {
      Alert.alert("Set your viewing limit", "Your limit takes effect when you save it. Increasing it or choosing Unlimited takes 24 hours. The PIN cannot shorten that wait. Settings remain available.", [
        { text: "Cancel", style: "cancel" },
        { text: "I understand", onPress: () => begin({ kind: "allowance", profile }) },
      ]);
      return;
    }
    begin({ kind: "allowance", profile });
  };

  const beginControlsEditor = async (profile: Profile): Promise<void> => {
    if (!hasOwnerPin) {
      Alert.alert("Create an Owner PIN first", "Set an Owner PIN to protect viewing schedules, required breaks, and Pause Frame.", [{ text: "Not now", style: "cancel" }, { text: "Add PIN", onPress: () => begin({ kind: "pin" }) }]);
      return;
    }
    setBusy(true);
    try {
      const controls = await getManagedPlaybackControls(profile.id);
      initialControls.current = JSON.stringify(controls);
      setPlaybackControls(controls);
      begin({ kind: "controls", profile });
    } catch (error) {
      setFeedback({ ok: false, message: error instanceof Error ? error.message : "Frame couldn’t load those controls." });
    } finally { setBusy(false); }
  };

  const beginContentEditor = async (profile: Profile): Promise<void> => {
    if (!hasOwnerPin) {
      Alert.alert("Create an Owner PIN first", "Set an Owner PIN to manage video and source approvals.", [{ text: "Not now", style: "cancel" }, { text: "Add PIN", onPress: () => begin({ kind: "pin" }) }]);
      return;
    }
    setBusy(true);
    try {
      setContentOverview(await getManagedContentOverview(profile.id));
      begin({ kind: "content", profile });
    } catch (error) {
      setFeedback({ ok: false, message: error instanceof Error ? error.message : "Frame couldn’t load content controls." });
    } finally { setBusy(false); }
  };

  const changeContentMode = async (profile: Profile, mode: ManagedContentMode): Promise<void> => {
    if (busy || contentOverview?.policy.mode === mode) return;
    const done = touch.capture();
    setBusy(true);
    try {
    const result = await setManagedContentMode(profile.id, mode);
    setFeedback(result);
    done("commit", result.ok);
    if (result.ok) setContentOverview(await getManagedContentOverview(profile.id));
    } catch { setFeedback({ ok: false, message: "That change couldn’t finish. Check the current settings before trying again." }); }
    finally { setBusy(false); }
  };

  const reviewRequest = async (profile: Profile, request: ManagedApprovalRequest, decision: "approve" | "deny"): Promise<void> => {
    if (busy) return;
    const done = touch.capture();
    setBusy(true);
    try {
    const result = await reviewManagedApprovalRequest(profile.id, request, decision);
    setFeedback(result);
    done("commit", result.ok && decision === "approve");
    if (result.ok) setContentOverview(await getManagedContentOverview(profile.id));
    } catch { setFeedback({ ok: false, message: "That change couldn’t finish. Check the current settings before trying again." }); }
    finally { setBusy(false); }
  };

  const revokeContent = async (profile: Profile, kind: "video" | "source", targetId: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
    const result = await revokeManagedContent(profile.id, kind, targetId);
    setFeedback(result);
    if (result.ok) setContentOverview(await getManagedContentOverview(profile.id));
    } catch { setFeedback({ ok: false, message: "That change couldn’t finish. Check the current settings before trying again." }); }
    finally { setBusy(false); }
  };

  const submitEditor = async (): Promise<void> => {
    if (!editor || busy) return;
    if (editor.kind === "content") return;
    if (editor.kind === "controls" && (!playbackTimesValid || validateManagedPlaybackControls(playbackControls))) return;
    if (editor.kind === "pin" && value !== confirmation) return setFeedback({ ok: false, message: "Those PINs don’t match." });
    const done = touch.capture();
    setBusy(true);
    try {
    const result = editor.kind === "createStandard" ? await createStandardProfile(value)
      : editor.kind === "createManaged" ? await createManagedProfile(value, allowance as ManagedAllowance)
        : editor.kind === "rename" ? await renameLocalProfile(editor.profile.id, value)
          : editor.kind === "allowance" ? await setProfileViewingAllowance(editor.profile.id, allowance)
            : editor.kind === "controls" ? await setManagedPlaybackControls(editor.profile.id, playbackControls)
            : editor.kind === "removePin" ? await clearOwnerPin(currentPin)
              : await saveOwnerPin(value, currentPin);
    setFeedback(result);
    if (result.ok) {
      if (editor.kind !== "removePin") done("commit");
      const createdManagedWithoutPin = editor.kind === "createManaged" && !hasOwnerPin;
      setEditor(null); setValue(""); setConfirmation(""); setCurrentPin("");
      await refreshAllowances();
      if (createdManagedWithoutPin) Alert.alert("Add an Owner PIN when ready", "Add an Owner PIN in Profiles & boundaries to protect Managed profile settings.");
    }
    } catch { setFeedback({ ok: false, message: "That change couldn’t finish. Check the current settings before trying again." }); }
    finally { setBusy(false); }
  };

  const confirmDelete = (profile: Profile): void => {
    Alert.alert(`Delete ${profile.name}?`, "This permanently removes only this profile’s sources, library, progress, sessions, interests, appearance, Daily Frame time, playback schedule, content approvals, and approval requests from this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete profile", style: "destructive", onPress: async () => {
        setBusy(true);
        try { setFeedback(await deleteLocalProfile(profile.id)); }
        catch { setFeedback({ ok: false, message: "The profile couldn’t be deleted. Check the list and try again." }); }
        finally { setBusy(false); }
      } },
    ]);
  };

  const cancelPending = async (): Promise<void> => {
    if (busy) return;
    const done = touch.capture();
    setBusy(true);
    try {
      const result = await cancelPendingOwnerAllowance();
      setFeedback(result);
      done("commit", result.ok);
      if (result.ok) await refreshAllowances();
    } catch { setFeedback({ ok: false, message: "The pending change couldn’t be updated. Try again." }); }
    finally { setBusy(false); }
  };

  const confirmRemovePin = (): void => begin({ kind: "removePin" });

  const chooseProfile = async (profileId: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await switchProfile(profileId);
      setFeedback(result);
      if (result.ok) { relockOwnerAccess(); onClose(); }
    } catch { setFeedback({ ok: false, message: "The profile couldn’t switch. Try again." }); }
    finally { setBusy(false); }
  };

  const reorder = async (profileId: string, direction: "up" | "down"): Promise<void> => {
    if (busy) return;
    const done = touch.capture();
    setBusy(true);
    try { const result = await reorderLocalProfile(profileId, direction); setFeedback(result); done("selection", result.ok); }
    catch { setFeedback({ ok: false, message: "The order couldn’t be saved. Try again." }); }
    finally { setBusy(false); }
  };

  const statusLabel = (profile: Profile): string => {
    const role = profile.role === "owner" ? "Owner" : profile.role === "managed" ? "Managed" : "Standard";
    const status = allowanceStatus[profile.id];
    if (!status) return `${role} · checking allowance…`;
    if (status.kind === "unlimited") return `${role} · Unlimited`;
    if (status.kind === "ownerReview") return `${role} · Owner review needed`;
    if (status.kind === "restricted") return `${role} · ${status.restriction === "paused" ? "Paused" : "Not available now"}`;
    return `${role} · ${status.allowanceMinutes} min daily`;
  };

  const canCreate = profiles.length < PRODUCT_LIMITS.futureProfilesPerHousehold;
  const localProfiles = profiles.filter((profile) => profile.role !== "owner");
  const pinUnavailable = ownerPinAvailability !== "available";
  const editorNeedsName = editor?.kind === "createStandard" || editor?.kind === "createManaged" || editor?.kind === "rename";
  const allowanceInvalid = (editor?.kind === "createManaged" || editor?.kind === "allowance")
    && allowance.mode === "dailyLimit" && (!Number.isInteger(allowance.minutes) || allowance.minutes < 1 || allowance.minutes > 1_440);
  const controlsInvalid = editor?.kind === "controls" && (!playbackTimesValid || Boolean(validateManagedPlaybackControls(playbackControls)));
  const editorInvalid = busy || allowanceInvalid || controlsInvalid || ((editorNeedsName || editor?.kind === "pin") && !value.trim()) || ((editor?.kind === "pin" && hasOwnerPin || editor?.kind === "removePin") && currentPin.length < 4);

  const back = (): void => {
    if (busy || profileSwitching) return;
    if (editor) confirmExit(() => begin(null));
    else if (selectedProfileId) { setSelectedProfileId(null); setFeedback(null); }
    else close();
  };
  const selectedIndex = localProfiles.findIndex((profile) => profile.id === selectedProfileId);
  const detailAction = (label: string, onPress: () => void, disabled = false, destructive = false) => (
    <Pressable onPress={onPress} disabled={busy || disabled} style={[styles.detailAction, (busy || disabled) && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }}>
      <Text style={[styles.detailActionText, destructive && { color: palette.danger }]}>{label}</Text>
      <ChevronRight size={18} color={destructive ? palette.danger : palette.inkMuted} />
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={close} onBack={back} contentKey={`${selectedProfileId ?? "profiles"}:${editor?.kind ?? "overview"}`}>
      <View style={styles.detailHeader}>
        {editor || selectedProfile ? <Pressable onPress={back} disabled={busy} style={styles.backButton} accessibilityRole="button" accessibilityLabel={editor ? "Back to profile controls" : "Back to profiles"}><ArrowLeft size={20} color={palette.ink} /><Text style={type.label}>Back</Text></Pressable> : <View />}
        <Pressable onPress={close} disabled={busy || profileSwitching} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close profiles and boundaries"><X size={20} color={palette.ink} /></Pressable>
      </View>
      <Text style={styles.heading} accessibilityRole="header">{selectedProfile?.name ?? "Profiles & boundaries"}</Text>
      {!editor && !selectedProfile ? <>
        <Text style={styles.boundaryText}>Manage profiles, viewing limits, and approvals. These settings apply only in Frame.</Text>
        <View style={styles.sectionHeader}><Text style={styles.sectionLabel}>Profiles · {profiles.length} of {PRODUCT_LIMITS.futureProfilesPerHousehold}</Text></View>
        <View style={styles.profileList}>{profiles.map((profile) => (
          <Pressable key={profile.id} onPress={() => { setSelectedProfileId(profile.id); setFeedback(null); }} style={styles.profileRow} accessibilityRole="button" accessibilityLabel={`Manage ${profile.name}. ${statusLabel(profile)}${profile.id === activeProfileId ? ". Current profile" : ""}`}>
            <View style={styles.avatar}><UserRound size={20} color={palette.active} /></View>
            <View style={styles.flex}><Text style={styles.profileName}>{profile.name}</Text><Text style={styles.profileRole}>{statusLabel(profile)}</Text>{profile.id === activeProfileId ? <Text style={styles.profileRole}>Watching now</Text> : null}</View>
            <ChevronRight size={20} color={palette.inkMuted} />
          </Pressable>
        ))}</View>
        {canCreate ? <View style={styles.actionRow}><Pressable onPress={() => begin({ kind: "createStandard" })} style={styles.secondaryButton} accessibilityRole="button"><Plus size={16} color={palette.active} /><Text style={styles.secondaryButtonText}>Add Standard</Text></Pressable><Pressable onPress={() => begin({ kind: "createManaged" })} style={styles.secondaryButton} accessibilityRole="button"><Clock3 size={16} color={palette.active} /><Text style={styles.secondaryButtonText}>Add Managed</Text></Pressable></View> : null}
        <Text style={styles.profileRole}>Standard profiles choose their own content. Managed profiles use limits and approvals set by the Owner.</Text>
          {profiles.map((profile) => {
            const status = allowanceStatus[profile.id];
            const pending = status && "pendingChange" in status ? status.pendingChange : undefined;
            if (!pending) return null;
            const label = pending.allowance.mode === "unlimited" ? "Unlimited" : `${pending.allowance.minutes} minutes`;
            return <View key={`pending-${profile.id}`} style={styles.pendingCard} accessible accessibilityLabel={`Pending Owner allowance change to ${label}`}><Clock3 size={18} color={palette.active} /><View style={styles.flex}><Text style={styles.profileName}>Pending Owner change</Text><Text style={styles.profileRole}>{label} activates {new Date(pending.activatesAt).toLocaleString()}.</Text></View><Pressable onPress={() => { void cancelPending(); }} disabled={busy} style={styles.cancelPending} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable></View>;
          })}

          <Text style={[styles.sectionLabel, styles.pinLabel]}>Owner PIN</Text>
          <View style={styles.pinCard}><View style={styles.pinIcon}><LockKeyhole size={19} color={palette.active} /></View><View style={styles.flex}><Text style={styles.profileName}>{hasOwnerPin ? "PIN is on" : "PIN is off"}</Text><Text style={styles.profileRole}>{pinUnavailable ? "Set up a PIN in the iPhone or Android app." : hasOwnerPin ? "Protects Managed profile settings and access to the Owner profile." : "Add a PIN to protect Managed profile settings."}</Text></View></View>
          {!pinUnavailable ? <View style={styles.actionRow}><Pressable onPress={() => begin({ kind: "pin" })} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{hasOwnerPin ? "Change PIN" : "Add PIN"}</Text></Pressable>{hasOwnerPin ? <Pressable onPress={confirmRemovePin} style={styles.secondaryButton}><Text style={[styles.secondaryButtonText, { color: palette.danger }]}>Remove PIN</Text></Pressable> : null}</View> : null}


      </> : null}
      {!editor && selectedProfile ? <>
        <Text style={styles.boundaryText}>{statusLabel(selectedProfile)}</Text>
        {selectedProfile.id === activeProfileId ? <View style={styles.currentProfile}><Check size={18} color={palette.active} /><Text style={type.label}>Watching now</Text></View> : detailAction("Switch to this profile", () => { void chooseProfile(selectedProfile.id); })}
        <Text style={styles.sectionLabel}>Playback</Text>
        {detailAction("Daily viewing allowance", () => beginAllowanceEditor(selectedProfile))}
        {selectedProfile.role === "managed" ? <>
          {detailAction("Schedule and Pause Frame", () => { void beginControlsEditor(selectedProfile); })}
          {detailAction("Content access and requests", () => { void beginContentEditor(selectedProfile); })}
        </> : null}
        {selectedProfile.role !== "owner" ? <>
          <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Profile</Text>
          {detailAction("Rename profile", () => begin({ kind: "rename", profile: selectedProfile }))}
          {detailAction("Move earlier in the list", () => { void reorder(selectedProfile.id, "up"); }, selectedIndex <= 0)}
          {detailAction("Move later in the list", () => { void reorder(selectedProfile.id, "down"); }, selectedIndex >= localProfiles.length - 1)}
          {detailAction("Delete profile", () => confirmDelete(selectedProfile), false, true)}
        </> : null}
      </> : null}
          {editor ? <View style={styles.editor}>
            <Text style={styles.editorTitle}>{editor.kind === "createStandard" ? "New Standard profile" : editor.kind === "createManaged" ? "New Managed profile" : editor.kind === "rename" ? `Rename ${editor.profile.name}` : editor.kind === "allowance" ? `${editor.profile.name} · Daily viewing allowance` : editor.kind === "controls" ? `${editor.profile.name} · Playback schedule` : editor.kind === "content" ? `${editor.profile.name} · Content access` : editor.kind === "removePin" ? "Remove Owner PIN" : hasOwnerPin ? "Change Owner PIN" : "Add Owner PIN"}</Text>
            {(editor.kind === "pin" && hasOwnerPin || editor.kind === "removePin") ? <><Text style={[type.label, { marginTop: spacing.md }]}>Current Owner PIN</Text><TextField editable={!busy} value={currentPin} onChangeText={(text) => setCurrentPin(text.replace(/\D/g, "").slice(0, 6))} placeholder="Current Owner PIN" placeholderTextColor={palette.inkMuted} containerStyle={styles.input} style={styles.pinInput} keyboardType="number-pad" secureTextEntry maxLength={6} autoFocus accessibilityLabel="Current Owner PIN" /></> : null}
            {editorNeedsName || editor.kind === "pin" ? <><Text style={[type.label, { marginTop: spacing.md }]}>{editor.kind === "pin" ? "New Owner PIN" : "Profile name"}</Text><TextField editable={!busy} value={value} onChangeText={(text) => { setValue(editor.kind === "pin" ? text.replace(/\D/g, "").slice(0, 6) : text); setFeedback(null); }} placeholder={editor.kind === "pin" ? "4–6 digit PIN" : "Profile name"} placeholderTextColor={palette.inkMuted} containerStyle={styles.input} style={editor.kind === "pin" && styles.pinInput} keyboardType={editor.kind === "pin" ? "number-pad" : "default"} secureTextEntry={editor.kind === "pin"} maxLength={editor.kind === "pin" ? 6 : 32} autoFocus={!hasOwnerPin || editor.kind !== "pin"} accessibilityLabel={editor.kind === "pin" ? "New Owner PIN" : "Profile name"} /></> : null}
            {editor.kind === "pin" ? <><Text style={[type.label, { marginTop: spacing.md }]}>Repeat new Owner PIN</Text><TextField editable={!busy} value={confirmation} onChangeText={(text) => { setConfirmation(text.replace(/\D/g, "").slice(0, 6)); setFeedback(null); }} placeholder="Repeat PIN" placeholderTextColor={palette.inkMuted} containerStyle={styles.input} style={styles.pinInput} keyboardType="number-pad" secureTextEntry maxLength={6} accessibilityLabel="Repeat new Owner PIN" /></> : null}
            {editor.kind === "createManaged" || editor.kind === "allowance" ? <AllowancePicker value={allowance} onChange={setAllowance} /> : null}
            {editor.kind === "controls" ? <ManagedPlaybackControlsEditor value={playbackControls} onChange={(next) => { setPlaybackControls(next); setFeedback(null); }} onValidityChange={setPlaybackTimesValid} /> : null}
            {editor.kind === "content" && contentOverview ? <ManagedContentAccessEditor value={contentOverview} busy={busy} onModeChange={(mode) => { void changeContentMode(editor.profile, mode); }} onReview={(request, decision) => { void reviewRequest(editor.profile, request, decision); }} onRevoke={(kind, targetId) => { void revokeContent(editor.profile, kind, targetId); }} /> : null}
            {controlsInvalid ? <Text style={[styles.feedback, { color: palette.danger }]}>{!playbackTimesValid ? "Enter valid times before saving." : validateManagedPlaybackControls(playbackControls)}</Text> : null}
            {editor.kind === "allowance" && editor.profile.role === "owner" ? <Text style={styles.ownerDelayNote}>Setting or reducing your limit takes effect when you save. Increasing it or choosing Unlimited takes 24 hours, even with the Owner PIN.</Text> : null}
            {editor.kind === "content" ? <Pressable disabled={busy} accessibilityRole="button" onPress={() => begin(null)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Done</Text></Pressable> : <View style={styles.actionRow}><Pressable disabled={busy} accessibilityRole="button" onPress={back} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { void submitEditor(); }} disabled={editorInvalid} style={[styles.primaryButton, editorInvalid && styles.disabled]}>{busy ? <ActivityIndicator color={palette.onDark} /> : <Text style={styles.primaryButtonText}>{editor.kind === "removePin" ? "Remove PIN" : "Save"}</Text>}</Pressable></View>}
          </View> : null}

      {feedback ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text> : null}
      {!editor && !selectedProfile ? <Text style={styles.recovery}>A forgotten Owner PIN can only be reset by erasing all Frame data on this device. These controls do not block other apps.</Text> : null}
    </Sheet>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    backButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    detailAction: { minHeight: 56, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.borderSoft },
    detailActionText: { ...type.body, flex: 1 },
    currentProfile: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay },
    card: { ...softShadow, maxHeight: "94%", paddingTop: spacing.md, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    handle: { width: 36, height: 4, alignSelf: "center", marginBottom: spacing.md, borderRadius: 2, backgroundColor: palette.surfaceDeep },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
    eyebrow: { ...type.caption, color: palette.accent }, heading: { ...type.heading, fontSize: 24, marginTop: spacing.xs }, closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    scroll: { marginTop: spacing.sm }, scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 44 },
    boundaryCard: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.activeSoft }, boundaryText: { ...type.bodySoft, color: palette.inkMuted },
    sectionHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg }, sectionLabel: { ...type.caption, color: palette.inkMuted },
    profileList: { marginTop: spacing.md, gap: spacing.sm }, profileRow: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface }, profileRowActive: { borderColor: palette.active, backgroundColor: palette.activeSoft },
    avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: palette.surfaceHigh }, profileMain: { flex: 1, minHeight: 60, justifyContent: "center" }, profileName: { ...type.label, fontSize: 14 }, profileRole: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted, fontSize: 11 },
    rowActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 92 }, iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, smallIcon: { width: 28, height: 32, alignItems: "center", justifyContent: "center" },
    pendingCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.activeSoft, borderWidth: 1, borderColor: palette.active }, cancelPending: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm },
    pinLabel: { marginTop: spacing.xl, marginBottom: spacing.sm }, pinCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface }, pinIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: palette.activeSoft }, flex: { flex: 1 },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }, secondaryButton: { minHeight: 48, minWidth: 110, flex: 1, flexDirection: "row", gap: spacing.xs, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border }, secondaryButtonText: { ...type.label, flexShrink: 1, textAlign: "center", color: palette.accent, fontSize: 12 },
    primaryButton: { minHeight: 48, minWidth: 110, flexGrow: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep }, primaryButtonText: { textAlign: "center", color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    editor: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }, editorTitle: { ...type.heading, fontSize: 18 }, input: { marginTop: spacing.sm }, pinInput: { textAlign: "center" },
    ownerDelayNote: { ...type.bodySoft, marginTop: spacing.md, color: palette.inkMuted },
    feedback: { ...type.label, marginTop: spacing.md }, recovery: { ...type.bodySoft, marginTop: spacing.xl, color: palette.inkMuted, textAlign: "center", fontSize: 11 }, disabled: { opacity: 0.45 },
  });
}

