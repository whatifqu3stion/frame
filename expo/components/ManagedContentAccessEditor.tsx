import { Check, ShieldCheck, Trash2, X } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { ManagedApprovalRequest, ManagedContentMode, ManagedContentOverview } from "@/models/managedContentAccess";

type Props = {
  value: ManagedContentOverview;
  busy: boolean;
  onModeChange(mode: ManagedContentMode): void;
  onReview(request: ManagedApprovalRequest, decision: "approve" | "deny"): void;
  onRevoke(kind: "video" | "source", targetId: string): void;
};

export default function ManagedContentAccessEditor({ value, busy, onModeChange, onReview, onRevoke }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={styles.root}>
      <Text style={styles.intro}>These choices limit what can play inside Frame. They do not rate content or block other apps.</Text>
      <View style={styles.modeRow} accessibilityRole="radiogroup">
        <ModeButton label="Selected Videos" selected={value.policy.mode === "selectedVideos"} disabled={busy} onPress={() => onModeChange("selectedVideos")} styles={styles} />
        <ModeButton label="Approved Sources" selected={value.policy.mode === "approvedSources"} disabled={busy} onPress={() => onModeChange("approvedSources")} styles={styles} />
      </View>
      <Text style={styles.explanation}>{value.policy.mode === "selectedVideos" ? "Only individual videos approved by the Owner can play." : "Videos can play only when their source is approved by the Owner."}</Text>

      <Text style={styles.sectionLabel}>Requests · {value.requests.length}</Text>
      {value.requests.length === 0 ? <Text style={styles.empty}>No requests are waiting on this device.</Text> : value.requests.map((request) => (
        <View key={`${request.kind}:${request.targetId}`} style={styles.row}>
          <View style={styles.flex}><Text style={styles.title} numberOfLines={2}>{request.title}</Text><Text style={styles.meta}>{request.kind === "video" ? `Video · ${request.sourceTitle || "Unknown source"}` : "Source"}</Text></View>
          <Pressable onPress={() => onReview(request, "approve")} disabled={busy} style={styles.iconButton} accessibilityLabel={`Approve ${request.title}`}><Check size={16} color={palette.success} /></Pressable>
          <Pressable onPress={() => onReview(request, "deny")} disabled={busy} style={styles.iconButton} accessibilityLabel={`Deny ${request.title}`}><X size={16} color={palette.danger} /></Pressable>
        </View>
      ))}

      <Text style={styles.sectionLabel}>{value.policy.mode === "selectedVideos" ? `Selected videos · ${value.approvedVideos.length}` : `Approved sources · ${value.approvedSources.length}`}</Text>
      {value.policy.mode === "selectedVideos" ? (
        value.approvedVideos.length === 0 ? <Text style={styles.empty}>No videos selected yet. A Managed profile can request one from a blocked player.</Text> : value.approvedVideos.map((video) => (
          <ApprovalRow key={video.id} title={video.title} meta={video.channelTitle} busy={busy} onRemove={() => onRevoke("video", video.id)} styles={styles} danger={palette.danger} />
        ))
      ) : (
        value.approvedSources.length === 0 ? <Text style={styles.empty}>No sources approved yet. Add a source while using this Managed profile or approve a request.</Text> : value.approvedSources.map((source) => (
          <ApprovalRow key={source.id} title={source.title} meta="Approved source" busy={busy} onRemove={() => onRevoke("source", source.id)} styles={styles} danger={palette.danger} />
        ))
      )}
      <View style={styles.boundary}><ShieldCheck size={17} color={palette.active} /><Text style={styles.boundaryText}>Requests and approvals stay on this device. Switching modes does not silently approve anything.</Text></View>
    </View>
  );
}

function ModeButton({ label, selected, disabled, onPress, styles }: { label: string; selected: boolean; disabled: boolean; onPress(): void; styles: ReturnType<typeof createStyles> }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.modeButton, selected && styles.modeButtonSelected]} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}><Text style={[styles.modeText, selected && styles.modeTextSelected]}>{label}</Text></Pressable>;
}

function ApprovalRow({ title, meta, busy, onRemove, styles, danger }: { title: string; meta: string; busy: boolean; onRemove(): void; styles: ReturnType<typeof createStyles>; danger: string }) {
  return <View style={styles.row}><View style={styles.flex}><Text style={styles.title} numberOfLines={2}>{title}</Text><Text style={styles.meta} numberOfLines={1}>{meta}</Text></View><Pressable onPress={onRemove} disabled={busy} style={styles.iconButton} accessibilityLabel={`Remove ${title}`}><Trash2 size={15} color={danger} /></Pressable></View>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { gap: spacing.sm, marginTop: spacing.sm }, intro: { ...type.bodySoft, color: palette.inkMuted },
    modeRow: { flexDirection: "row", gap: spacing.sm }, modeButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceHigh }, modeButtonSelected: { borderColor: palette.active, backgroundColor: palette.activeSoft }, modeText: { ...type.label, color: palette.inkMuted, fontSize: 12, textAlign: "center" }, modeTextSelected: { color: palette.active },
    explanation: { ...type.bodySoft, color: palette.inkMuted }, sectionLabel: { ...type.caption, color: palette.inkMuted, marginTop: spacing.md }, empty: { ...type.bodySoft, color: palette.inkMuted, paddingVertical: spacing.sm },
    row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surfaceHigh }, flex: { flex: 1 }, title: { ...type.label, fontSize: 13 }, meta: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted, fontSize: 11 }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    boundary: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: palette.activeSoft }, boundaryText: { ...type.bodySoft, flex: 1, color: palette.inkMuted, fontSize: 11 },
  });
}
