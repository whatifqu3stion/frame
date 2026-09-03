import { Check, ChevronRight, LockKeyhole, UserRound, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, softShadow, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

export type ProfileSwitcherModalProps = { visible: boolean; onClose: () => void };

/** Compact household profile chooser; Standard profiles never require a PIN. */
export default function ProfileSwitcherModal({ visible, onClose }: ProfileSwitcherModalProps) {
  const { profiles, activeProfileId, profileSwitching, switchProfile, hasOwnerPin } = useApp();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const close = (): void => {
    if (profileSwitching) return;
    setFeedback(null);
    onClose();
  };

  const choose = async (profileId: string): Promise<void> => {
    setFeedback(null);
    const result = await switchProfile(profileId);
    if (result.ok) close();
    else if (result.message !== "Profile switch cancelled.") setFeedback(result.message);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={close}>
      <Pressable onPress={close} style={styles.backdrop} accessibilityLabel="Close profile chooser">
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.card}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View><Text style={styles.eyebrow}>This device</Text><Text style={styles.heading}>Who’s watching?</Text></View>
            <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={palette.inkMuted} />
            </Pressable>
          </View>
          <View style={styles.list}>
            {profiles.filter((profile) => profile.role !== "managed").map((profile) => {
              const isActive = profile.id === activeProfileId;
              return (
                <Pressable
                  key={profile.id}
                  onPress={() => { void choose(profile.id); }}
                  disabled={profileSwitching || isActive}
                  style={({ pressed }) => [styles.row, isActive && styles.rowActive, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive, disabled: profileSwitching || isActive }}
                  testID={`switch-profile-${profile.id}`}
                >
                  <View style={[styles.avatar, isActive && styles.avatarActive]}><UserRound size={19} color={isActive ? palette.active : palette.inkMuted} /></View>
                  <View style={styles.flex}><Text style={styles.name}>{profile.name}</Text><Text style={styles.role}>{profile.role === "owner" ? "Owner" : "Standard"}{profile.role === "owner" && hasOwnerPin ? " · PIN" : ""}</Text></View>
                  {profileSwitching && !isActive ? <ActivityIndicator size="small" color={palette.active} /> : isActive ? <Check size={18} color={palette.active} /> : profile.role === "owner" && hasOwnerPin ? <LockKeyhole size={16} color={palette.inkMuted} /> : <ChevronRight size={17} color={palette.inkMuted} />}
                </Pressable>
              );
            })}
          </View>
          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
          <Text style={styles.note}>Each profile keeps its own sources, library, progress, interests, and appearance on this device.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", padding: spacing.md, backgroundColor: palette.overlay },
    card: { ...softShadow, padding: spacing.lg, paddingTop: spacing.md, borderRadius: radii.large, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceHigh },
    handle: { width: 36, height: 4, alignSelf: "center", marginBottom: spacing.md, borderRadius: 2, backgroundColor: palette.surfaceDeep },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    eyebrow: { ...type.caption, color: palette.accent },
    heading: { ...type.heading, fontSize: 24, marginTop: spacing.xs },
    closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    list: { gap: spacing.sm, marginTop: spacing.lg },
    row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    rowActive: { borderColor: palette.active, backgroundColor: palette.activeSoft },
    avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: palette.surfaceDeep },
    avatarActive: { backgroundColor: palette.surfaceHigh },
    flex: { flex: 1 },
    name: { ...type.label, fontSize: 15 },
    role: { ...type.bodySoft, color: palette.inkMuted, marginTop: 1, fontSize: 12 },
    feedback: { ...type.label, color: palette.danger, marginTop: spacing.md },
    note: { ...type.bodySoft, color: palette.inkMuted, marginTop: spacing.md, fontSize: 12 },
    pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  });
}
