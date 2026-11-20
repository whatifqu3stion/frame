import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useFrameTheme } from "@/constants/useFrameTheme";
import ProgrammeGrain from "@/components/ProgrammeGrain";

/** One static paper texture beneath the screen, never over video, text or controls. */
export default function PaperSurface({ children }: { children?: ReactNode }) {
  const { palette } = useFrameTheme();
  return <View style={[styles.surface, { backgroundColor: palette.wall }]}>
    <ProgrammeGrain finish="sheet" />
    {children}
  </View>;
}
const styles = StyleSheet.create({ surface: { flex: 1, overflow: "hidden" } });
