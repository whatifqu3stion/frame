import ChoiceOption from "@/components/ChoiceOption";
import MotionView from "@/components/motion/MotionView";
import Pressable from "@/components/motion/ChoicePressable";
import { Check, ChevronDown, ShieldCheck, Trash2, X } from "lucide-react-native";
import { useMemo } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import MediaImage from "@/components/MediaImage";
import { isMetadataCurrent } from "@/domain/metadataRetention";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { ManagedApprovalRequest, ManagedContentMode, ManagedContentOverview } from "@/models/managedContentAccess";

type Props = {
  value: ManagedContentOverview;
  busy: boolean;
  expanded: string | null;
  onExpand(value: string | null): void;
  onModeChange(mode: ManagedContentMode): void;
  onReview(request: ManagedApprovalRequest, decision: "approve" | "deny"): void;
  onInspect(request: ManagedApprovalRequest, action: "preview" | "refresh"): void;
  onRevoke(kind: "video" | "source", targetId: string): void;
};

export default function ManagedContentAccessEditor({ value, busy, expanded, onExpand: setExpanded, onModeChange, onReview, onInspect, onRevoke }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const confirmRevoke = (kind: "video" | "source", id: string, title: string): void => Alert.alert("Remove approval?", `“${title}” will no longer be approved for this profile. It can be requested and approved again.`, [{ text: "Cancel", style: "cancel" }, { text: "Remove approval", style: "destructive", onPress: () => onRevoke(kind, id) }]);
  return (
    <View style={styles.root}>
      <Text style={styles.intro}>These choices limit what can play inside Frame. They do not rate content or block other apps.</Text>
      <View style={styles.modeRow} accessibilityRole="radiogroup" accessibilityLabel="Content access">
        <ChoiceOption label="Selected Videos" selected={value.policy.mode === "selectedVideos"} disabled={busy} onPress={() => onModeChange("selectedVideos")} style={styles.modeButton} />
        <ChoiceOption label="Approved Sources" selected={value.policy.mode === "approvedSources"} disabled={busy} onPress={() => onModeChange("approvedSources")} style={styles.modeButton} />
      </View>
      <Text style={styles.explanation}>{value.policy.mode === "selectedVideos" ? "Only individual videos approved by the Owner can play." : "Videos can play only when their source is approved by the Owner."}</Text>

      <Text style={styles.sectionLabel}>Requests · {value.requests.length}</Text>
      {value.requests.length === 0 ? <Text style={styles.empty}>No requests to review.</Text> : value.requests.map((request) => (
        <View key={`${request.kind}:${request.targetId}`} style={{ gap: spacing.sm }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === `${request.kind}:${request.targetId}` }} accessibilityLabel={`Review ${request.title}`} onPress={() => setExpanded(expanded === `${request.kind}:${request.targetId}` ? null : `${request.kind}:${request.targetId}`)} style={styles.row}>
            <View style={styles.flex}><Text style={styles.title}>{request.title}</Text><Text style={styles.meta}>{request.kind === "video" ? `Video · ${request.sourceTitle || "Unknown source"}` : "Source"}</Text></View>
            <Text style={styles.reviewLabel}>{expanded === `${request.kind}:${request.targetId}` ? "Hide details" : "Review request"}</Text><ChevronDown size={18} color={palette.active} />
          </Pressable>
          {expanded === `${request.kind}:${request.targetId}` ? <MotionView enter style={{ gap: spacing.sm, padding: spacing.md }}>
            <Text style={type.bodySoft}>{request.kind === "video" ? "Approve this video for this profile. Its viewing limits still apply." : "Approve videos from this source for this profile. Its viewing limits still apply."}</Text>
            {request.kind === "source" ? <Text style={type.caption}>Request context · source approval covers videos from this creator</Text> : null}
            {isMetadataCurrent(request.fetchedAt, Date.now()) ? <>{request.thumbnailUrl ? <MediaImage source={{ uri: request.thumbnailUrl }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.control }} contentFit="cover" cachePolicy="none" /> : null}<Text style={type.bodySoft}>{request.description || "No description is available."}</Text>{request.durationSeconds > 0 ? <Text style={type.bodySoft}>{Math.ceil(request.durationSeconds / 60)} minutes</Text> : null}</> : <Text style={type.bodySoft}>These details are out of date. Refresh them here before approving. You can still preview the original or decline the request.</Text>}
            <View style={styles.decisions}>
              <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={() => onInspect(request, "preview")} style={styles.decision}><Text style={styles.decisionText}>{request.kind === "video" ? "Preview original video" : "Preview source"}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={() => onInspect(request, "refresh")} style={styles.decision}><Text style={styles.decisionText}>{busy ? "Working…" : "Refresh details"}</Text></Pressable>
            </View>
            <Text style={type.caption}>Preview opens outside Frame with Owner authorization. Return here to decide; nothing is approved automatically.</Text>
            <View style={styles.decisions}>
              <Pressable accessibilityRole="button" onPress={() => onReview(request, "approve")} disabled={busy || !isMetadataCurrent(request.fetchedAt, Date.now())} accessibilityState={{ disabled: busy || !isMetadataCurrent(request.fetchedAt, Date.now()), busy }} style={[styles.decision, (busy || !isMetadataCurrent(request.fetchedAt, Date.now())) && { opacity: 0.5 }]} accessibilityLabel={`Approve ${request.kind}: ${request.title}`}><Check size={16} color={palette.success} /><Text style={styles.decisionText}>{request.kind === "video" ? "Approve video" : "Approve source"}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => onReview(request, "deny")} disabled={busy} accessibilityState={{ disabled: busy, busy }} style={[styles.decision, busy && { opacity: 0.5 }]} accessibilityLabel={`Decline request for ${request.title}`}><X size={16} color={palette.danger} /><Text style={styles.decisionText}>Decline request</Text></Pressable>
            </View>
            <Text style={type.caption}>Declining removes this request without adding an approval. It can be requested again.</Text>
          </MotionView> : null}
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

function ApprovalRow({ title, meta, busy, onRemove, styles, danger }: { title: string; meta: string; busy: boolean; onRemove(): void; styles: ReturnType<typeof createStyles>; danger: string }) {
  return <View style={styles.row}><View style={styles.flex}><Text style={styles.title} numberOfLines={2}>{title}</Text><Text style={styles.meta} numberOfLines={1}>{meta}</Text></View><Pressable accessibilityRole="button" onPress={onRemove} disabled={busy} style={styles.iconButton} accessibilityLabel={`Remove approval for ${title}`}><Trash2 size={15} color={danger} /></Pressable></View>;
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    decisionText: { ...type.label, flexShrink: 1 },
    reviewLabel: { ...type.label, color: palette.active }, decisions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, decision: { minHeight: 48, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.control, backgroundColor: palette.surface },
    root: { gap: spacing.sm, marginTop: spacing.sm }, intro: { ...type.bodySoft, color: palette.inkMuted },
    modeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, modeButton: { flexGrow: 1, flexBasis: 140 },
    explanation: { ...type.bodySoft, color: palette.inkMuted }, sectionLabel: { ...type.caption, color: palette.inkMuted, marginTop: spacing.md }, empty: { ...type.bodySoft, color: palette.inkMuted, paddingVertical: spacing.sm },
    row: { minHeight: 64, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs, padding: spacing.sm, borderRadius: radii.control, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surfaceHigh }, flex: { flexGrow: 1, flexBasis: "100%" }, title: { ...type.label }, meta: { ...type.bodySoft, marginTop: 2, color: palette.inkMuted }, iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    boundary: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: palette.activeSoft }, boundaryText: { ...type.bodySoft, flex: 1, color: palette.inkMuted, fontSize: 12 },
  });
}

