import { useReducedMotion } from "@/hooks/useReducedMotion";
import MotionView from "@/components/motion/MotionView";
import { useEffect, useRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing, softShadow } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = {
  visible: boolean;
  onClose(): void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  contentKey?: string;
  nestedRoute?: boolean;
  animateContent?: boolean;
};

/** A bounded, scrollable sheet that stays reachable with the keyboard and larger text. */
export default function Sheet({ visible, onClose, children, contentStyle, contentKey, nestedRoute = false, animateContent = true }: Props) {
  const insets = useSafeAreaInsets();
  const { palette } = useFrameTheme();
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [contentKey, visible]);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType={reduceMotion || nestedRoute ? "none" : "fade"} onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: palette.overlay }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          ref={scroll}
          style={styles.screen}
          contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          bounces={false}
        >
          <MotionView changeKey={contentKey} active={visible && animateContent} style={[styles.card, { backgroundColor: palette.surfaceHigh }, contentStyle]} accessibilityViewIsModal>
            {children}
          </MotionView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: spacing.md },
  card: { ...softShadow, width: "100%", maxWidth: 560, alignSelf: "center", padding: spacing.lg, borderRadius: radii.card },
});
