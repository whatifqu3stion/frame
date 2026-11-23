import { confirmUser } from "@/services/notifyUser";
import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import ChoiceOption from "@/components/ChoiceOption";
import SettingsRow from "@/components/SettingsRow";
import ActionReveal from "@/components/motion/ActionReveal";
import { useApprovalRequestCounts } from "@/hooks/useApprovalRequestCounts";
import TextField from "@/components/TextField";
import { useDiscardChanges } from "@/hooks/useDiscardChanges";
import { useFeedback } from "@/hooks/useFeedback";
import { ArrowLeft, Check, ChevronRight, Clock3, LockKeyhole, Plus, UserRound, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
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

type Props = { visible: boolean; returnFocusTarget?: HTMLElement | null; initialReviewId?: string | null; onClose: () => void };
const controlNames = {
  allowance: "Daily viewing limit",
  controls: "Schedule & pauses",
  content: "Content & requests",
} as const;
type ProtectedControl = keyof typeof controlNames;
type ControlDestination = { kind: ProtectedControl; profileId: string; activeId: string };
type Editor =
  | { kind: "chooseRole" }
  | { kind: "createStandard" }
  | { kind: "createManaged" }
  | { kind: "rename"; profile: Profile }
  | { kind: "allowance"; profile: Profile; saved: ViewingAllowance }
  | { kind: "controls"; profile: Profile }
  | { kind: "content"; profile: Profile }
  | { kind: "pin"; destination?: ControlDestination }
  | { kind: "removePin" }
  | null;

/** Owner-authorized household profile, allowance, and PIN controls. */
export default function ProfileControlsModal({ visible, initialReviewId, returnFocusTarget, onClose }: Props) {
  const touch = useFeedback(visible);
  const {
    profiles, activeProfileId, profileSwitching, isOwnerAuthorized, ownerPinAvailability, hasOwnerPin,
    createStandardProfile, createManagedProfile, renameLocalProfile, reorderLocalProfile, deleteLocalProfile,
    getProfileViewingAllowance, setProfileViewingAllowance, getManagedPlaybackControls, setManagedPlaybackControls, cancelPendingOwnerAllowance, getPlaybackAllowance, switchProfile, saveOwnerPin, clearOwnerPin, relockOwnerAccess,
    requestOwnerAuthorization, inspectManagedApprovalRequest, getManagedContentOverview, setManagedContentMode, reviewManagedApprovalRequest, revokeManagedContent,
  } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const requestCounts = useApprovalRequestCounts(visible);
  const reviewReturn = useRef(false);
  const [savedPinInstruction, setSavedPinInstruction] = useState<string | null>(null);
  const autoVerify = useRef(false);
  const [allowanceFocusId, setAllowanceFocusId] = useState<string | null>(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [unlockingReview, setUnlockingReview] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [value, setValue] = useState<string>("");
  const [confirmation, setConfirmation] = useState<string>("");
  const [currentPin, setCurrentPin] = useState<string>("");
  const [newPinFocusId, setNewPinFocusId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const [ownerCommitment, setOwnerCommitment] = useState(false);
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
  const [working, setWorking] = useState<boolean>(false);
  const [pendingControl, setPendingControl] = useState<ControlDestination | null>(null);
  const busy = working || Boolean(pendingControl && isOwnerAuthorized && hasOwnerPin);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string; revealKey?: string } | null>(null);
  const pinUnavailable = ownerPinAvailability !== "available";
  const pinUnavailableMessage = ownerPinAvailability === "web"
    ? "Owner PIN controls are available in the iPhone or Android app."
    : "Secure PIN storage is unavailable. Close and reopen Frame to try again.";

  const openedReview = useRef<string | null>(null);
  // A pending-request shortcut still goes through Owner authorization and the same content service.
  useEffect(() => {
    if (!visible) { openedReview.current = null; return; }
    if (!initialReviewId || openedReview.current === initialReviewId || !isOwnerAuthorized) return;
    const profile = profiles.find((candidate) => candidate.id === initialReviewId && candidate.role === "managed");
    if (!profile) return;
    setSelectedProfileId(profile.id);
    if (pinUnavailable || !hasOwnerPin) { openedReview.current = initialReviewId; return; }
    let current = true;
    setWorking(true);
    void getManagedContentOverview(profile.id).then((overview) => {
      if (current) { openedReview.current = initialReviewId; setContentOverview(overview); if (overview.requests.length === 1) setExpandedRequest(`${overview.requests[0].kind}:${overview.requests[0].targetId}`); setEditor({ kind: "content", profile }); }
    }).catch(() => {
      if (current) setFeedback({ ok: false, message: "Requests couldn’t load. Open Content access and requests to try again." });
    }).finally(() => { if (current) setWorking(false); });
    return () => { current = false; setWorking(false); };
  }, [visible, initialReviewId, isOwnerAuthorized, profiles, pinUnavailable, hasOwnerPin, getManagedContentOverview]);

  const confirmExit = useDiscardChanges(dirty, `${activeProfileId}:${selectedProfileId}:${editor?.kind}`, visible && isOwnerAuthorized && !profileSwitching && !busy);

  const refreshAllowances = useCallback(async (): Promise<void> => {
    const entries = await Promise.all(profiles.map(async (profile) => [profile.id, await getPlaybackAllowance(profile.id)] as const));
    setAllowanceStatus(Object.fromEntries(entries));
  }, [getPlaybackAllowance, profiles]);

  useEffect(() => { if (visible) void refreshAllowances().catch(() => setFeedback({ ok: false, message: "Allowances couldn’t load. Close this panel and try again." })); else { reviewReturn.current = false; autoVerify.current = false; setAllowanceFocusId(null); setNewPinFocusId(null); setSavedPinInstruction(null); setPendingControl(null); setExpandedRequest(null); setSelectedProfileId(null); setEditor(null); setValue(""); setConfirmation(""); setCurrentPin(""); setFeedback(null); } }, [refreshAllowances, visible]);
  useEffect(() => {
    if (visible && !isOwnerAuthorized) { setCurrentPin(""); setConfirmation(""); if (editor?.kind === "pin" || editor?.kind === "removePin") setValue(""); }
  }, [editor?.kind, isOwnerAuthorized, visible]);
  useEffect(() => {
    if (!visible || !hasOwnerPin || !isOwnerAuthorized) return;
    const timer = setTimeout(() => { relockOwnerAccess(); }, OWNER_AUTHORIZATION_MS);
    return () => clearTimeout(timer);
  }, [hasOwnerPin, isOwnerAuthorized, relockOwnerAccess, visible]);

  const unlock = useCallback(async (instruction?: string) => {
    setUnlockingReview(true);
    try {
      if (await requestOwnerAuthorization(Boolean(instruction), instruction)) setSavedPinInstruction(null);
    } finally {
      setUnlockingReview(false);
    }
  }, [requestOwnerAuthorization]);

  // Wait for the provider to publish its new verifier state before asking again.
  // Consume this once so cancelling verification never opens a second prompt.
  useEffect(() => {
    if (!autoVerify.current || !visible || !savedPinInstruction || !hasOwnerPin || isOwnerAuthorized || profileSwitching || pinUnavailable) return;
    autoVerify.current = false;
    void unlock(savedPinInstruction).catch(() => {});
  }, [visible, savedPinInstruction, hasOwnerPin, isOwnerAuthorized, profileSwitching, pinUnavailable, unlock]);

  const close = (): void => {
    if (busy || profileSwitching) return;
    if (!isOwnerAuthorized) {
      if (dirty) confirmUser("Discard unfinished changes?", "Leave without saving your changes to this profile?", "Discard changes", (accepted) => { if (accepted) onClose(); }, true);
      else onClose();
      return;
    }
    confirmExit(() => {
      reviewReturn.current = false;
      setSelectedProfileId(null); setEditor(null); setValue(""); setConfirmation(""); setCurrentPin(""); setFeedback(null);
      relockOwnerAccess(); onClose();
    });
  };

  const begin = (next: Editor): void => {
    if ((next?.kind === "createManaged" || next?.kind === "allowance" || next?.kind === "pin" || next?.kind === "removePin") && pinUnavailable) {
      setFeedback({ ok: false, message: pinUnavailableMessage });
      return;
    }
    setExpandedRequest(null);
    setPlaybackTimesValid(true);
    setEditor(next);
    setConfirmationChecked(false);
    setValue(next?.kind === "rename" ? next.profile.name : "");
    setConfirmation(""); setCurrentPin(""); setFeedback(null);
    if (next?.kind === "createManaged") {
      initialAllowance.current = JSON.stringify({ mode: "dailyLimit", minutes: 30 });
      setAllowance({ mode: "dailyLimit", minutes: 30 });
    }
  };

  const openControl = (kind: ProtectedControl, profile: Profile): void => {
    if (busy || pinUnavailable || !isOwnerAuthorized || profileSwitching) return;
    const destination = { kind, profileId: profile.id, activeId: activeProfileId };
    if (!hasOwnerPin) begin({ kind: "pin", destination });
    else { setFeedback(null); setPendingControl(destination); }
  };

  // Saving a PIN relocks the household. Only load the destination once the
  // provider confirms Owner access again, using its normal protected readers.
  useEffect(() => {
    if (!pendingControl || !visible) return;
    if (pinUnavailable || pendingControl.profileId !== selectedProfileId || pendingControl.activeId !== activeProfileId || profileSwitching) {
      setPendingControl(null);
      return;
    }
    if (!isOwnerAuthorized || !hasOwnerPin) return;
    const profile = profiles.find((item) => item.id === pendingControl.profileId);
    if (!profile || (pendingControl.kind !== "allowance" && profile.role !== "managed")) {
      setPendingControl(null);
      return;
    }
    let current = true;
    const load = async () => {
      if (pendingControl.kind === "allowance") {
        const saved = await getProfileViewingAllowance(profile.id);
        if (!current) return;
        setOwnerCommitment(saved.mode === "dailyLimit" && saved.commitment !== false);
        initialAllowance.current = JSON.stringify(saved);
        setAllowance(saved);
        setEditor({ kind: "allowance", profile, saved });
      } else if (pendingControl.kind === "controls") {
        const controls = await getManagedPlaybackControls(profile.id);
        if (!current) return;
        initialControls.current = JSON.stringify(controls);
        setPlaybackControls(controls);
        setPlaybackTimesValid(true);
        setEditor({ kind: "controls", profile });
      } else {
        const overview = await getManagedContentOverview(profile.id);
        if (!current) return;
        setContentOverview(overview);
        setExpandedRequest(null);
        setEditor({ kind: "content", profile });
      }
      setFeedback(null);
    };
    void load().catch(() => {
      if (current) setFeedback({ ok: false, message: `Couldn’t load these settings. Open ${controlNames[pendingControl.kind]} to try again.` });
    }).finally(() => { if (current) setPendingControl(null); });
    return () => { current = false; };
  }, [pendingControl, visible, pinUnavailable, selectedProfileId, activeProfileId, profileSwitching, isOwnerAuthorized, hasOwnerPin, profiles, getProfileViewingAllowance, getManagedPlaybackControls, getManagedContentOverview]);

  const changeContentMode = async (profile: Profile, mode: ManagedContentMode): Promise<void> => {
    if (busy || contentOverview?.policy.mode === mode) return;
    const done = touch.capture();
    setWorking(true);
    try {
    const result = await setManagedContentMode(profile.id, mode);
    setFeedback(result);
    done("commit", result.ok);
    if (result.ok) setContentOverview(await getManagedContentOverview(profile.id));
    } catch { setFeedback({ ok: false, message: "That change couldn’t finish. Check the current settings before trying again." }); }
    finally { setWorking(false); }
  };

  const reviewRequest = async (profile: Profile, request: ManagedApprovalRequest, decision: "approve" | "deny", pointer: boolean): Promise<void> => {
    if (busy) return;
    const done = touch.capture();
    setWorking(true);
    try {
    const result = await reviewManagedApprovalRequest(profile.id, request, decision);
    setFeedback(result.ok && pointer ? { ...result, revealKey: `${request.kind}:${request.targetId}:${request.requestedAt}:${decision}` } : result);
    if (result.ok && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(result.message);
    done("commit", result.ok && decision === "approve");
    if (result.ok) setContentOverview(await getManagedContentOverview(profile.id));
    } catch { setFeedback({ ok: false, message: "That change couldn’t finish. Check the current settings before trying again." }); }
    finally { setWorking(false); }
  };

  const inspectRequest = async (profile: Profile, request: ManagedApprovalRequest, action: "preview" | "refresh"): Promise<void> => {
    if (busy) return;
    if (action === "preview") reviewReturn.current = true;
    setWorking(true);
    try {
      const result = await inspectManagedApprovalRequest(profile.id, request, action);
      setFeedback(result);
      if (result.ok && action === "refresh") setContentOverview(await getManagedContentOverview(profile.id));
    } catch { setFeedback({ ok: false, message: "Review could not finish. This request remains available here." }); }
    finally { setWorking(false); }
  };

  const revokeContent = async (profile: Profile, kind: "video" | "source", targetId: string): Promise<void> => {
    if (busy) return;
    setWorking(true);
    try {
    const result = await revokeManagedContent(profile.id, kind, targetId);
    setFeedback(result);
    if (result.ok) setContentOverview(await getManagedContentOverview(profile.id));
    } catch { setFeedback({ ok: false, message: "That change couldn’t finish. Check the current settings before trying again." }); }
    finally { setWorking(false); }
  };

  const submitEditor = async (): Promise<void> => {
    if (!editor || busy) return;
    if (editor.kind === "content" || editor.kind === "chooseRole") return;
    if (editor.kind === "controls" && (!playbackTimesValid || validateManagedPlaybackControls(playbackControls))) return;
    if (editor.kind === "pin" && value !== confirmation) return setConfirmationChecked(true);
    const done = touch.capture();
    setWorking(true);
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
      if ("profileId" in result && typeof result.profileId === "string") {
        setSelectedProfileId(result.profileId);
        if (Platform.isTV && !hasOwnerPin) setNewPinFocusId(result.profileId);
      }
      if (editor.kind === "pin") {
        const destination = editor.destination ? controlNames[editor.destination.kind].toLowerCase() : "settings";
        const next = selectedProfile ? `${selectedProfile.name}’s ${destination}` : "profile settings";
        autoVerify.current = true;
        if (Platform.isTV && selectedProfile && !editor.destination) setAllowanceFocusId(selectedProfile.id);
        setSavedPinInstruction(`Your PIN is saved. Enter it to return to ${next}.`);
      }
      setEditor(null); setValue(""); setConfirmation(""); setCurrentPin("");
      if (editor.kind === "pin" && editor.destination) setPendingControl(editor.destination);
      if (editor.kind !== "pin" && editor.kind !== "createManaged" && editor.kind !== "createStandard") await refreshAllowances();
    }
    } catch { setFeedback({ ok: false, message: "That change couldn’t finish. Check the current settings before trying again." }); }
    finally { setWorking(false); }
  };

  const confirmDelete = (profile: Profile): void => {
    confirmUser(`Delete ${profile.name}?`, "This permanently removes this profile’s library, progress, preferences, viewing limits and approvals from this device.", "Delete profile", async (accepted) => {
      if (!accepted) return;
      setWorking(true);
      try {
        const result = await deleteLocalProfile(profile.id);
        setFeedback(result);
        if (result.ok) setSelectedProfileId(null);
      } catch { setFeedback({ ok: false, message: "The profile couldn’t be deleted. Check the list and try again." }); }
      finally { setWorking(false); }
    }, true);
  };

  const cancelPending = async (): Promise<void> => {
    if (busy) return;
    const done = touch.capture();
    setWorking(true);
    try {
      const result = await cancelPendingOwnerAllowance();
      setFeedback(result);
      done("commit", result.ok);
      if (result.ok) await refreshAllowances();
    } catch { setFeedback({ ok: false, message: "The pending change couldn’t be updated. Try again." }); }
    finally { setWorking(false); }
  };

  const confirmRemovePin = (): void => begin({ kind: "removePin" });

  const chooseProfile = async (profileId: string): Promise<void> => {
    if (busy) return;
    setWorking(true);
    try {
      const result = await switchProfile(profileId);
      setFeedback(result);
      if (result.ok) { relockOwnerAccess(); onClose(); }
    } catch { setFeedback({ ok: false, message: "The profile couldn’t switch. Try again." }); }
    finally { setWorking(false); }
  };

  const reorder = async (profileId: string, direction: "up" | "down"): Promise<void> => {
    if (busy) return;
    const done = touch.capture();
    setWorking(true);
    try { const result = await reorderLocalProfile(profileId, direction); setFeedback(result); done("selection", result.ok); }
    catch { setFeedback({ ok: false, message: "The order couldn’t be saved. Try again." }); }
    finally { setWorking(false); }
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

  const selectedStatus = selectedProfileId ? allowanceStatus[selectedProfileId] : undefined;
  const [restrictedLimit, setRestrictedLimit] = useState<{ id: string; limit: ViewingAllowance } | null>(null);
  useEffect(() => {
    setRestrictedLimit(null);
    if (!visible || !isOwnerAuthorized || !selectedProfileId || selectedStatus?.kind !== "restricted" || editor || pendingControl) return;
    let current = true;
    void getProfileViewingAllowance(selectedProfileId).then(limit => {
      if (current) setRestrictedLimit({ id: selectedProfileId, limit });
    }).catch(() => { /* Opening the row retries the saved limit. */ });
    return () => { current = false; };
  }, [visible, isOwnerAuthorized, selectedProfileId, selectedStatus, editor, pendingControl, getProfileViewingAllowance]);
  const savedLimit = restrictedLimit?.id === selectedProfileId ? restrictedLimit?.limit : undefined;
  const limitValue = selectedStatus?.kind === "limited" || selectedStatus?.kind === "complete" ? `${selectedStatus.allowanceMinutes} min`
    : selectedStatus?.kind === "unlimited" || savedLimit?.mode === "unlimited" ? "Unlimited"
    : savedLimit?.mode === "dailyLimit" ? `${savedLimit.minutes} min` : undefined;

  const pinMismatch = editor?.kind === "pin" && value !== confirmation && confirmation.length > 0 && (confirmationChecked || confirmation.length === 6);
  const mismatchMessage = "PINs don’t match. Re-enter the new PIN here.";
  const canCreate = profiles.length < PRODUCT_LIMITS.futureProfilesPerHousehold;
  const localProfiles = profiles.filter((profile) => profile.role !== "owner");
  const editorNeedsName = editor?.kind === "createStandard" || editor?.kind === "createManaged" || editor?.kind === "rename";
  const allowanceInvalid = (editor?.kind === "createManaged" || editor?.kind === "allowance")
    && allowance.mode === "dailyLimit" && (!Number.isInteger(allowance.minutes) || allowance.minutes < 1 || allowance.minutes > 1_440);
  const controlsInvalid = editor?.kind === "controls" && (!playbackTimesValid || Boolean(validateManagedPlaybackControls(playbackControls)));
  const editorInvalid = busy || pinMismatch || (editor?.kind === "allowance" && !dirty) || allowanceInvalid || controlsInvalid || (editorNeedsName && !value.trim()) || (editor?.kind === "pin" && (value.length < 4 || confirmation.length < 4)) || ((editor?.kind === "pin" && hasOwnerPin || editor?.kind === "removePin") && currentPin.length < 4);

  const back = (): void => {
    if (busy || profileSwitching) return;
    if (editor) confirmExit(() => begin(editor.kind === "createStandard" || editor.kind === "createManaged" ? { kind: "chooseRole" } : null));
    else if (selectedProfileId) { setSelectedProfileId(null); setFeedback(null); }
    else close();
  };
  const selectedIndex = localProfiles.findIndex((profile) => profile.id === selectedProfileId);
  const detailAction = (label: string, onPress: () => void, disabled = false, destructive = false, navigation = true) => (
    <SettingsRow title={label} onPress={onPress} disabled={busy || disabled} destructive={destructive} navigation={navigation && !destructive} />
  );
  const creatingProfile = editor?.kind === "createStandard" || editor?.kind === "createManaged";
  const backLabel = creatingProfile ? "Profile types" : selectedProfile && editor ? selectedProfile.name : "Profiles";
  const editorHeading = !editor ? null : editor.kind === "chooseRole" ? "Add profile" : editor.kind === "createStandard" ? "New standard profile" : editor.kind === "createManaged" ? "New managed profile" : editor.kind === "rename" ? "Rename profile" : editor.kind === "allowance" ? "Daily viewing limit" : editor.kind === "controls" ? "Playback schedule" : editor.kind === "content" ? "Content access" : editor.kind === "removePin" ? "Remove Owner PIN" : hasOwnerPin ? "Change Owner PIN" : "Add Owner PIN";


  const feedbackMessage = feedback && (
    <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text>
  );

  if (visible && !isOwnerAuthorized) return <Sheet returnFocusTarget={returnFocusTarget} label="Unlock Owner access" visible={!unlockingReview} onClose={close}>
    <Text style={type.heading} accessibilityRole="header">Unlock to continue</Text>
    <Text style={[type.bodySoft, { marginTop: spacing.sm }]}>{savedPinInstruction ?? "Unlock to return to your profile settings. Your changes are kept. For security, enter any PIN fields again."}</Text>
    <PrimaryAction depth={palette.primaryButtonDepth} accessibilityRole="button" disabled={unlockingReview || busy} style={styles.primaryButton} onPress={() => {
      void unlock(savedPinInstruction ?? undefined).catch(() => {});
    }}><Text style={styles.primaryButtonText}>{savedPinInstruction ? "Verify PIN" : "Unlock Owner access"}</Text></PrimaryAction>
    <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={close}><Text style={styles.secondaryButtonText}>Close controls</Text></Pressable>
  </Sheet>;

  return (
    <Sheet tvForm={Boolean(editorNeedsName || editor?.kind === "pin" || editor?.kind === "removePin")} returnFocusTarget={returnFocusTarget} label={editorHeading ?? selectedProfile?.name ?? "Profiles & viewing limits"} visible={visible} onClose={close} onBack={back} contentKey={`${selectedProfileId ?? "profiles"}:${editor?.kind ?? "overview"}`}>
      <View style={styles.detailHeader}>
        {editor || selectedProfile ? <Pressable onPress={back} disabled={busy} style={styles.backButton} accessibilityRole="button" accessibilityLabel={`Back to ${backLabel}`}><ArrowLeft size={20} color={palette.ink} /><Text style={[type.label, { flexShrink: 1 }]}>{backLabel}</Text></Pressable> : <Text style={[styles.heading, { flex: 1, marginTop: 0 }]} accessibilityRole="header">Profiles</Text>}
        <Pressable onPress={close} disabled={busy || profileSwitching} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close profile settings"><X size={20} color={palette.ink} /></Pressable>
      </View>
      {(editor || selectedProfile) && <Text style={styles.heading} accessibilityRole="header">{editorHeading ?? selectedProfile?.name}</Text>}
      {!editor && !selectedProfile ? <>
        <Text style={styles.boundaryText}>Each person has their own library and viewing settings on this device.</Text>
        <View style={styles.sectionHeader}><Text style={styles.sectionLabel}>Profiles · {profiles.length} of {PRODUCT_LIMITS.futureProfilesPerHousehold}</Text></View>
        <View style={styles.profileList}>{profiles.map((profile) => (
          <Pressable key={profile.id} onPress={() => { setSelectedProfileId(profile.id); setFeedback(null); }} style={styles.profileRow} accessibilityRole="button" accessibilityLabel={`Manage ${profile.name}. ${statusLabel(profile)}${(requestCounts.data?.[profile.id] ?? 0) > 0 ? `. ${requestCounts.data?.[profile.id]} ${requestCounts.data?.[profile.id] === 1 ? "request" : "requests"} to review` : ""}${profile.id === activeProfileId ? ". Current profile" : ""}`}>
            <View style={styles.avatar}><UserRound size={20} color={palette.active} /></View>
            <View style={styles.flex}><Text style={styles.profileName}>{profile.name}</Text><Text style={styles.profileRole}>{statusLabel(profile)}</Text>{(requestCounts.data?.[profile.id] ?? 0) > 0 ? <Text style={styles.profileRole}>{requestCounts.data![profile.id]} {requestCounts.data![profile.id] === 1 ? "request" : "requests"} to review</Text> : null}{profile.id === activeProfileId ? <Text style={styles.profileRole}>Watching now</Text> : null}</View>
            <ChevronRight size={20} color={palette.inkMuted} />
          </Pressable>
        ))}</View>
        {canCreate && <SettingsRow title="Add profile" leading={<Plus size={18} color={palette.active} />} onPress={() => begin({ kind: "chooseRole" })} />}
          {profiles.map((profile) => {
            const status = allowanceStatus[profile.id];
            const pending = status && "pendingChange" in status ? status.pendingChange : undefined;
            if (!pending) return null;
            const label = pending.allowance.mode === "unlimited" ? "Unlimited" : `${pending.allowance.minutes} minutes`;
            return <View key={`pending-${profile.id}`} style={styles.pendingCard}><Clock3 size={18} color={palette.active} /><View style={styles.flex}><Text style={styles.profileName}>Pending Owner change</Text><Text style={styles.profileRole}>{label} activates {new Date(pending.activatesAt).toLocaleString()}.</Text></View><Pressable onPress={() => { void cancelPending(); }} disabled={busy} style={styles.cancelPending} accessibilityRole="button" accessibilityLabel="Cancel pending limit change"><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable></View>;
          })}

          <Text style={[styles.sectionLabel, styles.pinLabel]}>Owner PIN</Text>
          <View style={styles.pinCard}><View style={styles.pinIcon}><LockKeyhole size={19} color={palette.active} /></View><View style={styles.flex}><Text style={styles.profileName}>{pinUnavailable ? (ownerPinAvailability === "web" ? "Available in the mobile app" : "PIN storage unavailable") : hasOwnerPin ? "PIN is on" : "PIN is off"}</Text><Text style={styles.profileRole}>{pinUnavailable ? pinUnavailableMessage : hasOwnerPin ? "Protects Managed profile settings and access to the Owner profile." : "Add a PIN to protect viewing allowances and Managed profile settings."}</Text></View></View>
          {!pinUnavailable ? <View style={styles.actionRow}><Pressable accessibilityRole="button" onPress={() => begin({ kind: "pin" })} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{hasOwnerPin ? "Change PIN" : "Add PIN"}</Text></Pressable>{hasOwnerPin ? <Pressable accessibilityRole="button" onPress={confirmRemovePin} style={styles.secondaryButton}><Text style={[styles.secondaryButtonText, { color: palette.danger }]}>Remove PIN</Text></Pressable> : null}</View> : null}


      </> : null}
      {!editor && selectedProfile ? <>
        <Text style={styles.boundaryText}>{selectedStatus?.kind === "restricted" || selectedStatus?.kind === "ownerReview"
          ? statusLabel(selectedProfile) : selectedProfile.role === "managed" ? "Managed profile" : selectedProfile.role === "owner" ? "Owner profile" : "Standard profile"}</Text>
        {selectedProfile.role === "managed" && !hasOwnerPin && !pinUnavailable &&
          <SettingsRow title="Add Owner PIN" summary="One PIN protects Owner access and viewing settings on this device." preferTVFocus={newPinFocusId === selectedProfile.id} onTVFocus={() => setNewPinFocusId(null)} leading={<LockKeyhole size={18} color={palette.active} />} onPress={() => begin({ kind: "pin" })} />}
        {selectedProfile.id === activeProfileId ? <View style={styles.currentProfile}><Check size={18} color={palette.active} /><Text style={type.label}>Watching now</Text></View> : detailAction(`Watch as ${selectedProfile.name}`, () => { void chooseProfile(selectedProfile.id); })}
        <Text style={styles.detailSection} accessibilityRole="header">Playback</Text>
        {(pinUnavailable || (!hasOwnerPin && selectedProfile.role !== "managed")) && <Text style={styles.boundaryText}>{pinUnavailable ? pinUnavailableMessage : "An Owner PIN protects changes to viewing settings."}</Text>}
        <SettingsRow title={controlNames.allowance} busy={pendingControl?.kind === "allowance"} value={limitValue} preferTVFocus={allowanceFocusId === selectedProfile.id && !savedPinInstruction && !unlockingReview} onTVFocus={() => setAllowanceFocusId(null)} onPress={() => openControl("allowance", selectedProfile)} disabled={busy || pinUnavailable} navigation={!pinUnavailable} />
        {selectedProfile.role === "managed" ? <>
          <SettingsRow title={controlNames.controls} busy={pendingControl?.kind === "controls"} summary="Set viewing hours, breaks, or a temporary pause." onPress={() => openControl("controls", selectedProfile)} disabled={busy || pinUnavailable} navigation={!pinUnavailable} />
          <Text style={styles.detailSection} accessibilityRole="header">Content approvals</Text>
          <SettingsRow title={controlNames.content} busy={pendingControl?.kind === "content"} summary={requestCounts.data?.[selectedProfile.id] ? `${requestCounts.data[selectedProfile.id]} pending ${requestCounts.data[selectedProfile.id] === 1 ? "request" : "requests"}` : "Choose approved videos or sources and review requests."} onPress={() => openControl("content", selectedProfile)} disabled={busy || pinUnavailable} navigation={!pinUnavailable} />
        </> : null}
        {selectedProfile.role !== "owner" ? <>
          <Text style={styles.detailSection} accessibilityRole="header">Profile</Text>
          {detailAction("Rename profile", () => begin({ kind: "rename", profile: selectedProfile }))}
          {selectedIndex > 0 && detailAction("Move earlier in the list", () => { void reorder(selectedProfile.id, "up"); }, selectedIndex <= 0, false, false)}
          {selectedIndex < localProfiles.length - 1 && detailAction("Move later in the list", () => { void reorder(selectedProfile.id, "down"); }, selectedIndex >= localProfiles.length - 1, false, false)}
          {detailAction("Delete profile", () => confirmDelete(selectedProfile), false, true)}
        </> : null}
      </> : null}
      {editor?.kind === "chooseRole" && <>
        <SettingsRow title="Standard profile" summary="Choose your own sources and videos." onPress={() => begin({ kind: "createStandard" })} />
        <SettingsRow title="Managed profile" summary={`The Owner approves videos or sources and sets viewing limits.${pinUnavailable ? (ownerPinAvailability === "web" ? " Create this profile in the iPhone or Android app." : " " + pinUnavailableMessage) : ""}`} disabled={pinUnavailable} navigation={!pinUnavailable} onPress={() => begin({ kind: "createManaged" })} />
      </>}
          {editor && editor.kind !== "chooseRole" ? <View style={styles.editor}>

            {editor.kind === "pin" && editor.destination && selectedProfile ? <Text style={styles.boundaryText}>{`Create a PIN, then unlock to open ${controlNames[editor.destination.kind]} for ${selectedProfile.name}.`}</Text> : null}
            {(editor.kind === "pin" && hasOwnerPin || editor.kind === "removePin") ? <><Text style={[type.label, { marginTop: spacing.md }]}>Current Owner PIN</Text><TextField editable={!busy} value={currentPin} onChangeText={(text) => setCurrentPin(text.replace(/\D/g, "").slice(0, 6))} placeholder="Current Owner PIN" placeholderTextColor={palette.inkMuted} containerStyle={styles.input} style={styles.pinInput} keyboardType="number-pad" secureTextEntry maxLength={6} autoFocus accessibilityLabel="Current Owner PIN" /></> : null}
            {editorNeedsName || editor.kind === "pin" ? <><Text style={[type.label, { marginTop: spacing.md }]}>{editor.kind === "pin" ? "New Owner PIN" : "Profile name"}</Text><TextField editable={!busy} value={value} onChangeText={(text) => { setValue(editor.kind === "pin" ? text.replace(/\D/g, "").slice(0, 6) : text); setFeedback(null); }} placeholder={editor.kind === "pin" ? "4–6 digit PIN" : "Profile name"} placeholderTextColor={palette.inkMuted} containerStyle={styles.input} style={editor.kind === "pin" && styles.pinInput} keyboardType={editor.kind === "pin" ? "number-pad" : "default"} secureTextEntry={editor.kind === "pin"} maxLength={editor.kind === "pin" ? 6 : 32} autoFocus={!hasOwnerPin || editor.kind !== "pin"} accessibilityLabel={editor.kind === "pin" ? "New Owner PIN" : "Profile name"} /></> : null}
            {editor.kind === "pin" ? <><Text style={[type.label, { marginTop: spacing.md }]}>Confirm PIN</Text><TextField editable={!busy} value={confirmation} onChangeText={(text) => { setConfirmation(text.replace(/\D/g, "").slice(0, 6)); setFeedback(null); }} placeholder="Enter PIN again" placeholderTextColor={palette.inkMuted} containerStyle={styles.input} style={styles.pinInput} keyboardType="number-pad" secureTextEntry maxLength={6} onBlur={() => { if (confirmation.length >= 4) setConfirmationChecked(true); }} accessibilityHint={pinMismatch ? mismatchMessage : undefined} accessibilityLabel="Confirm PIN" />{pinMismatch && <Text role="alert" accessibilityLiveRegion="polite" style={[type.bodySoft, { color: palette.danger, marginTop: spacing.xs }]}>{mismatchMessage}</Text>}<Text style={[type.bodySoft, { marginTop: spacing.md }]}>Keep this PIN somewhere safe. If you forget it, recovery requires erasing all Frame data on this device.</Text></> : null}
            {editor.kind === "createManaged" || editor.kind === "allowance" ? <AllowancePicker showLabel={editor.kind !== "allowance"} value={allowance} onChange={(next) => setAllowance(next.mode === "dailyLimit" && editor.kind === "allowance" && editor.profile.role === "owner" ? { ...next, commitment: ownerCommitment } : next)} /> : null}
            {editor.kind === "controls" ? <ManagedPlaybackControlsEditor value={playbackControls} onChange={(next) => { setPlaybackControls(next); setFeedback(null); }} onValidityChange={setPlaybackTimesValid} /> : null}
            {editor.kind === "content" && feedback ? <ActionReveal key={feedback.revealKey ?? "static"} open instant={!feedback.revealKey}>
              <Text accessibilityLiveRegion="polite" role="status" style={[styles.feedback, { color: feedback.ok ? palette.success : palette.danger }]}>{feedback.message}</Text>
            </ActionReveal> : null}
            {editor.kind === "content" && contentOverview ? <ManagedContentAccessEditor key={`${editor.profile.id}:${contentOverview.policy.mode}`} expanded={expandedRequest} onExpand={setExpandedRequest} value={contentOverview} busy={busy} onModeChange={(mode) => { void changeContentMode(editor.profile, mode); }} onInspect={(request, action) => { void inspectRequest(editor.profile, request, action); }} onReview={(request, decision, pointer) => { void reviewRequest(editor.profile, request, decision, pointer); }} onRevoke={(kind, targetId) => { void revokeContent(editor.profile, kind, targetId); }} /> : null}
            {controlsInvalid ? <Text style={[styles.feedback, { color: palette.danger }]}>{!playbackTimesValid ? "Enter valid times before saving." : validateManagedPlaybackControls(playbackControls)}</Text> : null}
            {editor.kind === "allowance" && editor.profile.role === "owner" ? <>
              {editor.saved.mode === "unlimited" && allowance.mode === "dailyLimit" ? <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <Text style={type.label}>How firmly should this limit hold?</Text>
                <ChoiceOption label="Flexible · changes take effect immediately" selected={!ownerCommitment} onPress={() => { setOwnerCommitment(false); setAllowance({ ...allowance, commitment: false }); }} />
                <ChoiceOption label="Commitment · wait 24 hours to increase or remove" selected={ownerCommitment} onPress={() => { setOwnerCommitment(true); setAllowance({ ...allowance, commitment: true }); }} />
              </View> : null}
              <Text style={styles.ownerDelayNote}>{ownerCommitment ? "Reducing your limit takes effect when you save. Increasing it or choosing Unlimited takes 24 hours, even with the Owner PIN. This commitment stays in place until the limit is removed." : "Your changes take effect when you save. Managed profile protections are separate."}</Text>
            </> : null}
            {editor.kind !== "content" && feedbackMessage}
            {editor.kind === "content" ? <PrimaryAction depth={palette.primaryButtonDepth} disabled={busy} accessibilityRole="button" onPress={() => begin(null)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Done</Text></PrimaryAction> : <View style={styles.actionRow}><Pressable disabled={busy} accessibilityRole="button" onPress={back} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><PrimaryAction depth={palette.primaryButtonDepth} accessibilityRole="button" onPress={() => { void submitEditor(); }} disabled={editorInvalid} style={[styles.primaryButton, editorInvalid && styles.disabled]}>{busy ? <ActivityIndicator color={palette.onDark} /> : <Text style={styles.primaryButtonText}>{editor.kind === "allowance" ? "Save daily limit" : editor.kind === "controls" ? "Save playback settings" : editor.kind === "removePin" ? "Remove PIN" : editor.kind === "createStandard" || editor.kind === "createManaged" ? "Create profile" : editor.kind === "pin" ? "Save PIN" : "Save"}</Text>}</PrimaryAction></View>}
          </View> : null}

      {!editor && feedbackMessage}
      {!editor && !selectedProfile && hasOwnerPin ? <Text style={styles.recovery}>A forgotten Owner PIN requires erasing all Frame data on this device.</Text> : null}
    </Sheet>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    detailSection: { ...type.label, marginTop: spacing.lg, marginBottom: spacing.xs },
    detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    backButton: { flexShrink: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    currentProfile: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: palette.overlay },
    card: { ...softShadow, maxHeight: "94%", paddingTop: spacing.md, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    handle: { width: 36, height: 4, alignSelf: "center", marginBottom: spacing.md, borderRadius: 2, backgroundColor: palette.surfaceDeep },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
    eyebrow: { ...type.caption, color: palette.accent }, heading: { ...type.heading, fontSize: 24, marginTop: spacing.xs }, closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    scroll: { marginTop: spacing.sm }, scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 44 },
    boundaryCard: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.activeSoft }, boundaryText: { ...type.bodySoft, color: palette.inkMuted },
    sectionHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg }, sectionLabel: { ...type.caption, color: palette.inkMuted },
    profileList: { marginTop: spacing.sm }, profileRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft }, profileRowActive: { borderColor: palette.active, backgroundColor: palette.activeSoft },
    avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: palette.surfaceHigh }, profileMain: { flex: 1, minHeight: 60, justifyContent: "center" }, profileName: { ...type.label, fontSize: 14 }, profileRole: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted, fontSize: 13 },
    rowActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 92 }, iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, smallIcon: { width: 28, height: 32, alignItems: "center", justifyContent: "center" },
    pendingCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.activeSoft, borderWidth: 1, borderColor: palette.active }, cancelPending: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm },
    pinLabel: { marginTop: spacing.xl, marginBottom: spacing.sm }, pinCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.card, backgroundColor: palette.surface }, pinIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: palette.activeSoft }, flex: { flex: 1, minWidth: 0 },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }, secondaryButton: { minHeight: 48, minWidth: 110, flex: 1, flexDirection: "row", gap: spacing.xs, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border }, secondaryButtonText: { ...type.label, flexShrink: 1, textAlign: "center", color: palette.accent, fontSize: 12 },
    primaryButton: { minHeight: 48, minWidth: 110, flexGrow: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep }, primaryButtonText: { textAlign: "center", color: palette.onDark, fontFamily: fonts.sansSemibold, fontSize: 14 },
    editor: { marginTop: spacing.md }, input: { marginTop: spacing.sm }, pinInput: { textAlign: "center" },
    ownerDelayNote: { ...type.bodySoft, marginTop: spacing.md, color: palette.inkMuted },
    feedback: { ...type.label, marginTop: spacing.md }, recovery: { ...type.bodySoft, marginTop: spacing.xl, color: palette.inkMuted, textAlign: "center", fontSize: 13 }, disabled: { opacity: 0.45 },
  });
}

