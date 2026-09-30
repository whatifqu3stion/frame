import { forwardRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = TextInputProps & {
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

/** One continuous field edge, including its icon; focus never changes its geometry. */
export default forwardRef<TextInput, Props>(function TextField({ leading, trailing, containerStyle, style, onFocus, onBlur, editable, ...props }, ref) {
  const { palette, type } = useFrameTheme();
  const [focused, setFocused] = useState(false);
  return <View style={[
    styles.field,
    { backgroundColor: palette.surface, borderColor: palette.borderSoft },
    containerStyle,
    focused && editable !== false && { borderColor: palette.inkSoft },
    editable === false && styles.disabled,
  ]}>
    {leading}
    <TextInput
      ref={ref}
      placeholderTextColor={palette.inkMuted}
      selectionColor={palette.accent}
      cursorColor={palette.accent}
      underlineColorAndroid="transparent"
      {...props}
      editable={editable}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      style={[type.body, styles.input, style, Platform.OS === "web" && styles.webInput]}
    />
    {trailing}
  </View>;
});

const styles = StyleSheet.create({
  field: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radii.control },
  input: { flex: 1, minWidth: 0, minHeight: 50, fontSize: 16, paddingHorizontal: 0, paddingVertical: spacing.sm, borderWidth: 0, backgroundColor: "transparent" },
  // The enclosing field provides a visible focus border for mouse and keyboard alike.
  webInput: { outlineWidth: 0 },
  disabled: { opacity: 0.6 },
});
