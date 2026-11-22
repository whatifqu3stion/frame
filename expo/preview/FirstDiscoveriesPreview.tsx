import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { RotateCcw } from "lucide-react-native";
import Text from "@/components/FrameText";
import { CuratingSelection } from "@/components/motion/CuratingSelection";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import FirstDiscoveries, { type FirstDiscovery } from "@/components/FirstDiscoveries";
import { notifyUser } from "@/services/notifyUser";

// Editorial examples already used in the onboarding film, never provider results.
const items: FirstDiscovery[] = [
  { id: "moon", title: "Tour of the Moon", creator: "NASA Goddard", image: require("../assets/welcome/moon-tour.jpg"), interest: "Science & Nature", reason: "A closer look at the craters, mountains and hidden landscapes of our nearest neighbor." },
  { id: "linocut", title: "How a linocut is made", creator: "V&A", image: require("../assets/welcome/linocut.jpg") },
  { id: "music", title: "Yo-Yo Ma: Tiny Desk", creator: "NPR Music", image: require("../assets/welcome/yo-yo-ma.jpg") },
];

export default function FirstDiscoveriesPreview({ loading = false }: { loading?: boolean }) {
  const { palette, type } = useFrameTheme();
  const visible = useMotionVisibility();
  const [startedAt, setStartedAt] = useState(Date.now);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!loading || !visible || elapsed >= 17000) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(timer);
  }, [loading, visible, startedAt, elapsed]);
  const replay = <Pressable accessibilityRole="button" accessibilityLabel="Replay loading preview" onPress={() => { setStartedAt(Date.now()); setElapsed(0); }} style={{ minHeight: 44, minWidth: 44, alignSelf: "center", alignItems: "center", justifyContent: "center", opacity: 0.6 }}><RotateCcw size={18} color={palette.active} /></Pressable>;
  if (loading && elapsed < 17000) return <View>
    <Text style={[type.bodySoft, { textAlign: "center", fontSize: 11 }]}>DESIGN PREVIEW · SIMULATED SEARCH</Text>
    <CuratingSelection key={startedAt} startedAt={startedAt} stage={elapsed < 3500 ? "suggestions" : elapsed < 6500 ? "sample" : "review"} reviewedCount={elapsed < 6500 ? 0 : elapsed < 14000 ? 1 : elapsed < 16500 ? 2 : 3} />
    {replay}
  </View>;
  return <View style={{ gap: 16 }}> <FirstDiscoveries sample items={items} onWatch={() => notifyUser("Design preview", "These are sample discoveries. In setup, your reviewed picks open directly in Frame’s viewing room.")} />{loading && replay}</View>;
}
