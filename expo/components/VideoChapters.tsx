import Pressable from "@/components/motion/ChoicePressable";
import { ListVideo } from "lucide-react-native";
import { memo, useMemo } from "react";
import {  StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { palette, radii, spacing, type, watchPalette } from "@/constants/theme";
import { formatDuration, type VideoChapter } from "@/services/youtube";

function formatChapterTime(seconds: number): string {
  return seconds === 0 ? "0:00" : formatDuration(seconds);
}

type VideoChaptersProps = {
  chapters: VideoChapter[];
  currentSeconds: number;
  onJump: (chapter: VideoChapter) => void;
  disabled?: boolean;
};

function VideoChapters({ chapters, currentSeconds, onJump, disabled = false }: VideoChaptersProps) {
  const { fontScale } = useWindowDimensions();
  const stack = fontScale > 1.3;
  const activeStart = useMemo<number>(() => {
    let active = chapters[0]?.startSeconds ?? 0;
    for (const chapter of chapters) {
      if (chapter.startSeconds > currentSeconds) break;
      active = chapter.startSeconds;
    }
    return active;
  }, [chapters, currentSeconds]);

  if (chapters.length === 0) return null;

  return (
    <View style={styles.section} accessibilityLabel="Video chapters">
      <View style={styles.headingRow}>
        <ListVideo size={16} color={palette.accentSoft} strokeWidth={1.7} />
        <Text style={styles.heading} accessibilityRole="header">Chapters</Text>
      </View>
      <Text style={styles.note}>Creator-provided timestamps</Text>
      <View style={styles.list}>
        {chapters.map((chapter) => {
          const isActive = chapter.startSeconds === activeStart;
          const time = formatChapterTime(chapter.startSeconds);
          return (
            <Pressable
              key={`${chapter.startSeconds}-${chapter.title}`}
              onPress={() => onJump(chapter)}
              disabled={disabled}
              style={({ pressed }) => [styles.row, stack && styles.stackedRow, isActive && styles.activeRow, (pressed || disabled) && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${time}, ${chapter.title}`}
              accessibilityState={{ selected: isActive, disabled }}
              testID={`chapter-${chapter.startSeconds}`}
            >
              <Text style={[styles.time, isActive && styles.activeTime]}>{time}</Text>
              <Text style={[styles.title, stack && { flex: 0, width: "100%" }, isActive && styles.activeTitle]}>{chapter.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default memo(VideoChapters);

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: watchPalette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: watchPalette.border },
  headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heading: { ...type.heading, color: palette.wall, fontSize: 18, lineHeight: 24 },
  note: { ...type.caption, fontSize: 12, color: "rgba(250,249,246,0.72)", marginTop: spacing.xs },
  list: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: "rgba(250,249,246,0.22)" },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: "rgba(250,249,246,0.18)" },
  activeRow: { backgroundColor: watchPalette.glow, borderRadius: radii.small },
  stackedRow: { flexDirection: "column", alignItems: "flex-start", gap: spacing.xs },
  time: { minWidth: 48, flexShrink: 0, color: palette.accentSoft, fontSize: 12, fontWeight: "700" as const, fontVariant: ["tabular-nums"] },
  activeTime: { color: watchPalette.accentSoft },
  title: { ...type.label, flex: 1, color: "rgba(250,249,246,0.82)" },
  activeTitle: { color: palette.wall },
  pressed: { opacity: 0.56 },
});

