import React, { useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Text from "@/components/FrameText";
import { type } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { progressRecovery } from "@/services/progressRecoveryInstance";

export default function ProgressRecoveryNotice({ profileId, hidden }: { profileId: string; hidden: boolean }) {
  useSyncExternalStore(progressRecovery.subscribe, progressRecovery.getSnapshot, progressRecovery.getSnapshot);
  const { palette } = useFrameTheme();
  const insets = useSafeAreaInsets();
  const failures = progressRecovery.failures(profileId);
  if (hidden || !failures.length) return null;
  const retrying = failures.some(entry => entry.writer.getSnapshot().retrying);
  const onlySessionTime = failures.every(entry => entry.kind === "session");
  return <View testID="global-progress-recovery" accessibilityLiveRegion="polite" style={{ backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.borderSoft, paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(8, insets.bottom) }}>
    <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 16 }}>
      <Text style={[type.label, { fontSize: 14, lineHeight: 20, color: palette.ink, flex: 1 }]}>{onlySessionTime ? "Your session time couldn’t save. Retry to keep it up to date." : "Your latest viewing progress couldn’t save. Retry to keep your place."}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry saving viewing progress" accessibilityState={{ disabled: retrying, busy: retrying }} disabled={retrying} onPress={() => { void progressRecovery.retry(profileId); }} style={({ pressed }) => ({ minHeight: 48, minWidth: 48, justifyContent: "center", paddingHorizontal: 8, opacity: pressed || retrying ? 0.6 : 1 })}>
        <Text style={[type.label, { color: palette.active }]}>{retrying ? "Saving…" : "Retry"}</Text>
      </Pressable>
    </View>
  </View>;
}
