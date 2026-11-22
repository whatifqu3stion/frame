import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import InfoButton from "@/components/InfoButton";
import MotionView from "@/components/motion/MotionView";
import { spacing } from "@/constants/theme";

/** Keep the icon beside its subject and let the explanation use the available width. */
export default function InfoDisclosure({ anchor, label, children }: {
  anchor: ReactNode; label: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <View>
    <View style={styles.row}>
      <View style={styles.anchor}>{anchor}</View>
      <InfoButton label={label} expanded={open} onPress={() => setOpen((value) => !value)} />
    </View>
    {open && <MotionView enter distance={-4} style={styles.detail}>{children}</MotionView>}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  anchor: { flexShrink: 1, minWidth: 0 },
  detail: { gap: spacing.sm, paddingBottom: spacing.sm },
});
