import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = {
  visible: boolean;
  onClose(): void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  contentKey?: string;
};

/** A bounded, scrollable sheet that stays reachable with the keyboard and larger text. */
export default function Sheet({ visible, onClose, children, contentStyle, contentKey }: Props) {
  const insets = useSafeAreaInsets();
  const { palette } = useFrameTheme();
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, []);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType={reduceMotion ? "none" : "fade"} onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: palette.overlay }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          key={contentKey}
          style={styles.screen}
          contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          bounces={false}
        >
          <View style={[styles.card, { backgroundColor: palette.surfaceHigh, borderColor: palette.border }, contentStyle]} accessibilityViewIsModal>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: spacing.md },
  card: { width: "100%", maxWidth: 560, alignSelf: "center", padding: spacing.lg, borderRadius: radii.card, borderWidth: 1 },
});
