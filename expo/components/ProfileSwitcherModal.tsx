import Text from "@/components/FrameText";
import { Check, ChevronRight, Clock3, LockKeyhole, UserRound, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Sheet from "@/components/Sheet";
import { radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

export type ProfileSwitcherModalProps = { visible: boolean; onClose: () => void };

/** Compact household profile chooser; Standard and Managed profiles are freely enterable. */
export default function ProfileSwitcherModal({ visible, onClose }: ProfileSwitcherModalProps) {
  const { profiles, activeProfileId, profileSwitching, switchProfile, hasOwnerPin } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const close = (): void => {
    if (profileSwitching) return;
    setFeedback(null);
    onClose();
  };

  const choose = async (profileId: string): Promise<void> => {
    if (switchingId) return;
    setFeedback(null);
    setSwitchingId(profileId);
    try {
      const result = await switchProfile(profileId);
      if (result.ok) { setFeedback(null); onClose(); }
      else if (result.message !== "Profile switch cancelled.") setFeedback(result.message);
    } catch { setFeedback("Frame couldn’t switch profiles. Try again."); }
    finally { setSwitchingId(null); }
  };

  return (
    <Sheet label="Switch profile" visible={visible} onClose={close}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}><Text style={styles.eyebrow}>This device</Text><Text style={styles.heading}>Who’s watching?</Text></View>
            <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={palette.inkMuted} />
            </Pressable>
          </View>
          <View style={styles.list}>
            {profiles.map((profile) => {
              const isActive = profile.id === activeProfileId;
              return (
                <Pressable
                  key={profile.id}
                  onPress={() => { void choose(profile.id); }}
                  disabled={Boolean(switchingId) || profileSwitching || isActive}
                  style={({ pressed }) => [styles.row, isActive && styles.rowActive, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive, disabled: Boolean(switchingId) || profileSwitching || isActive }}
                  testID={`switch-profile-${profile.id}`}
                >
                  <View style={[styles.avatar, isActive && styles.avatarActive]}>{profile.role === "managed" ? <Clock3 size={19} color={isActive ? palette.active : palette.inkMuted} /> : <UserRound size={19} color={isActive ? palette.active : palette.inkMuted} />}</View>
                  <View style={styles.flex}><Text style={styles.name}>{profile.name}</Text><Text style={styles.role}>{profile.role === "owner" ? "Owner" : profile.role === "managed" ? "Managed · Owner controls" : "Standard"}{profile.role === "owner" && hasOwnerPin ? " · PIN" : ""}</Text></View>
                  {switchingId === profile.id ? <ActivityIndicator size="small" color={palette.active} /> : isActive ? <Check size={18} color={palette.active} /> : profile.role === "owner" && hasOwnerPin ? <LockKeyhole size={16} color={palette.inkMuted} /> : <ChevronRight size={17} color={palette.inkMuted} />}
                </Pressable>
              );
            })}
          </View>
          {feedback ? <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text> : null}
          <Text style={styles.note}>Each profile keeps its own library, preferences, and viewing limits on this device.</Text>
    </Sheet>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", padding: spacing.md, backgroundColor: palette.overlay },
    card: { ...softShadow, padding: spacing.lg, paddingTop: spacing.md, borderRadius: radii.large, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    eyebrow: { ...type.caption, color: palette.accent },
    heading: { ...type.heading, fontSize: 24, marginTop: spacing.xs },
    closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    list: { gap: spacing.sm, marginTop: spacing.lg },
    row: { minHeight: 64, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    rowActive: { borderColor: palette.active, backgroundColor: palette.activeSoft },
    avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: palette.surfaceDeep },
    avatarActive: { backgroundColor: palette.surfaceHigh },
    flex: { flex: 1 },
    name: { ...type.label, fontSize: 15 },
    role: { ...type.bodySoft, color: palette.inkMuted, marginTop: 1, fontSize: 12 },
    feedback: { ...type.label, color: palette.danger, marginTop: spacing.md },
    note: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.md, fontSize: 12 },
    pressed: { opacity: 0.75 },
  });
}

