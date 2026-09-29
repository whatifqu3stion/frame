import Image from "@/components/MediaImage";
import { Check, Plus, Play } from "lucide-react-native";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { formatDuration } from "@/services/youtube";
import type { WeeklyPickSourceSuggestion } from "@/types";

type Feedback = { ok: boolean; message: string };

type Props = {
  suggestion: WeeklyPickSourceSuggestion;
  interestName: string;
  followed: boolean;
  busy: boolean;
  disabled?: boolean;
  feedback?: Feedback;
  onPreview(): void;
  onFollow(): void;
  onDismiss(): void;
};

export default function WeeklyPickCard({ suggestion, interestName, followed, busy, disabled = false, feedback, onPreview, onFollow, onDismiss }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const media = suggestion.featuredMedia;
  const duration = media?.durationSeconds ? formatDuration(media.durationSeconds) : null;

  return (
    <View style={styles.card} testID={`weekly-pick-${suggestion.providerSourceId}`}>
      {media?.thumbnailUrl ? (
        <Pressable onPress={onPreview} accessibilityRole="button" accessibilityLabel={`Preview ${media.title}`} style={styles.preview}>
          <Image
            source={{ uri: media.thumbnailUrl }}
            style={styles.previewImage}
            contentFit="cover"
            cachePolicy="disk"
            recyclingKey={media.providerMediaId}
            accessibilityLabel={`Featured video from ${suggestion.displayName}`}
          />
          {duration ? <View style={styles.durationBadge}><Text style={styles.durationText}>{duration}</Text></View> : null}
        </Pressable>
      ) : null}

      <View style={styles.content}>
        <View style={styles.sourceHeader}>
          <View style={styles.avatar}>
            {suggestion.thumbnailUrl ? (
              <Image
                source={{ uri: suggestion.thumbnailUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                cachePolicy="disk"
                recyclingKey={suggestion.providerSourceId}
                accessibilityLabel=""
              />
            ) : <Text style={styles.avatarFallback}>{suggestion.displayName.slice(0, 1).toUpperCase()}</Text>}
          </View>
          <View style={styles.sourceCopy}>
            <Text style={styles.interestLabel}>{interestName}</Text>
            <Text style={styles.sourceName} numberOfLines={2}>{suggestion.displayName}</Text>
            {suggestion.handle ? <Text style={styles.handle} numberOfLines={1}>{suggestion.handle}</Text> : null}
          </View>
        </View>

        {suggestion.recommendationReason ? <Text style={styles.reason}>{suggestion.recommendationReason}</Text> : null}
        {!suggestion.recommendationReason && suggestion.description ? <Text style={styles.description} numberOfLines={3}>{suggestion.description}</Text> : null}
        {media ? (
          <Pressable onPress={onPreview} accessibilityRole="button" accessibilityLabel={`Preview ${media.title}`} style={styles.featuredCopy}>
            <Text style={styles.featuredLabel}>Featured video</Text>
            <Text style={styles.featuredTitle} numberOfLines={2}>{media.title}</Text><View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", minHeight: 48 }}><Play size={16} color={palette.active} /><Text style={[type.label, { color: palette.active }]}>Preview video</Text></View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onFollow}
          disabled={followed || busy || disabled}
          style={({ pressed }) => [styles.followButton, followed && styles.followedButton, pressed && !followed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ disabled: followed || busy || disabled, busy }}
          accessibilityLabel={followed ? `${suggestion.displayName} is followed` : `Follow ${suggestion.displayName}`}
          testID={`weekly-pick-follow-${suggestion.providerSourceId}`}
        >
          {busy ? <ActivityIndicator size="small" color={palette.onAccent} /> : followed ? <Check size={17} color={palette.active} strokeWidth={2.2} /> : <Plus size={17} color={palette.onAccent} strokeWidth={2.2} />}
          <Text style={[styles.followText, followed && styles.followedText]}>{busy ? "Adding…" : followed ? "Followed" : "Follow source"}</Text>
        </Pressable>

        <Pressable
          onPress={onDismiss}
          disabled={busy || disabled}
          style={styles.dismissButton}
          accessibilityRole="button"
          accessibilityLabel={`Not for me: ${suggestion.displayName}`}
          testID={`weekly-pick-dismiss-${suggestion.providerSourceId}`}
        >
          <Text style={styles.dismissText}>Not for me</Text>
        </Pressable>

        {feedback ? <Text style={[styles.feedback, !feedback.ok && styles.feedbackError]} accessibilityLiveRegion="polite">{feedback.message}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    card: { overflow: "hidden", borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSoft },
    preview: { aspectRatio: 16 / 9, backgroundColor: palette.surfaceDeep },
    previewImage: { width: "100%", height: "100%" },
    durationBadge: { position: "absolute", right: spacing.sm, bottom: spacing.sm, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.small, backgroundColor: palette.overlay },
    durationText: { ...type.caption, color: palette.onDark, fontSize: 12, lineHeight: 17, letterSpacing: 0.4 },
    content: { padding: spacing.md },
    sourceHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 24, backgroundColor: palette.surfaceDeep },
    avatarImage: { width: "100%", height: "100%" },
    avatarFallback: { ...type.heading, color: palette.active },
    sourceCopy: { flex: 1 },
    interestLabel: { ...type.caption, color: palette.active, marginBottom: 2 },
    sourceName: { ...type.heading, fontSize: 18, lineHeight: 23 },
    handle: { ...type.bodySoft, color: palette.inkMuted, marginTop: 1 },
    reason: { ...type.body, color: palette.inkSoft, marginTop: spacing.md },
    description: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.md },
    featuredCopy: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: palette.borderSoft },
    featuredLabel: { ...type.caption, color: palette.inkMuted },
    featuredTitle: { ...type.label, color: palette.ink, marginTop: spacing.xs, fontSize: 14, lineHeight: 20 },
    followButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, borderRadius: radii.control, backgroundColor: palette.active },
    followedButton: { backgroundColor: palette.activeSoft, borderWidth: 1, borderColor: palette.borderSoft },
    followText: { ...type.label, color: palette.onAccent },
    followedText: { color: palette.active },
    dismissButton: { minHeight: 48, justifyContent: "center", alignItems: "center", marginTop: spacing.xs },
    dismissText: { ...type.label, color: palette.inkMuted },
    feedback: { ...type.bodySoft, color: palette.success, marginTop: spacing.sm, textAlign: "center" },
    feedbackError: { color: palette.danger },
    pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  });
}

