import { useReducedMotion } from "@/hooks/useReducedMotion";
import MotionView from "@/components/motion/MotionView";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing, softShadow } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = {
  visible: boolean;
  label?: string;
  returnFocusTarget?: HTMLElement | null;
  onClose(): void;
  onBack?(): void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  contentKey?: string;
  nestedRoute?: boolean;
  animateContent?: boolean;
  tvForm?: boolean;
};

// React Native Web mounts modal portals beside the application root. Keep that
// root out of keyboard and screen-reader navigation until the last sheet closes.
let openWebSheets = 0;
let rootWasInert = false;

/** A bounded, scrollable sheet that stays reachable with the keyboard and larger text. */
export default function Sheet({ visible, label, returnFocusTarget, onClose, onBack, children, contentStyle, contentKey, nestedRoute = false, animateContent = true, tvForm = false }: Props) {
  const insets = useSafeAreaInsets();
  const { palette } = useFrameTheme();
  const reduceMotion = useReducedMotion();
  const returnFocus = useRef<HTMLElement | null>(null);
  const scroll = useRef<ScrollView>(null);
  const androidPhone = Platform.OS === "android" && !Platform.isTV;
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // A closed Android IME can report its last screen position in the hide event.
  // Only reserve that space while the keyboard is actually open.
  useEffect(() => {
    if (!visible || !androidPhone) return;
    setKeyboardOpen(Keyboard.isVisible());
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, [androidPhone, visible]);
  const keyboardBehavior = androidPhone ? (keyboardOpen ? "padding" : undefined) : Platform.OS === "ios" ? "padding" : "height";
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [contentKey, visible]);

  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !visible || typeof document === "undefined") return;
    const root = document.getElementById("root");
    if (!root) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openWebSheets === 0) { rootWasInert = root.inert; root.inert = true; }
    openWebSheets++;
    return () => { if (--openWebSheets === 0) root.inert = rootWasInert; };
  }, [visible]);

  const restoreWebFocus = () => {
    const target = returnFocusTarget ?? returnFocus.current;
    returnFocus.current = null;
    if (target) requestAnimationFrame(() => {
      if (target.isConnected && !target.closest("[inert]")) target.focus({ preventScroll: true });
    });
  };

  return (
    <Modal onDismiss={Platform.OS === "web" ? restoreWebFocus : undefined} {...(Platform.OS === "web" && label ? { "aria-label": label } : {})} visible={visible} transparent statusBarTranslucent animationType={reduceMotion || nestedRoute ? "none" : "fade"} onRequestClose={onBack ?? onClose}>
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: palette.overlay }]} behavior={keyboardBehavior}>
        <ScrollView
          ref={scroll}
          style={styles.screen}
          contentContainerStyle={[styles.container, Platform.isTV && tvForm && styles.tvForm, { paddingLeft: Math.max(insets.left, spacing.md), paddingRight: Math.max(insets.right, spacing.md), paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          bounces={false}
        >
          <MotionView changeKey={contentKey} active={visible && animateContent} style={[styles.card, { backgroundColor: palette.surfaceHigh }, contentStyle]} accessibilityViewIsModal onAccessibilityEscape={onBack ?? onClose}>
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
  tvForm: { justifyContent: "flex-start" },
  card: { ...softShadow, width: "100%", maxWidth: 560, alignSelf: "center", padding: spacing.lg, borderRadius: radii.card },
});
