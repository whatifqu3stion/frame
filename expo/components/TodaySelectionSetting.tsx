import Text from "@/components/FrameText";
import { useRef, useState } from "react";
import { View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import Pressable from "@/components/motion/ChoicePressable";
import { useApp } from "@/providers/AppProvider";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { TODAY_MAX_ITEMS } from "@/constants/productConfig";
import { radii, spacing } from "@/constants/theme";

export default function TodaySelectionSetting({ firstSelection = false }: { firstSelection?: boolean }) {
  const { activeProfileId } = useApp();
  return <ProfileSelectionSetting key={activeProfileId} firstSelection={firstSelection} />;
}
function ProfileSelectionSetting({ firstSelection }: { firstSelection: boolean }) {
  const { prefs, setTodayVideoCount } = useApp();
  const { palette, type } = useFrameTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const count = prefs.todayVideoCount;
  const change = async (next: number) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { await setTodayVideoCount(next); }
    catch { setError("Your selection size couldn’t save. Try again."); }
    finally { locked.current = false; setBusy(false); }
  };
  return <View style={{ gap: spacing.sm }}>
    <Text style={type.heading} accessibilityRole="header">Your daily selection</Text>
    <Text style={type.bodySoft}>Up to {TODAY_MAX_ITEMS} videos per day, depending on availability.</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, maxWidth: 320, paddingVertical: spacing.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fewer videos in Today" accessibilityState={{ disabled: busy || count <= 1 }} disabled={busy || count <= 1} onPress={() => { void change(count - 1); }} style={{ width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.activeSoft, opacity: busy || count <= 1 ? 0.4 : 1 }}><Minus size={20} color={palette.active} /></Pressable>
      <Text style={[type.heading, { flex: 1, minWidth: 0, textAlign: "center" }]} accessibilityLiveRegion="polite">{count} {count === 1 ? "video" : "videos"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="More videos in Today" accessibilityState={{ disabled: busy || count >= TODAY_MAX_ITEMS }} disabled={busy || count >= TODAY_MAX_ITEMS} onPress={() => { void change(count + 1); }} style={{ width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: radii.control, backgroundColor: palette.activeSoft, opacity: busy || count >= TODAY_MAX_ITEMS ? 0.4 : 1 }}><Plus size={20} color={palette.active} /></Pressable>
    </View>
    <Text style={type.bodySoft}>{firstSelection ? "You can change this later in Settings." : "Applies to your next selection at 4 a.m. Today stays the same."}</Text>
    {error ? <Text style={[type.bodySoft, { color: palette.danger }]} accessibilityRole="alert">{error}</Text> : null}
  </View>;
}
