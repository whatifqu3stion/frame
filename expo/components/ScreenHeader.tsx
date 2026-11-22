import Text from "@/components/FrameText";
import { ChevronDown, UserRound } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fonts, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import ProfileSwitcherModal from "@/components/ProfileSwitcherModal";
import Heading from "@/components/Heading";

type Props = { eyebrow?: string; title: string; subtitle?: string; editorial?: boolean; compact?: boolean; titleAction?: ReactNode };

export default function ScreenHeader({ eyebrow, title, subtitle, editorial = false, compact = false, titleAction }: Props) {
  const { palette, type } = useFrameTheme();
  const { activeProfile } = useApp();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [chooserOpen, setChooserOpen] = useState<boolean>(false);
  return (
    <View style={[styles.root, compact && styles.compactRoot]}>
      <View style={styles.topRow}>
      <View style={styles.headingGroup}>
        <Heading level={1} style={[styles.title, editorial && styles.editorialTitle, compact && styles.compactTitle]}>{editorial && !compact ? title : eyebrow || title.replace(/\n/g, " ")}</Heading>
        {titleAction}
      </View>
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
    root: { paddingTop: spacing.md, paddingBottom: spacing.lg, marginBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
    topRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    headingGroup: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
    profileButton: { minHeight: 48, maxWidth: 180, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 10, backgroundColor: palette.surface },
    profileName: { ...type.label, maxWidth: 88, color: palette.inkMuted, fontSize: 12 },
    title: { ...type.title, flexShrink: 1 },
    editorialTitle: { ...type.display, fontSize: 46, lineHeight: 56, paddingBottom: spacing.xs },
    compactRoot: { paddingTop: 0, paddingBottom: spacing.sm, marginBottom: 0 },
    compactTitle: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 40, color: palette.ink },
    subtitle: { ...type.bodySoft, marginTop: spacing.sm, maxWidth: 480 },
    pressed: { opacity: 0.72 },
  });
}

