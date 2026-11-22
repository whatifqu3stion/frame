import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import { motion } from "@/constants/motion";
import { Circle } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fonts, radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import GalleryMark from "@/components/motion/GalleryMark";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import Heading from "@/components/Heading";

type Props = { symbol?: string; compact?: boolean; title: string; body?: string; action?: { label: string; onPress: () => void }; gallery?: boolean; complete?: boolean; animateCompletion?: boolean; onPresented?(): void };

export default function EmptyState({ symbol, title, body, action, compact = false, gallery = false, complete = false, animateCompletion = false, onPresented }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  if (gallery) return <MotionView enter={animateCompletion} duration={motion.ending} fromScale={0.97} style={[styles.gallery, compact && { paddingVertical: spacing.lg }]}>
    <ProgrammeGrain />
    {!compact ? <View style={styles.galleryMark}><GalleryMark color={palette.onProgrammeSoft} complete={complete} enter={animateCompletion} onPresented={onPresented} /></View> : null}
    <Heading style={[styles.galleryTitle, complete && { fontFamily: fonts.serifItalic }, compact && { fontSize: 24, lineHeight: 32 }]}>{title}</Heading>
    {body ? <Text style={styles.galleryBody}>{body}</Text> : null}
    {action ? <Pressable accessibilityRole="button" onPress={action.onPress} style={({ pressed }) => [styles.galleryAction, pressed && { opacity: 0.72 }]}><Text style={[type.label, { color: palette.onProgramme }]}>{action.label}</Text></Pressable> : null}
  </MotionView>;
  return (
    <View style={[styles.root, compact && { backgroundColor: "transparent", borderWidth: 0, paddingHorizontal: 0, paddingVertical: spacing.md }]}>
      {!compact ? <View style={styles.symbolWrap}>
        {symbol ? <Text style={styles.symbol}>{symbol}</Text> : <Circle size={22} color={palette.accent} strokeWidth={1.3} />}
      </View> : null}
      <Heading style={styles.title}>{title}</Heading>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <Pressable accessibilityRole="button" onPress={action.onPress} style={styles.action}><Text style={[type.label, { color: palette.active }]}>{action.label}</Text></Pressable> : null}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    gallery: { marginVertical: spacing.md, padding: spacing.lg, paddingVertical: spacing.xl, alignItems: "flex-start", backgroundColor: palette.programme, borderRadius: radii.card },
    galleryMark: { marginBottom: spacing.lg },
    galleryTitle: { ...type.title, color: palette.onProgramme, marginBottom: spacing.md, maxWidth: 420 },
    galleryBody: { ...type.bodySoft, color: palette.onProgrammeSoft, maxWidth: 380 },
    galleryAction: { minHeight: 48, justifyContent: "center", marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.programmeRule, alignSelf: "stretch" },
    root: { marginVertical: spacing.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: "flex-start", backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
    symbolWrap: { height: 32, alignItems: "flex-start", justifyContent: "center", marginBottom: spacing.md },
    symbol: { fontSize: 24, color: palette.accent },
    title: { ...type.heading, fontSize: 22, marginBottom: spacing.sm },
    action: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
    body: { ...type.bodySoft, maxWidth: 290 },
  });
}

