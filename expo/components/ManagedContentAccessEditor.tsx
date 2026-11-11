import Text from "@/components/FrameText";
import TextField from "@/components/TextField";
import { collectionPage } from "@/domain/collectionPage";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
import ChoiceOption from "@/components/ChoiceOption";
import MotionView from "@/components/motion/MotionView";
import Pressable from "@/components/motion/ChoicePressable";
import { isPointerActivation } from "@/components/motion/pointerActivation";
import { Check, ShieldCheck, Trash2, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { confirmUser } from "@/services/notifyUser";
import { StyleSheet, View } from "react-native";
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
  onReview(request: ManagedApprovalRequest, decision: "approve" | "deny", pointer: boolean): void;
  onInspect(request: ManagedApprovalRequest, action: "preview" | "refresh"): void;
  onRevoke(kind: "video" | "source", targetId: string): void;
};

export default function ManagedContentAccessEditor({ value, busy, expanded, onExpand: setExpanded, onModeChange, onReview, onInspect, onRevoke }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [requestQuery, setRequestQuery] = useState("");
  const [requestPage, setRequestPage] = useState(0);
  const [approvalQuery, setApprovalQuery] = useState("");
  const [approvalPage, setApprovalPage] = useState(0);
  const requests = useMemo(() => collectionPage(value.requests, requestQuery, requestPage, (item) => `${item.title} ${item.sourceTitle}`), [value.requests, requestQuery, requestPage]);
  const approvals = useMemo(() => {
    const entries: { id: string; title: string; meta: string; kind: "video" | "source" }[] = value.policy.mode === "selectedVideos"
      ? value.approvedVideos.map((item) => ({ id: item.id, title: item.title, meta: item.channelTitle, kind: "video" as const }))
      : value.approvedSources.map((item) => ({ id: item.id, title: item.title, meta: "Approved source", kind: "source" as const }));
    return collectionPage(entries, approvalQuery, approvalPage, (item) => `${item.title} ${item.meta}`);
  }, [value.policy.mode, value.approvedVideos, value.approvedSources, approvalQuery, approvalPage]);
  const approvalCount = value.policy.mode === "selectedVideos" ? value.approvedVideos.length : value.approvedSources.length;
  const confirmRevoke = (kind: "video" | "source", id: string, title: string): void => confirmUser("Remove approval?", `“${title}” will no longer be approved for this profile. You can approve it again later.`, "Remove approval", (accepted) => { if (accepted) onRevoke(kind, id); }, true);
  return (
    <View style={styles.root}>
      <Text style={styles.sectionLabel}>Requests · {value.requests.length}</Text>
      {value.requests.length > 20 || requestQuery ? <TextField accessibilityLabel="Find an approval request" placeholder="Find a request" value={requestQuery} editable={!busy} onChangeText={(query) => { setRequestQuery(query); setRequestPage(0); setExpanded(null); }} /> : null}
      <PageControls label="Requests" page={requests.page} pages={requests.pages} total={requests.total} busy={busy} onChange={(page) => { setRequestPage(page); setExpanded(null); }} />
      {requests.total === 0 ? <Text style={styles.empty}>{requestQuery.trim() ? "No matching requests. Try another search." : "No requests to review."}</Text> : requests.items.map((request) => (
        <View key={`${request.kind}:${request.targetId}`} style={{ gap: spacing.sm }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === `${request.kind}:${request.targetId}` }} accessibilityLabel={`Review ${request.title}`} onPress={() => setExpanded(expanded === `${request.kind}:${request.targetId}` ? null : `${request.kind}:${request.targetId}`)} style={styles.row}>
            <View style={styles.flex}><Text style={styles.title}>{request.title}</Text><Text style={styles.meta}>{request.kind === "video" ? `Video · ${request.sourceTitle || "Unknown source"}` : "Source"}</Text></View>
            <Text style={styles.reviewLabel}>{expanded === `${request.kind}:${request.targetId}` ? "Hide details" : "Review request"}</Text><DisclosureIndicator expanded={expanded === `${request.kind}:${request.targetId}`} size={18} color={palette.active} />
          </Pressable>
          {expanded === `${request.kind}:${request.targetId}` ? <MotionView enter style={{ gap: spacing.sm, padding: spacing.md }}>
            <Text style={type.bodySoft}>{request.kind === "video" ? "Approve this video for this profile. Its viewing limits still apply." : "Approve videos from this source for this profile. Its viewing limits still apply."}</Text>
            {isMetadataCurrent(request.fetchedAt, Date.now()) ? <>{request.thumbnailUrl ? <MediaImage source={{ uri: request.thumbnailUrl }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.media }} contentFit="cover" cachePolicy="none" /> : null}{request.kind === "source" && request.description ? <Text style={type.bodySoft}>{request.description}</Text> : null}{request.durationSeconds > 0 ? <Text style={type.bodySoft}>{Math.ceil(request.durationSeconds / 60)} minutes</Text> : null}</> : <Text style={type.bodySoft}>These details are out of date. Refresh them here before approving. You can still preview the original or decline the request.</Text>}
            <View style={styles.decisions}>
              <Pressable accessibilityRole="button" onPress={event => onReview(request, "approve", isPointerActivation(event))} disabled={busy || !isMetadataCurrent(request.fetchedAt, Date.now())} accessibilityState={{ disabled: busy || !isMetadataCurrent(request.fetchedAt, Date.now()), busy }} style={[styles.decision, (busy || !isMetadataCurrent(request.fetchedAt, Date.now())) && { opacity: 0.5 }]} accessibilityLabel={`Approve ${request.kind}: ${request.title}`}><Check size={16} color={palette.success} /><Text style={styles.decisionText}>{request.kind === "video" ? "Approve video" : "Approve source"}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={event => onReview(request, "deny", isPointerActivation(event))} disabled={busy} accessibilityState={{ disabled: busy, busy }} style={[styles.decision, busy && { opacity: 0.5 }]} accessibilityLabel={`Decline request for ${request.title}`}><X size={16} color={palette.danger} /><Text style={styles.decisionText}>Decline request</Text></Pressable>
            </View>
            <Text style={type.caption}>A declined request can be made again.</Text>
            <View style={styles.decisions}>
              <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={() => onInspect(request, "preview")} style={styles.decision}><Text style={styles.decisionText}>{request.kind === "video" ? "Preview original video" : "Preview source"}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={() => onInspect(request, "refresh")} style={styles.decision}><Text style={styles.decisionText}>{busy ? "Working…" : "Refresh details"}</Text></Pressable>
            </View>
            <Text style={type.caption}>Preview opens outside Frame. Return here to decide.</Text>
          </MotionView> : null}
        </View>
      ))}

      <Text style={styles.intro}>Choose how the Owner approves viewing in Frame. Changes to content access apply immediately.</Text>
      <View style={styles.modeRow} accessibilityRole="radiogroup" accessibilityLabel="Content access">
        <ChoiceOption label="Selected Videos" selected={value.policy.mode === "selectedVideos"} disabled={busy} onPress={() => onModeChange("selectedVideos")} style={styles.modeButton} />
        <ChoiceOption label="Approved Sources" selected={value.policy.mode === "approvedSources"} disabled={busy} onPress={() => onModeChange("approvedSources")} style={styles.modeButton} />
      </View>
      <Text style={styles.explanation}>{value.policy.mode === "selectedVideos" ? "Only individual videos approved by the Owner can play." : "Videos can play only when their source is approved by the Owner."}</Text>

      <Text style={styles.sectionLabel}>{value.policy.mode === "selectedVideos" ? `Selected videos · ${value.approvedVideos.length}` : `Approved sources · ${value.approvedSources.length}`}</Text>
      {approvalCount > 20 || approvalQuery ? <TextField accessibilityLabel="Find an existing approval" placeholder="Find an approval" value={approvalQuery} editable={!busy} onChangeText={(query) => { setApprovalQuery(query); setApprovalPage(0); }} /> : null}
      <PageControls label="Approvals" page={approvals.page} pages={approvals.pages} total={approvals.total} busy={busy} onChange={setApprovalPage} />
      {approvals.total === 0 ? <Text style={styles.empty}>{approvalQuery.trim() ? "No matching approvals. Try another search." : value.policy.mode === "selectedVideos" ? "No videos approved yet. Open a video in this profile and choose Request approval." : "No sources approved yet. Add a source while using this Managed profile or approve a request."}</Text> : approvals.items.map((item) => (
        <ApprovalRow key={item.id} title={item.title} meta={item.meta} busy={busy} onRemove={() => confirmRevoke(item.kind, item.id, item.title)} styles={styles} danger={palette.danger} />
      ))}
      <View style={styles.boundary}><ShieldCheck size={17} color={palette.active} /><Text style={styles.boundaryText}>Requests and approvals stay on this device. Changing modes does not approve new videos or sources.</Text></View>
    </View>
  );
}

function PageControls({ label, page, pages, total, busy, onChange }: { label: string; page: number; pages: number; total: number; busy: boolean; onChange(page: number): void }) {
  const { palette, type } = useFrameTheme();
  if (pages <= 1) return null;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
    <Text style={type.caption} accessibilityLiveRegion="polite">{label} · Page {page + 1} of {pages} · {total} results</Text>
    {([-1, 1] as const).map((direction) => {
      const disabled = busy || page + direction < 0 || page + direction >= pages;
      return <Pressable key={direction} accessibilityRole="button" accessibilityLabel={`${direction < 0 ? "Previous" : "Next"} ${label.toLowerCase()} page`} disabled={disabled} accessibilityState={{ disabled }} onPress={() => onChange(page + direction)} style={{ minWidth: 48, minHeight: 48, paddingHorizontal: spacing.sm, justifyContent: "center", opacity: disabled ? 0.4 : 1 }}><Text style={[type.label, { color: palette.active }]}>{direction < 0 ? "Previous" : "Next"}</Text></Pressable>;
    })}
  </View>;
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

