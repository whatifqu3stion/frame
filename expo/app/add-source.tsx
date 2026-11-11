import { Redirect, router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ArrowRight, Link2 } from "lucide-react-native";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PREVIEW_LIBRARY_ENABLED } from "@/preview/mode";
import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import { providerKeyState } from "@/domain/providerKeyStatus";
import AddChannelModal from "@/components/AddChannelModal";
import ChannelSearch from "@/components/ChannelSearch";
import Text from "@/components/FrameText";
import Heading from "@/components/Heading";
import ImportSubscriptionsAction from "@/components/ImportSubscriptionsAction";
import Pressable from "@/components/motion/ChoicePressable";
import { boundedReading } from "@/constants/layout";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

export default function AddSourceScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSaved = from === "saved";
  const backLabel = fromSaved ? "Saved" : "Sources";
  const { activeProfile } = useApp();
  const { palette, type } = useFrameTheme();
  const keyStatus = useProviderKeyStatus();
  const state = providerKeyState(keyStatus);
  const webHandoff = Platform.OS === "web" && state === "unavailable";
  const needsKey = state === "ready" && !keyStatus.data?.youtube;
  const searchAvailable = PREVIEW_LIBRARY_ENABLED || !(webHandoff || needsKey);
  const [pasteOpen, setPasteOpen] = useState(false);
  if (!activeProfile || activeProfile.role === "managed") return <Redirect href="/(tabs)/sources" />;

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(fromSaved ? "/(tabs)/saved" : "/(tabs)/sources")} accessibilityRole="button" accessibilityLabel={`Back to ${backLabel}`} style={styles.back}>
        <ArrowLeft size={18} color={palette.active} />
        <Text style={[type.label, { color: palette.active }]}>{backLabel}</Text>
      </Pressable>
      <View style={styles.introduction}>
        <Heading level={1} style={type.title}>Find a source</Heading>
        <Text style={type.bodySoft}>{webHandoff && !PREVIEW_LIBRARY_ENABLED ? "To find and follow YouTube channels, connect YouTube in Frame on your iPhone or Android device." : needsKey && !PREVIEW_LIBRARY_ENABLED ? "Connect YouTube to find channels by name or link." : "Preview a channel before you follow it."}</Text>
      </View>
      {searchAvailable ? <ChannelSearch /> : needsKey && activeProfile.role === "owner" ? <Pressable accessibilityRole="button" style={styles.alternative} onPress={() => router.push({ pathname: "/settings/[section]", params: { section: "keys" } })}><Text style={[type.label, { color: palette.active }]}>Set up YouTube</Text></Pressable> : null}
      <View style={[styles.alternatives, { borderColor: palette.borderSoft }]}>
        {!webHandoff && !needsKey && <Pressable onPress={() => setPasteOpen(true)} accessibilityRole="button" style={styles.alternative}>
          <Link2 size={18} color={palette.active} />
          <Text style={[type.body, styles.rowLabel]}>Paste a channel link or @handle</Text>
          <ArrowRight size={16} color={palette.inkMuted} />
        </Pressable>}
        <ImportSubscriptionsAction />
      </View>
    </ScrollView>
    <AddChannelModal visible={pasteOpen} onClose={() => setPasteOpen(false)} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { ...boundedReading, flexGrow: 1, paddingHorizontal: spacing.page, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  back: { alignSelf: "flex-start", minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  introduction: { gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xl },
  alternatives: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  alternative: { minHeight: 56, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowLabel: { flex: 1 },
});
