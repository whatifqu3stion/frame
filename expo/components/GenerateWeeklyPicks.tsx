import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppState, Pressable, View } from "react-native";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { radii, spacing } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { byokWeeklyPicks } from "@/services/byokWeeklyPicksInstance";
import { providerKeyStore } from "@/storage/providerKeyStore";
import { ProviderError } from "@/services/providerRequest";
import { DiscoverySetupError, type DiscoveryStage } from "@/services/byokWeeklyPicks";
import { CuratingSelection } from "@/components/motion/CuratingSelection";

export default function GenerateWeeklyPicks({ hasEdition = false, onSetUpKeys, onBusyChange, onPrepared, onPresentationStage }: { hasEdition?: boolean; onSetUpKeys?(): void; onBusyChange?(busy: boolean): void; onPrepared?(hasPicks: boolean): void; onPresentationStage?(stage: DiscoveryStage | null): void }) {
  const { palette, type } = useFrameTheme();
  const { activeProfile, activeProfileId, interests, authorizeProtectedAction } = useApp();
  const focused = useIsFocused();
  const client = useQueryClient();
  const retryQuery = useQuery({ queryKey: ["weekly-recovery", activeProfileId], queryFn: () => byokWeeklyPicks.canRetryEmpty(activeProfileId), enabled: focused && activeProfile?.role === "owner", networkMode: "always" });
  const keyStatus = useQuery({ queryKey: ["provider-key-status"], queryFn: () => providerKeyStore.status(), enabled: focused && activeProfile?.role === "owner" && (!hasEdition || retryQuery.data === true), networkMode: "always", retry: false });

  useEffect(() => providerKeyStore.subscribe(() => { void client.invalidateQueries({ queryKey: ["provider-key-status"] }); }), [client]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<DiscoveryStage>("setup");
  const presentedStage = busy && stage !== "setup" ? stage : null;
  useEffect(() => { onPresentationStage?.(presentedStage); }, [onPresentationStage, presentedStage]);
  useEffect(() => () => onPresentationStage?.(null), [onPresentationStage]);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const [message, setMessage] = useState("");
  const operation = useRef<AbortController | null>(null);
  const interestKey = interests.map((item) => item.id).sort().join(",");
  useEffect(() => {
    setBusy(false); setMessage("");
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") { operation.current?.abort(); setBusy(false); } });
    return () => { operation.current?.abort(); listener.remove(); };
  }, [activeProfileId, focused, interestKey]);
  const generate = async () => {
    if (operation.current || !focused || activeProfile?.role !== "owner") return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setMessage(""); setStage("setup");
    try {
      if (!await authorizeProtectedAction(activeProfileId, true) || controller.signal.aborted) return;
      await byokWeeklyPicks.generate(interests.map((item) => item.id), controller.signal, activeProfileId, (next) => { if (!controller.signal.aborted) setStage(next); });
      if (controller.signal.aborted) return;
      await client.invalidateQueries({ predicate: (query) => ["weekly-picks", "onboarding-picks"].includes(String(query.queryKey[0])) });
      const result = await byokWeeklyPicks.getWeeklyPicks(interests.map((item) => item.id), activeProfileId);
      if (controller.signal.aborted) return;
      await retryQuery.refetch();
      if (controller.signal.aborted) return;
      setMessage(result.status === "success" ? result.response.message ?? "This week’s suggestions are ready." : "Picks could not be loaded. Try again later.");
      if (result.status === "success") onPrepared?.(result.response.interests.some((interest) => interest.picks.length > 0));
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof ProviderError || error instanceof DiscoverySetupError ? error.message : "Frame couldn’t finish preparing picks. Try again later.");
    } finally {
      void retryQuery.refetch();
      if (operation.current === controller) operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  if (activeProfile?.role !== "owner") return <Text style={type.bodySoft}>The Owner can generate suggestions with the keys on this device.</Text>;
  const keysReady = keyStatus.data?.available && keyStatus.data.youtube && keyStatus.data.gemini;
  const buttonStyle = { minHeight: 48, justifyContent: "center" as const };
  if (busy) return <View style={{ gap: spacing.sm }}>
    {presentedStage ? !onPresentationStage && <CuratingSelection stage={presentedStage} /> : <Text accessibilityLiveRegion="polite" style={type.bodySoft}>Preparing…</Text>}
    <Pressable accessibilityRole="button" onPress={() => { operation.current?.abort(); setBusy(false); setMessage("Stopped. Requests already sent may count toward your quota."); }} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Cancel</Text></Pressable>
  </View>;
  return <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
    {!hasEdition || retryQuery.data ? <>
      {!interests.length ? <Pressable accessibilityRole="button" onPress={() => router.push("/settings/interests")} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Choose interests for your picks</Text></Pressable>
        : keyStatus.isPending ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">Checking discovery setup…</Text>
        : keyStatus.isError ? <><Text style={type.bodySoft}>Discovery setup couldn’t be checked.</Text><Pressable accessibilityRole="button" onPress={() => { void keyStatus.refetch(); }} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Check setup again</Text></Pressable></>
        : !keyStatus.data?.available ? <Text style={type.bodySoft}>Prepare weekly picks in the iPhone or Android app, where your keys can be stored securely.</Text>
        : !keysReady ? <><Text style={type.bodySoft}>Connect YouTube and Gemini to find picks for your interests.</Text><Pressable accessibilityRole="button" onPress={onSetUpKeys ?? (() => router.push("/settings/keys"))} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Connect my keys</Text></Pressable></>
        : <>
          <Text style={type.bodySoft}>{onSetUpKeys ? "Gemini reviews your interests and public video details. Up to 25 Gemini requests; charges may apply." : "Gemini receives your interests and public channel/video descriptions. Provider charges may apply."}</Text>
          <PrimaryAction depth={palette.primaryButtonDepth} accessibilityRole="button" onPress={() => { void generate(); }} style={[buttonStyle, { backgroundColor: palette.accentDeep, alignItems: "center", borderRadius: radii.control }]} testID="generate-byok-picks"><Text style={[type.label, { color: palette.onDark }]}>{retryQuery.data ? "Try once more for this week" : onSetUpKeys ? "Find my picks" : "Generate this week’s picks"}</Text></PrimaryAction>
        </>}
    </> : null}
    {message ? <MotionView enter changeKey={message}><Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text></MotionView> : null}
  </View>;
}
