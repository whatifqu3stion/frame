import PrintStudy, { printStudies } from "@/components/motion/PrintStudy";
import { StyleSheet, View } from "react-native";
import MediaMount from "@/components/MediaMount";

export default function OpeningPrint() {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.print}>
    <MediaMount>
      <View style={styles.window}>
        {printStudies.map((motif) => <View key={motif} style={styles.panel}><PrintStudy motif={motif} /></View>)}
      </View>
    </MediaMount>
  </View>;
}

const styles = StyleSheet.create({ print: { marginBottom: 24 }, window: { width: "100%", aspectRatio: 3.5, maxHeight: 144, flexDirection: "row", gap: 5 }, panel: { flex: 1, overflow: "hidden" } });
