import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import { defaultSessionName } from "@/domain/sessionFlow";
import TextField from "@/components/TextField";
import { ArrowRight, Check, Plus, Rows3, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Platform, Pressable, StyleSheet, View } from "react-native";
import { controlTransition, useControlFeedback } from "@/hooks/useControlFeedback";
import Sheet from "@/components/Sheet";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { VideoQueue } from "@/types";

type AddedSession = { id: string; name: string; count: number };
type AddResult = Promise<AddedSession | null>;
type Props = { title: string; videoId: string; busy: boolean; nestedRoute?: boolean; sessions: readonly VideoQueue[]; onClose(): void; onOpen(id: string, addedVideoId?: string): void; onPick(sessionId: string): AddResult; onCreate(name: string): AddResult };

export default function TodaySessionModal({ title, videoId, busy, sessions, onClose, onOpen, onPick, onCreate, nestedRoute = false }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<{ sessionId: string | null } | null>(null);
  const [added, setAdded] = useState<AddedSession | null>(null);
  const locked = useRef(false);
  const openButton = useRef<View>(null);
  useEffect(() => {
    if (!added) return;
    const frame = requestAnimationFrame(() => {
      if (Platform.OS === "web") openButton.current?.focus();
      else {
        const target = findNodeHandle(openButton.current);
        if (target) AccessibilityInfo.setAccessibilityFocus(target);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [added]);
  const [creatingNew, setCreatingNew] = useState(false);
  const defaultName = defaultSessionName(sessions);
  const submit = async (sessionId: string | null) => {
    if (locked.current || busy) return;
    locked.current = true;
    setPending({ sessionId });
    let result: AddedSession | null = null;
    try {
      result = sessionId === null ? await onCreate(name.trim() || defaultName) : await onPick(sessionId);
      setAdded(result);
    } finally {
      locked.current = Boolean(result);
      setPending(null);
    }
  };
  const working = Boolean(pending || busy);
  const unavailable = working || Boolean(added);
  const creating = pending?.sessionId === null;
  return (
    <Sheet label="Add to session" nestedRoute={nestedRoute} visible onClose={() => { if (!working) onClose(); }} contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.flex}><Text style={type.heading} accessibilityRole="header" accessibilityLiveRegion="polite">{added ? `Added to ${added.name}` : "Add to session"}</Text><Text style={styles.meta}>{title}</Text></View>
        <Pressable disabled={working} onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close session picker" accessibilityState={{ disabled: working }}><X size={20} color={palette.ink} /></Pressable>
      </View>
      {added ? <View style={styles.receipt}>
        <View style={styles.count}><Check size={18} color={palette.success} /><Text style={type.label}>{added.count} {added.count === 1 ? "video" : "videos"} in session</Text></View>
        <Pressable ref={openButton} accessibilityRole="button" accessibilityLabel={`Open session: ${added.name}`}
          accessibilityHint={`Video added. ${added.count} ${added.count === 1 ? "video" : "videos"} in session.`}
          onPress={() => onOpen(added.id, videoId)} style={({ pressed }) => [styles.create, pressed ? styles.press : palette.primaryButtonDepth]}>
          <Text style={styles.createText}>Open session</Text><ArrowRight size={17} color={palette.onDark} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.quiet}><Text style={type.label}>Done</Text></Pressable>
      </View> : <>
      <View>{sessions.map((session) => (
        <DestinationRow key={session.id} session={session} videoId={videoId} unavailable={unavailable}
          pending={pending?.sessionId === session.id}
          onPress={() => { if (session.orderedVideoIds.includes(videoId)) onOpen(session.id); else void submit(session.id); }} styles={styles} />
      ))}</View>
      {sessions.length > 0 && !creatingNew ? <Pressable accessibilityRole="button" onPress={() => setCreatingNew(true)} disabled={working} style={styles.quiet}><Plus size={17} color={palette.active} /><Text style={[type.label, { color: palette.active }]}>Create a new session</Text></Pressable> : <>
      <Text style={styles.label}>New session name · optional</Text>
      <TextField value={name} onChangeText={setName} editable={!unavailable} placeholder={defaultName} placeholderTextColor={palette.inkMuted} maxLength={64} returnKeyType="done" accessibilityLabel="New session name" />
      <PrimaryAction depth={palette.primaryButtonDepth} disabled={unavailable} onPress={() => { void submit(null); }} style={[styles.create, unavailable && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: unavailable, busy: creating }}>
        {creating ? <ActivityIndicator color={palette.onDark} /> : <Plus size={18} color={palette.onDark} />}<Text style={styles.createText}>{creating ? "Creating…" : "Create and add video"}</Text>
      </PrimaryAction>
      </>}
      </>}
    </Sheet>
  );
}

function DestinationRow({ session, videoId, unavailable, pending, onPress, styles }: {
  session: VideoQueue; videoId: string; unavailable: boolean; pending: boolean;
  onPress(): void; styles: ReturnType<typeof createStyles>;
}) {
  const { palette, type } = useFrameTheme();
  const feedback = useControlFeedback(palette.active);
  const included = session.orderedVideoIds.includes(videoId);
  const full = session.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems;
  const disabled = unavailable || (full && !included);
  const hot = (pressed: boolean) => pending || (!disabled && (pressed || feedback.highlighted));
  const count = session.orderedVideoIds.length;
  const quantity = `${count} ${count === 1 ? "video" : "videos"}`;
  const meta = pending ? "Adding…" : included ? "Already added · Open session" : full ? "Full · choose another session" : `${session.targetMinutes ? `Pause after ${session.targetMinutes} min` : "Choose duration"} · ${quantity}`;
  return <Pressable {...feedback.events} onPress={onPress} disabled={disabled} accessibilityRole="button"
    accessibilityLabel={`${session.name}. ${meta}`} accessibilityState={{ disabled, busy: pending }}
    style={({ pressed }) => [styles.row, !feedback.reduced && controlTransition,
      hot(pressed) && { backgroundColor: palette.activeSoft }, disabled && !pending && styles.disabled, feedback.ring]}>
    {({ pressed }) => <>
      <Rows3 size={18} color={palette.accent} />
      <View style={styles.flex}><Text style={type.body}>{session.name}</Text><Text style={styles.meta} accessibilityLiveRegion="polite">{meta}</Text></View>
      <View style={[!feedback.reduced && controlTransition, !feedback.reduced && !disabled && { transform: [{ translateX: hot(pressed) ? 2 : 0 }] }]}>
        {pending ? <ActivityIndicator size="small" color={palette.active} /> : included ? <Check size={18} color={palette.success} /> : !full ? <Plus size={17} color={palette.active} /> : null}
      </View>
    </>}
  </Pressable>;
}
function createStyles(palette: FramePalette, type: FrameType) { return StyleSheet.create({ press: { opacity: 0.88 }, receipt: { gap: spacing.sm }, count: { flexDirection: "row", gap: spacing.sm, alignItems: "center" }, quiet: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, content: { gap: spacing.sm }, header: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }, flex: { flex: 1 }, close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft, borderRadius: radii.small }, meta: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.xs }, disabled: { opacity: 0.5 }, label: { ...type.label, marginTop: spacing.md }, create: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.control, backgroundColor: palette.accentDeep }, createText: { ...type.label, color: palette.onDark, flexShrink: 1 } }); }
