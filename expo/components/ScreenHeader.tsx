import { ChevronDown, UserRound } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import ProfileSwitcherModal from "@/components/ProfileSwitcherModal";

type Props = { eyebrow?: string; title: string; subtitle?: string };

export default function ScreenHeader({ eyebrow, title, subtitle }: Props) {
  const { palette, type } = useFrameTheme();
  const { activeProfile } = useApp();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [chooserOpen, setChooserOpen] = useState<boolean>(false);
  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
      <Text style={styles.title} accessibilityRole="header">{eyebrow || title.replace(/\n/g, " ")}</Text>
      <Pressable onPress={() => setChooserOpen(true)} style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Current profile: ${activeProfile?.name ?? "Owner"}. Change profile.`} testID="open-profile-switcher">
        <UserRound size={15} color={palette.active} />
        <Text style={styles.profileName} numberOfLines={1}>{activeProfile?.name ?? "Owner"}</Text>
        <ChevronDown size={14} color={palette.inkMuted} />
      </Pressable>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <ProfileSwitcherModal visible={chooserOpen} onClose={() => setChooserOpen(false)} />
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { paddingTop: spacing.md, paddingBottom: spacing.lg },
    topRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    profileButton: { minHeight: 48, maxWidth: 180, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 22, borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.surface },
    profileName: { ...type.label, maxWidth: 88, color: palette.inkMuted, fontSize: 12 },
    eyebrow: { ...type.caption, color: palette.accent },
    title: { ...type.title, flexShrink: 1 },
    subtitle: { ...type.bodySoft, marginTop: spacing.sm, maxWidth: 480 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  });
}

