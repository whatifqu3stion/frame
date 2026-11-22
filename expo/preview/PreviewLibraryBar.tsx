import Text from "@/components/FrameText";
import { Pressable, View } from "react-native";
import { useState } from "react";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { CAN_PREVIEW_LIBRARY, PREVIEW_LIBRARY_ENABLED, setPreviewLibrary } from "./mode";

export default function PreviewLibraryBar() {
  const { palette, type } = useFrameTheme();
  const [error, setError] = useState(false);
  if (!CAN_PREVIEW_LIBRARY) return null;
  return <View style={{ backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.borderSoft, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 16 }}>
    <Text style={[type.bodySoft, { fontSize: 11, flex: 1 }]}>{error ? "Preview storage is unavailable in this browser." : PREVIEW_LIBRARY_ENABLED ? "Sample library · fictional content" : "Explore a populated Frame"}</Text>
    <Pressable accessibilityRole="button" onPress={() => { try { setPreviewLibrary(!PREVIEW_LIBRARY_ENABLED); } catch { setError(true); } }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={[type.label, { fontSize: 12, color: palette.active }]}>{PREVIEW_LIBRARY_ENABLED ? "Exit preview" : "Load sample library"}</Text></Pressable>
  </View>;
}
