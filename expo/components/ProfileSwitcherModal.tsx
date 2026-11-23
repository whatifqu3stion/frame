import { Check, ChevronRight, Clock3, LockKeyhole, UserRound, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import Text from "@/components/FrameText";
import Heading from "@/components/Heading";
import Sheet from "@/components/Sheet";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

export type ProfileSwitcherModalProps = { visible: boolean; onClose: () => void };

/** Compact household profile chooser; Standard and Managed profiles are freely enterable. */
export default function ProfileSwitcherModal({ visible, onClose }: ProfileSwitcherModalProps) {
  const { profiles, activeProfileId, profileSwitching, switchProfile, hasOwnerPin, isOwnerAuthorized } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "ios" && visible && feedback) AccessibilityInfo.announceForAccessibility(feedback);
  }, [feedback, visible]);

  const close = (): void => {
    if (profileSwitching) return;
    setFeedback(null);
    onClose();
  };

  const choose = async (profileId: string): Promise<void> => {
    if (switchingId || profileSwitching || profileId === activeProfileId) return;
    setFeedback(null);
    setSwitchingId(profileId);
    try {
      const result = await switchProfile(profileId);
      if (result.ok) onClose();
      else if (result.message !== "Profile switch cancelled.") setFeedback(result.message);
    } catch {
      setFeedback("Frame couldn’t switch profiles. Try again.");
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <Sheet label="Switch profile" visible={visible} onClose={close}>
      <View style={styles.headerRow}>
        <Heading style={styles.heading}>Who’s watching?</Heading>
        <Pressable
          onPress={close}
          disabled={profileSwitching}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close profile chooser"
        >
          <X size={19} color={palette.inkMuted} />
        </Pressable>
      </View>
      <View style={styles.list}>
        {profiles.map((profile) => {
          const current = profile.id === activeProfileId;
          const switching = switchingId === profile.id;
          const disabled = Boolean(switchingId) || profileSwitching || current;
          const needsPin = profile.role === "owner" && hasOwnerPin && !isOwnerAuthorized && !current;
          const role = profile.role === "owner" ? "Owner" : profile.role === "managed" ? "Managed" : "Standard";
          const descriptions = [];
          if (profile.name !== role) descriptions.push(role);
          if (current) descriptions.push("Current profile");
          if (needsPin) descriptions.push("Owner PIN required");
          if (profile.role === "managed") descriptions.push("Owner controls");
          const Icon = profile.role === "managed" ? Clock3 : UserRound;
          const Indicator = current ? Check : needsPin ? LockKeyhole : ChevronRight;
          return (
            <Pressable
              key={profile.id}
              onPress={() => { void choose(profile.id); }}
              disabled={disabled}
              style={({ pressed }) => [styles.row, current && styles.rowActive, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={[profile.name, ...descriptions].join(", ")}
              accessibilityState={{ selected: current, disabled, busy: switching }}
              testID={`switch-profile-${profile.id}`}
            >
              <View style={[styles.avatar, current && styles.avatarActive]}>
                <Icon size={20} color={current ? palette.active : palette.inkMuted} />
              </View>
              <View style={styles.identity}>
                <Text style={styles.name}>{profile.name}</Text>
                {descriptions.length > 0 && <Text style={styles.role}>{descriptions.join(" · ")}</Text>}
              </View>
              {switching ? <ActivityIndicator size="small" color={palette.active} /> : <Indicator size={18} color={current ? palette.active : palette.inkMuted} />}
            </Pressable>
          );
        })}
      </View>
      {feedback && <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}
      {profiles.length === 1 && <Text style={styles.note}>Add another profile in Settings under Profiles &amp; viewing limits.</Text>}
    </Sheet>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    heading: { ...type.heading, flex: 1, fontSize: Platform.isTV ? 28 : 24 },
    closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.control },
    list: { gap: spacing.sm, marginTop: spacing.sm },
    row: { minHeight: 64, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    rowActive: { borderColor: palette.active, backgroundColor: palette.activeSoft },
    avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: palette.surfaceDeep },
    avatarActive: { backgroundColor: palette.surfaceHigh },
    identity: { flex: 1 },
    name: { ...type.label, fontSize: Platform.isTV ? 19 : 16 },
    role: { ...type.bodySoft, color: palette.inkMuted, marginTop: 1, fontSize: Platform.isTV ? 16 : 13 },
    feedback: { ...type.label, color: palette.danger, marginTop: spacing.md },
    note: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.md, fontSize: Platform.isTV ? 16 : 13 },
    pressed: { opacity: 0.75 },
  });
}
