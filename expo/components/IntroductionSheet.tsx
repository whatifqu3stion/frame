import { useEffect, useRef, useState, type RefObject } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { useEvent, useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import Sheet from "@/components/Sheet";
import Heading from "@/components/Heading";
import Text from "@/components/FrameText";
import PrimaryAction from "@/components/PrimaryAction";
import guide from "@/constants/introduction.json";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

// This is a bundled Frame guide. It has no provider credentials, profile data or library writes.
function GuidePlayer({ checkpoint }: { checkpoint: RefObject<number> }) {
  const { type } = useFrameTheme();
  const startAt = useRef(checkpoint.current);
  const player = useVideoPlayer(require("../assets/welcome/viewing-guide.mp4"), (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.5;
  });
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (currentTime > 0) checkpoint.current = currentTime;
  });
  useEventListener(player, "playToEnd", () => { checkpoint.current = 0; });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const started = useRef(false);
  useEffect(() => {
    if (status !== "readyToPlay" || started.current || AppState.currentState === "background") return;
    started.current = true;
    if (startAt.current > 0 && startAt.current < player.duration - 0.5) player.currentTime = startAt.current;
    player.play();
  }, [player, status]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    return () => subscription.remove();
  }, [player]);
  return <View>
    {status === "error" ? <Text accessibilityLiveRegion="polite" style={type.bodySoft}>
      The film couldn’t play. Read the introduction below or continue to connections.
    </Text> : <VideoView player={player} nativeControls playsInline contentFit="contain"
      accessibilityLabel="How Frame works, a silent 28-second film" style={styles.film} />}
  </View>;
}

type Props = { visible: boolean; onClose(): void; onConnect(): void };

export default function IntroductionSheet({ visible, onClose, onConnect }: Props) {
  const { palette, type } = useFrameTheme();
  const [showText, setShowText] = useState(false);
  const checkpoint = useRef(0);
  useEffect(() => { if (!visible) { setShowText(false); checkpoint.current = 0; } }, [visible]);
  return <Sheet visible={visible} label="How Frame works" onClose={onClose} animateContent={false}>
    {visible && <View style={styles.content}>
      <View style={styles.header}>
        <Heading level={1} style={type.heading}>How Frame works</Heading>
        <Pressable accessibilityRole="button" accessibilityLabel="Close introduction" onPress={onClose} style={styles.close}>
          <Text style={[type.label, { color: palette.active }]}>Close</Text>
        </Pressable>
      </View>
      <Text style={type.caption}>28 seconds · Silent film</Text>
      {!showText && <GuidePlayer checkpoint={checkpoint} />}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showText }} aria-expanded={showText}
        onPress={() => setShowText((value) => !value)} style={styles.textAction}>
        <Text style={[type.label, { color: palette.active }]}>{showText ? "Watch the film" : "Read the introduction"}</Text>
      </Pressable>
      {showText && guide.chapters.map((chapter) => <View key={chapter.section} style={styles.chapter}>
        <Heading style={type.label}>{chapter.section}</Heading><Text style={type.body}>{chapter.body}</Text>
      </View>)}
      <PrimaryAction onPress={onConnect} depth={palette.primaryButtonDepth} style={[styles.connect, { backgroundColor: palette.accentDeep }]}>
        <Text style={[type.label, { color: palette.onDark }]}>Set up connections</Text>
      </PrimaryAction>
    </View>}
  </Sheet>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  close: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
  film: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "#171513", borderRadius: radii.media, overflow: "hidden" },
  textAction: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  chapter: { gap: spacing.xs },
  connect: { alignItems: "center", justifyContent: "center", minHeight: 48, padding: spacing.sm, borderRadius: radii.control },
});
