import MotionView from "@/components/motion/MotionView";
import Pressable from "@/components/motion/ChoicePressable";
import { Check, Info, ShieldCheck, Trash2, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import MediaImage from "@/components/MediaImage";
import { isMetadataCurrent } from "@/domain/metadataRetention";
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const confirmRevoke = (kind: "video" | "source", id: string, title: string): void => Alert.alert("Remove approval?", `“${title}” will no longer be approved for this profile. It can be requested and approved again.`, [{ text: "Cancel", style: "cancel" }, { text: "Remove approval", style: "destructive", onPress: () => onRevoke(kind, id) }]);
  return (
    <View style={styles.root}>
      <Text style={styles.intro}>These choices limit what can play inside Frame. They do not rate content or block other apps.</Text>
      <View style={styles.modeRow} accessibilityRole="radiogroup" accessibilityLabel="Content access">
        <ModeButton label="Selected Videos" selected={value.policy.mode === "selectedVideos"} disabled={busy} onPress={() => onModeChange("selectedVideos")} styles={styles} />
        <ModeButton label="Approved Sources" selected={value.policy.mode === "approvedSources"} disabled={busy} onPress={() => onModeChange("approvedSources")} styles={styles} />
      </View>
      <Text style={styles.explanation}>{value.policy.mode === "selectedVideos" ? "Only individual videos approved by the Owner can play." : "Videos can play only when their source is approved by the Owner."}</Text>

      <Text style={styles.sectionLabel}>Requests · {value.requests.length}</Text>
      {value.requests.length === 0 ? <Text style={styles.empty}>No requests to review.</Text> : value.requests.map((request) => (
        <View key={`${request.kind}:${request.targetId}`} style={{ gap: spacing.sm }}><View style={styles.row}>
          <View style={styles.flex}><Text style={styles.title} numberOfLines={2}>{request.title}</Text><Text style={styles.meta}>{request.kind === "video" ? `Video · ${request.sourceTitle || "Unknown source"}` : "Source"}</Text></View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === request.targetId }} accessibilityLabel={`Review details for ${request.title}`} onPress={() => setExpanded(expanded === request.targetId ? null : request.targetId)} style={styles.iconButton}><Info size={18} color={palette.active} /></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onReview(request, "approve")} disabled={busy} style={styles.iconButton} accessibilityLabel={`Approve ${request.title}`}><Check size={16} color={palette.success} /></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onReview(request, "deny")} disabled={busy} style={styles.iconButton} accessibilityLabel={`Deny ${request.title}`}><X size={16} color={palette.danger} /></Pressable>
        </View>
          {expanded === request.targetId ? <MotionView enter style={{ gap: spacing.sm, padding: spacing.md }}><Text style={type.heading}>{request.title}</Text>{isMetadataCurrent(request.fetchedAt, Date.now()) ? <>{request.thumbnailUrl ? <MediaImage source={{ uri: request.thumbnailUrl }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.control }} contentFit="cover" cachePolicy="none" /> : null}<Text style={type.bodySoft}>{request.description || "No description is available."}</Text>{request.durationSeconds > 0 ? <Text style={type.bodySoft}>{Math.ceil(request.durationSeconds / 60)} minutes</Text> : null}</> : <Text style={type.bodySoft}>These details are out of date. Open the video or source in this profile to refresh them before reviewing.</Text>}</MotionView> : null}
        </View>
      ))}

      <Text style={styles.sectionLabel}>{value.policy.mode === "selectedVideos" ? `Selected videos · ${value.approvedVideos.length}` : `Approved sources · ${value.approvedSources.length}`}</Text>
      {value.policy.mode === "selectedVideos" ? (
        value.approvedVideos.length === 0 ? <Text style={styles.empty}>No videos approved yet. Open a video in this profile and choose Request approval.</Text> : value.approvedVideos.map((video) => (
          <ApprovalRow key={video.id} title={video.title} meta={video.channelTitle} busy={busy} onRemove={() => confirmRevoke("video", video.id, video.title)} styles={styles} danger={palette.danger} />
        ))
      ) : (
        value.approvedSources.length === 0 ? <Text style={styles.empty}>No sources approved yet. Add a source while using this Managed profile or approve a request.</Text> : value.approvedSources.map((source) => (
          <ApprovalRow key={source.id} title={source.title} meta="Approved source" busy={busy} onRemove={() => confirmRevoke("source", source.id, source.title)} styles={styles} danger={palette.danger} />
        ))
      )}
      <View style={styles.boundary}><ShieldCheck size={17} color={palette.active} /><Text style={styles.boundaryText}>Requests and approvals stay on this device. Changing modes does not approve new videos or sources.</Text></View>
    </View>
  );
}

function ModeButton({ label, selected, disabled, onPress, styles }: { label: string; selected: boolean; disabled: boolean; onPress(): void; styles: ReturnType<typeof createStyles> }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.modeButton, selected && styles.modeButtonSelected]} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}><Text style={[styles.modeText, selected && styles.modeTextSelected]}>{label}</Text></Pressable>;
}

function ApprovalRow({ title, meta, busy, onRemove, styles, danger }: { title: string; meta: string; busy: boolean; onRemove(): void; styles: ReturnType<typeof createStyles>; danger: string }) {
  return <View style={styles.row}><View style={styles.flex}><Text style={styles.title} numberOfLines={2}>{title}</Text><Text style={styles.meta} numberOfLines={1}>{meta}</Text></View><Pressable accessibilityRole="button" onPress={onRemove} disabled={busy} style={styles.iconButton} accessibilityLabel={`Remove ${title}`}><Trash2 size={15} color={danger} /></Pressable></View>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { gap: spacing.sm, marginTop: spacing.sm }, intro: { ...type.bodySoft, color: palette.inkMuted },
    modeRow: { flexDirection: "row", gap: spacing.sm }, modeButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceHigh }, modeButtonSelected: { borderColor: palette.active, backgroundColor: palette.activeSoft }, modeText: { ...type.label, color: palette.inkMuted, fontSize: 12, textAlign: "center" }, modeTextSelected: { color: palette.active },
    explanation: { ...type.bodySoft, color: palette.inkMuted }, sectionLabel: { ...type.caption, color: palette.inkMuted, marginTop: spacing.md }, empty: { ...type.bodySoft, color: palette.inkMuted, paddingVertical: spacing.sm },
    row: { minHeight: 64, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs, padding: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surfaceHigh }, flex: { flexGrow: 1, flexBasis: "100%" }, title: { ...type.label, fontSize: 13 }, meta: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted, fontSize: 12 }, iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    boundary: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: palette.activeSoft }, boundaryText: { ...type.bodySoft, flex: 1, color: palette.inkMuted, fontSize: 12 },
  });
}

