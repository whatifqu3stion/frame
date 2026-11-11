import { router } from "expo-router";
import { ArrowRight, Import } from "lucide-react-native";
import { ActivityIndicator, Alert } from "react-native";
import Text from "@/components/FrameText";
import Pressable from "@/components/motion/ChoicePressable";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";

export default function ImportSubscriptionsAction() {
  const { activeProfileId, googleConfigured, googleConnected, signInWithGoogle } = useApp();
  const { palette, type } = useFrameTheme();
  const { busy, run } = useScreenAction(activeProfileId);
  if (!googleConfigured) return null;

  const open = () => {
    if (googleConnected) { router.push("/google-import"); return; }
    void run(signInWithGoogle, (result) => {
      if (result.ok) router.push("/google-import");
      else Alert.alert("Google connection", result.message);
    }, () => Alert.alert("Google connection", "Google couldn’t connect. Try again when you’re ready."));
  };
  return <Pressable onPress={open} disabled={busy} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} testID="sources-google-import"
    style={{ minHeight: 56, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
    {busy ? <ActivityIndicator size="small" color={palette.active} /> : <Import size={18} color={palette.active} />}
    <Text style={[type.body, { flex: 1 }]}>{googleConnected ? "Choose subscriptions" : "Connect Google to import"}</Text>
    <ArrowRight size={16} color={palette.inkMuted} />
  </Pressable>;
}
