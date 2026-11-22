import { useFeedback } from "@/hooks/useFeedback";
import InfoDisclosure from "@/components/InfoDisclosure";
import Heading from "@/components/Heading";
import Text from "@/components/FrameText";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { useApp } from "@/providers/AppProvider";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { TODAY_MAX_ITEMS } from "@/constants/productConfig";
import { SETTINGS_TITLES } from "@/constants/settings";
import { radii, spacing } from "@/constants/theme";

export default function TodaySelectionSetting({ firstSelection = false, compact = false }: { firstSelection?: boolean; compact?: boolean }) {
  const { activeProfileId } = useApp();
  return <ProfileSelectionSetting key={activeProfileId} firstSelection={firstSelection} compact={compact} />;
}
function ProfileSelectionSetting({ firstSelection, compact }: { firstSelection: boolean; compact: boolean }) {
  const { prefs, setTodayVideoCount } = useApp();
  const feedback = useFeedback();
  const { palette, type } = useFrameTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const count = prefs.todayVideoCount;
  const change = async (next: number) => {
    if (locked.current || next === count || next < 1 || next > TODAY_MAX_ITEMS) return;
    const acknowledge = feedback.capture();
    locked.current = true; setBusy(true); setError("");
    try { await setTodayVideoCount(next); acknowledge("selection"); }
    catch { setError("Your selection size couldn’t save. Try again."); }
    finally { locked.current = false; setBusy(false); }
  };
  const countLabel = `${count} ${count === 1 ? "video" : "videos"}`;
  const valueLabel = `Daily maximum: ${countLabel}. Range: 1 to ${TODAY_MAX_ITEMS}.`;
  const stepButton = (delta: -1 | 1) => {
    const next = count + delta;
    const disabled = busy || next < 1 || next > TODAY_MAX_ITEMS;
    const Icon = delta < 0 ? Minus : Plus;
    return <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? "Fewer videos in Today" : "More videos in Today"}
      accessibilityHint={valueLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { void change(next); }}
      style={styles.target}
    >
      {({ pressed }) => <View style={[
        styles.buttonFace,
        compact && styles.compactFace,
        { backgroundColor: palette.activeSoft, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 },
      ]}>
        <Icon size={compact ? 16 : 20} color={palette.active} />
      </View>}
    </Pressable>;
  };
  const stepper = <View style={[styles.stepper, !compact && styles.expandedStepper]}>
    {stepButton(-1)}
    <Text
      accessibilityLabel={valueLabel}
      accessibilityLiveRegion="polite"
      style={[compact ? type.body : type.heading, styles.value, !compact && styles.expandedValue]}
    >{compact ? count : countLabel}</Text>
    {stepButton(1)}
  </View>;
  if (compact) return <View style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSoft }}>
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs, justifyContent: "space-between" }}>
      <View style={{ flexGrow: 1, flexBasis: 120 }}>
        <Text style={type.body}>{SETTINGS_TITLES.today}</Text>
        <Text style={type.caption}>1–{TODAY_MAX_ITEMS} videos</Text>
      </View>
      {stepper}
    </View>
    <Text style={[type.caption, { paddingBottom: spacing.sm }]}>Applies at the next 4 a.m. refresh.</Text>
    {error ? <Text style={[type.bodySoft, { color: palette.danger }]} accessibilityRole="alert">{error}</Text> : null}
  </View>;
  return <View style={{ gap: spacing.sm }}>
    <InfoDisclosure label="How Today works" anchor={<Heading style={type.heading}>{SETTINGS_TITLES.today}</Heading>}>
      <Text style={type.bodySoft}>Frame draws from sources you follow, with up to two videos per source. Each video is at least four minutes long. Refreshing updates video details. Managed profiles also follow the Owner’s approvals.</Text>
    </InfoDisclosure>
    <Text style={type.bodySoft}>Choose a daily maximum from 1 to {TODAY_MAX_ITEMS}.</Text>
    {stepper}
    <Text style={type.bodySoft}>{firstSelection ? "You can change this later in Settings." : "Applies at the next 4 a.m. refresh."}</Text>
    {error ? <Text style={[type.bodySoft, { color: palette.danger }]} accessibilityRole="alert">{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", maxWidth: 320 },
  expandedStepper: { gap: spacing.sm, paddingVertical: spacing.md },
  target: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  buttonFace: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.control, borderCurve: "continuous" },
  compactFace: { width: 32, height: 32 },
  value: { minWidth: 24, textAlign: "center", fontVariant: ["tabular-nums"] },
  expandedValue: { flex: 1 },
});
